const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const mainContent = document.getElementById('mainContent');
const pdfContainer = document.getElementById('pdf-render-container');
const resultsList = document.getElementById('resultsList');
const processingIndicator = document.getElementById('processingIndicator');
const toast = document.getElementById('toast');
const hiddenColorInput = document.getElementById('hiddenColorInput');
const colorPickerModal = document.getElementById('colorPickerModal');
const pickerPanel = document.getElementById('pickerPanel');
const modalArrow = document.getElementById('modalArrow');
const groupManagementArea = document.getElementById('groupManagementArea');
const existingGroupsListModal = document.getElementById('existingGroupsListModal');

const originalFileNameDisplay = document.getElementById('originalFileNameDisplay');
const exportFileNameInput = document.getElementById('exportFileNameInput');
const fileInfoBanner = document.getElementById('fileInfoBanner');
const pdfPanel = document.getElementById('pdfPanel');
const resultsPanel = document.getElementById('resultsPanel'); // NEU HINZUGEFÜGT
const rulesContent = document.getElementById('rulesContent');
const pdfTabsContainer = document.getElementById('pdfTabsContainer');

let loadedFiles = []; 
let activeFileIndex = -1;

let isRendering = false; 
let rules = []; 
let selectedColor = '#fff100'; 
let modalSelectedColor = '#fff100'; 

let customItemColors = {}; 
let manualAssignments = {}; 
let currentEditTarget = null; 
let collapsedGroups = new Set(); 
let showUnassigned = true; 

window.groupFlipMode = {}; 
window.itemSignFlips = {}; 

let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', loadSettings);

// Das "async" ist wichtig, damit wir auf die Server-Antwort warten können
async function loadSettings() {
    // 1. UI Settings laden
    const uiSettings = JSON.parse(localStorage.getItem('konto_ui') || '{}');
    if (uiSettings.pdfWidth) pdfPanel.style.width = uiSettings.pdfWidth;
    if (uiSettings.pdfHeight) pdfPanel.style.height = uiSettings.pdfHeight;
    if (uiSettings.resultsWidth) resultsPanel.style.width = uiSettings.resultsWidth;
    if (uiSettings.resultsHeight) resultsPanel.style.height = uiSettings.resultsHeight;
    
    if (uiSettings.rulesCollapsed) {
        rulesContent.classList.add('hidden');
        document.getElementById('rulesCollapseIcon').classList.add('rotate-180');
    }
    
    // 2. Regeln laden
    const savedRules = localStorage.getItem('konto_rules');
    // Wenn es schon lokale Regeln gibt, nehmen wir diese (damit nichts überschrieben wird)
    if (savedRules && savedRules !== "[]" && savedRules !== null) {
        try { 
            rules = JSON.parse(savedRules); 
        } catch(e) { console.error("Fehler beim Laden", e); }
    } else {
        // Wenn der Browser leer ist, versuchen wir sie von GitHub zu laden
        try {
            // Die Zeitangabe am Ende verhindert, dass der Browser eine alte Version aus dem Cache lädt
            const response = await fetch('konto_regeln.json?t=' + new Date().getTime());
            if (response.ok) {
                rules = await response.json();
                saveToLocalStorage(); // Direkt lokal speichern, damit die App reibungslos läuft
            } else {
                console.log("Keine Standardregeln auf dem Server gefunden.");
            }
        } catch(error) {
            console.error("Fehler beim Abrufen der Regeln von GitHub:", error);
        }
    }
    
    renderRules();
}

// NEU: Funktion für den Server-Sync-Button
window.fetchRulesFromGitHub = async function() {
    if (hasUnsavedChanges) {
        if (!confirm("Du hast ungespeicherte Änderungen! Wenn du vom Server lädst, gehen diese verloren. Trotzdem fortfahren?")) return;
    }
    
    try {
        const response = await fetch('konto_regeln.json?t=' + new Date().getTime());
        if (response.ok) {
            rules = await response.json();
            clearDirtyState();
            saveToLocalStorage();
            renderRules();
            updateUI();
            showToast("Regeln erfolgreich von GitHub geladen!");
        } else {
            alert("Fehler: konto_regeln.json konnte nicht auf GitHub gefunden werden.");
        }
    } catch(e) {
        alert("Fehler beim Verbinden mit GitHub. Bitte prüfe deine Internetverbindung.");
    }
}

function saveToLocalStorage() {
    localStorage.setItem('konto_rules', JSON.stringify(rules));
}

function markAsDirty() {
    hasUnsavedChanges = true;
    document.getElementById('unsavedBadge').classList.remove('hidden');
    saveToLocalStorage();
}

function clearDirtyState() {
    hasUnsavedChanges = false;
    document.getElementById('unsavedBadge').classList.add('hidden');
}

// Beobachtet BEIDE verstellbaren Container
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const uiSettings = JSON.parse(localStorage.getItem('konto_ui') || '{}');
        if (entry.target === pdfPanel) {
            uiSettings.pdfWidth = pdfPanel.style.width;
            uiSettings.pdfHeight = pdfPanel.style.height;
        } else if (entry.target === resultsPanel) {
            uiSettings.resultsWidth = resultsPanel.style.width;
            uiSettings.resultsHeight = resultsPanel.style.height;
        }
        localStorage.setItem('konto_ui', JSON.stringify(uiSettings));
    }
});
resizeObserver.observe(pdfPanel);
resizeObserver.observe(resultsPanel); // NEU: Beobachtet auch Ergebnisse

window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges) {
        const msg = "Du hast ungespeicherte Änderungen an deinen Regeln. Wirklich verlassen?";
        e.preventDefault(); e.returnValue = msg; return msg;
    }
});

document.getElementById('importRulesInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedRules = JSON.parse(e.target.result);
            if (Array.isArray(importedRules)) {
                rules = importedRules;
                clearDirtyState();
                saveToLocalStorage();
                renderRules(); updateUI();
                showToast("Regeln erfolgreich importiert!");
            } else { alert("Ungültiges Dateiformat!"); }
        } catch(err) { alert("Fehler beim Lesen der Datei: " + err.message); }
    };
    reader.readAsText(file);
    this.value = ''; 
});

window.exportRulesJSON = function() {
    if(rules.length === 0) { alert("Keine aktiven Regeln vorhanden."); return; }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rules, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "konto_regeln.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    clearDirtyState(); 
    showToast("Regeln als Backup gespeichert!");
}

function closeUnsavedModal() { document.getElementById('unsavedModal').classList.add('hidden'); }

window.proceedWithExport = function(saveFirst) {
    closeUnsavedModal();
    if (saveFirst) exportRulesJSON();
    executePdfExport();
}

function openResetModal() { document.getElementById('resetModal').classList.remove('hidden'); }
function closeResetModal() { document.getElementById('resetModal').classList.add('hidden'); }

function confirmReset() {
    rules = []; 
    manualAssignments = {}; 
    customItemColors = {}; 
    collapsedGroups.clear(); 
    showUnassigned = false;
    window.groupFlipMode = {}; 
    window.itemSignFlips = {};
    markAsDirty();
    renderRules(); 
    updateUI(); 
    closeResetModal();
    showToast("Alle Gruppen und Zuweisungen gelöscht!");
}

window.resetAllFiles = function() {
    loadedFiles = [];
    activeFileIndex = -1;
    pdfContainer.innerHTML = '';
    resultsList.innerHTML = '';
    pdfTabsContainer.innerHTML = '';
    
    uploadSection.classList.remove('hidden');
    mainContent.classList.add('hidden');
    fileInfoBanner.classList.add('hidden');
    showToast("Startbereit für neue PDFs!");
}

window.toggleGroupFlipMode = function(groupName) { window.groupFlipMode[groupName] = !window.groupFlipMode[groupName]; renderResults(); }
window.flipItemSign = function(itemId) { window.itemSignFlips[itemId] = (window.itemSignFlips[itemId] === -1) ? 1 : -1; renderResults(); }
function toggleInfoModal() { document.getElementById('infoModal').classList.toggle('hidden'); }

function toggleRulesPanel() {
    const icon = document.getElementById('rulesCollapseIcon');
    const isHidden = rulesContent.classList.contains('hidden');
    
    if (isHidden) { rulesContent.classList.remove('hidden'); icon.classList.remove('rotate-180'); } 
    else { rulesContent.classList.add('hidden'); icon.classList.add('rotate-180'); }
    
    const uiSettings = JSON.parse(localStorage.getItem('konto_ui') || '{}');
    uiSettings.rulesCollapsed = !isHidden;
    localStorage.setItem('konto_ui', JSON.stringify(uiSettings));
}

function togglePdfView() {
    if(pdfPanel.classList.contains('hidden')) pdfPanel.classList.remove('hidden');
    else pdfPanel.classList.add('hidden');
}

function setSelectedColor(color, btn) {
    selectedColor = color;
    document.querySelectorAll('#colorPicker button').forEach(b => b.classList.remove('ring-2', 'ring-blue-500'));
    if (btn) btn.classList.add('ring-2', 'ring-blue-500');
}

function toggleUnassignedGroup() {
    showUnassigned = !showUnassigned;
    renderResults(); updateUI(); 
    showToast(showUnassigned ? "Restliche Einträge eingeblendet" : "Restliche Einträge ausgeblendet");
}

function openColorSelector(type, id, currentColor, event) {
    event.stopPropagation(); currentEditTarget = { type, id }; modalSelectedColor = currentColor;
    colorPickerModal.classList.remove('hidden'); highlightModalColor(currentColor);
    if (type === 'item') { groupManagementArea.classList.remove('hidden'); renderModalGroupList(); }
    else { groupManagementArea.classList.add('hidden'); }
    const rect = event.target.getBoundingClientRect();
    const panelHeight = pickerPanel.offsetHeight;
    if (window.innerHeight - rect.bottom < panelHeight + 20) {
        pickerPanel.style.top = `${rect.top - panelHeight - 12}px`; modalArrow.className = 'popover-arrow arrow-down';
    } else {
        pickerPanel.style.top = `${rect.bottom + 12}px`; modalArrow.className = 'popover-arrow arrow-up';
    }
    pickerPanel.style.left = `${Math.max(10, Math.min(window.innerWidth - 270, rect.left - 20))}px`;
}

function highlightModalColor(color) {
    document.querySelectorAll('#modalColorGrid button').forEach(btn => {
        const hex = btn.getAttribute('data-hex');
        btn.classList.toggle('ring-2', hex && hex.toLowerCase() === color.toLowerCase());
        btn.classList.toggle('ring-blue-500', hex && hex.toLowerCase() === color.toLowerCase());
        btn.classList.toggle('scale-110', hex && hex.toLowerCase() === color.toLowerCase());
    });
}

function closeColorModal() { 
    colorPickerModal.classList.add('hidden'); 
    currentEditTarget = null; 
    document.getElementById('modalNewGroupName').value = ''; 
    document.getElementById('modalNewGroupKeyword').value = ''; 
}

function renderModalGroupList() {
    existingGroupsListModal.innerHTML = '';
    if (rules.length === 0) { existingGroupsListModal.innerHTML = '<p class="text-[9px] text-slate-400 italic text-center">Keine Gruppen.</p>'; return; }
    
    rules.forEach(rule => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-2 py-1.5 text-[11px] text-slate-700 hover:bg-blue-50 rounded transition-colors flex items-center gap-2 border border-transparent group';
        btn.innerHTML = `<span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${rule.color}"></span><span class="truncate font-bold flex-1 uppercase text-[10px] text-blue-600">${rule.name}</span>`;
        btn.onclick = () => assignItemToGroup(rule.name, rule.color);
        existingGroupsListModal.appendChild(btn);
    });
}

function assignItemToGroup(groupName, color) {
    if (currentEditTarget?.type === 'item') {
        manualAssignments[currentEditTarget.id] = { type: 'manual_group', group: groupName, keyword: 'Manuell', color: color, isManual: true };
        updateUI(); closeColorModal(); showToast(`Verschoben nach "${groupName}"`);
    }
}

function createNewGroupFromModal() {
    const name = document.getElementById('modalNewGroupName').value.trim();
    const keyword = document.getElementById('modalNewGroupKeyword').value.trim();
    if (!name || !keyword) return showToast("Bitte Name UND Suchwort eingeben!");
    
    const oldG = selectedColor; selectedColor = modalSelectedColor;
    addGroupRule(name, [keyword]); selectedColor = oldG;
    if (currentEditTarget?.type === 'item') { assignItemToGroup(name, modalSelectedColor); closeColorModal(); }
}

function applyColorFromModal(color) {
    if (!currentEditTarget) return;
    modalSelectedColor = color; highlightModalColor(color);
    if (currentEditTarget.type === 'group') {
        const rule = rules.find(r => r.name === currentEditTarget.id);
        if (rule) { rule.color = color; markAsDirty(); }
        renderRules(); updateUI(); closeColorModal();
    } else if (currentEditTarget.type === 'item') {
        customItemColors[currentEditTarget.id] = color; updateUI(); closeColorModal();
    }
}

function triggerCustomColor() { hiddenColorInput.click(); }
hiddenColorInput.oninput = (e) => { applyColorFromModal(e.target.value); };

function addRuleFromUI() {
    const name = document.getElementById('groupNameInput').value.trim();
    const keywords = document.getElementById('keywordsInput').value;
    const excludes = document.getElementById('excludesInput').value;
    if(!name || !keywords) return showToast("Bitte Name und Suchwörter eingeben!");
    
    const kwArray = keywords.split(',').map(k => k.trim()).filter(k => k);
    const exArray = excludes.split(',').map(e => e.trim()).filter(e => e);
    addGroupRule(name, kwArray, exArray, selectedColor);
    
    document.getElementById('groupNameInput').value = ''; document.getElementById('keywordsInput').value = ''; document.getElementById('excludesInput').value = '';
}

window.prepareMagicAdd = function(description) {
    if(rulesContent.classList.contains('hidden')) toggleRulesPanel();
    document.getElementById('groupNameInput').value = description;
    document.getElementById('keywordsInput').value = description;
    document.getElementById('groupNameInput').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Bezeichnung übernommen. Bitte speichern!");
}

window.promptAddTag = function(groupName, type) {
    const isEx = type === 'ex';
    const word = prompt(`Neues ${isEx ? 'Ausschluss-Wort' : 'Suchwort'} für die Gruppe "${groupName}" eingeben:`);
    if (word && word.trim()) {
        const group = rules.find(r => r.name === groupName);
        if (group) {
            const cleanWord = word.trim(); let changed = false;
            if (isEx && !group.excludes.some(e => e.toLowerCase() === cleanWord.toLowerCase())) { group.excludes.push(cleanWord); changed = true; } 
            else if (!isEx && !group.keywords.some(k => k.toLowerCase() === cleanWord.toLowerCase())) { group.keywords.push(cleanWord); changed = true; }
            if (changed) markAsDirty();
            renderRules(); updateUI();
        }
    }
}

function addGroupRule(name, keywordsArray, excludesArray = [], color = selectedColor) {
    let group = rules.find(r => r.name.toLowerCase() === name.toLowerCase());
    let changed = false;
    
    if (!group) { group = { name: name, keywords: [], excludes: [], color: color }; rules.push(group); changed = true; } 
    else { if (color && group.color !== color) { group.color = color; changed = true; } }
    
    keywordsArray.forEach(kw => { if (kw && !group.keywords.some(k => k.toLowerCase() === kw.toLowerCase())) { group.keywords.push(kw); changed = true; } });
    excludesArray.forEach(ex => { if (ex && !group.excludes.some(e => e.toLowerCase() === ex.toLowerCase())) { group.excludes.push(ex); changed = true; } });
    
    if (changed) markAsDirty();
    renderRules(); updateUI();
}

function addAllQuickGroups() {
    addSupermarketRules(); addPayPalRule(); addAmazonRule(); addCongstarRule(); addDauerauftraegeRule(); addGesundheitRule(); addDBRule(); addSteamRule(); addMensaRule(); addBargeldRule();
    showUnassigned = true; updateUI(); 
    if(!rulesContent.classList.contains('hidden')) toggleRulesPanel();
}

function addSupermarketRules() { const oldC = selectedColor; selectedColor = '#fff100'; addGroupRule("Lebensmittel", ["Lidl", "Kaufland", "Rewe", "DM", "Rossmann", "Aldi", "Edeka"]); selectedColor = oldC; }
function addPayPalRule() { const oldC = selectedColor; selectedColor = '#99e6ff'; addGroupRule("PayPal", ["PayPal"], ["Steam", "DB"]); selectedColor = oldC; }
function addAmazonRule() { const oldC = selectedColor; selectedColor = '#f97316'; addGroupRule("Amazon", ["Amazon"]); selectedColor = oldC; }
function addCongstarRule() { const oldC = selectedColor; selectedColor = '#8b5cf6'; addGroupRule("Congstar", ["Congstar", "Handy"]); selectedColor = oldC; }
function addDauerauftraegeRule() { const oldC = selectedColor; selectedColor = '#fca5a5'; addGroupRule("Fixkosten", ["Dauerauftrag", "Miete", "Spotify", "Krankenkasse", "Drillisch"]); selectedColor = oldC; }
function addGesundheitRule() { const oldC = selectedColor; selectedColor = '#86efac'; addGroupRule("Gesundheit", ["Apotheke"]); selectedColor = oldC; }
function addDBRule() { const oldC = selectedColor; selectedColor = '#ff4d4d'; addGroupRule("Deutsche Bahn", ["DB"]); selectedColor = oldC; }
function addSteamRule() { const oldC = selectedColor; selectedColor = '#cbd5e1'; addGroupRule("Steam", ["Steam"]); selectedColor = oldC; }
function addMensaRule() { const oldC = selectedColor; selectedColor = '#ff7ab3'; addGroupRule("Mensa", ["Mensa", "Studentenwerk"]); selectedColor = oldC; }
function addBargeldRule() { const oldC = selectedColor; selectedColor = '#166534'; addGroupRule("Bargeld", ["Bargeld", "Auszahlung", "ATM", "Geldautomat"]); selectedColor = oldC; }

function removeGroup(name) {
    rules = rules.filter(r => r.name !== name);
    Object.keys(manualAssignments).forEach(id => { if (manualAssignments[id] && manualAssignments[id].group === name) delete manualAssignments[id]; });
    markAsDirty(); renderRules(); updateUI();
}

function removeTag(groupName, type, word) {
    const group = rules.find(r => r.name === groupName);
    if(group) {
        if(type === 'kw') group.keywords = group.keywords.filter(k => k !== word);
        if(type === 'ex') group.excludes = group.excludes.filter(e => e !== word);
        markAsDirty();
        if(group.keywords.length === 0) removeGroup(groupName); else { renderRules(); updateUI(); }
    }
}

function toggleGroupCollapse(name) { if (collapsedGroups.has(name)) collapsedGroups.delete(name); else collapsedGroups.add(name); renderResults(); }

window.scrollToResultGroup = function(groupName) {
    const safeId = 'result-group-' + groupName.replace(/\s+/g, '-');
    const el = document.getElementById(safeId);
    const container = document.getElementById('resultsList');
    
    if(el && container) {
        if (collapsedGroups.has(groupName)) {
            toggleGroupCollapse(groupName);
        }
        // Exakte Kalkulation für das Scrollen innerhalb der Results-Box
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScroll = container.scrollTop + (elRect.top - containerRect.top) - 10;
        
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        
        el.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 1500);
    } else {
        showToast(`Die Gruppe "${groupName}" hat im aktuellen PDF keine Treffer.`);
    }
}

function renderRules() {
    const container = document.getElementById('rulesList');
    container.innerHTML = rules.length === 0 ? '<p class="text-[10px] text-slate-400 italic text-center py-4 col-span-full">Keine aktiven Gruppen.</p>' : '';
    
    rules.forEach(rule => {
        const el = document.createElement('div'); 
        el.className = 'bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-sm flex flex-col h-full cursor-pointer hover:border-blue-400 transition-colors group/card';
        let safeName = rule.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        el.onclick = () => scrollToResultGroup(rule.name);

        let tagsHtml = rule.keywords.map(kw => {
            let safeKw = kw.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<span class="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-sm text-[9px] mt-1 mr-1" onclick="event.stopPropagation()"><span>${kw}</span><button onclick="removeTag('${safeName}', 'kw', '${safeKw}'); event.stopPropagation();" class="text-slate-400 hover:text-red-500 font-bold">&times;</button></span>`;
        }).join('');
        
        let exHtml = rule.excludes.map(ex => {
            let safeEx = ex.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<span class="inline-flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 rounded-sm text-[9px] mt-1 mr-1" onclick="event.stopPropagation()"><span class="line-through">${ex}</span><button onclick="removeTag('${safeName}', 'ex', '${safeEx}'); event.stopPropagation();" class="text-red-400 hover:text-red-700 font-bold">&times;</button></span>`;
        }).join('');
        
        el.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span onclick="openColorSelector('group', '${safeName}', '${rule.color}', event)" class="color-pill color-pill-interactive border shrink-0" style="background-color: ${rule.color}"></span>
                    <span class="font-bold text-blue-800 uppercase text-[10px] truncate group-hover/card:text-blue-600 transition-colors" title="${rule.name}">${rule.name}</span>
                </div>
                <button onclick="removeGroup('${safeName}'); event.stopPropagation();" class="text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Gruppe löschen"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>
            </div>
            <div class="flex flex-wrap flex-1 content-start">${tagsHtml}${exHtml}</div>
            <div class="mt-3 pt-2 border-t border-slate-100 flex gap-2 shrink-0">
                <button onclick="promptAddTag('${safeName}', 'kw'); event.stopPropagation();" class="text-[9px] text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-0.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Suchwort</button>
                <button onclick="promptAddTag('${safeName}', 'ex'); event.stopPropagation();" class="text-[9px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-0.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Ausnahme</button>
            </div>
        `;
        container.appendChild(el);
    });
}

function findMatchingRule(text) {
    const lowerText = text.toLowerCase();
    for (let rule of rules) {
        if (rule.excludes.some(ex => lowerText.includes(ex.toLowerCase()))) continue;
        const match = rule.keywords.find(kw => lowerText.includes(kw.toLowerCase()));
        if (match) return { rule, matchedKeyword: match };
    }
    return null;
}

fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFiles(e.target.files); });
uploadSection.addEventListener('click', () => fileInput.click());
uploadSection.addEventListener('dragenter', (e) => { e.preventDefault(); uploadSection.classList.add('active'); });
uploadSection.addEventListener('dragover', (e) => { e.preventDefault(); uploadSection.classList.add('active'); });
uploadSection.addEventListener('dragleave', () => uploadSection.classList.remove('active'));
uploadSection.addEventListener('drop', (e) => { e.preventDefault(); uploadSection.classList.remove('active'); handleFiles(e.dataTransfer.files); });

exportFileNameInput.addEventListener('input', (e) => {
    if(activeFileIndex > -1 && loadedFiles[activeFileIndex]) {
        loadedFiles[activeFileIndex].exportName = e.target.value;
    }
});

async function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    uploadSection.classList.add('hidden'); 
    mainContent.classList.remove('hidden'); 
    fileInfoBanner.classList.remove('hidden'); 
    processingIndicator.classList.remove('hidden'); 
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const arrayBuffer = await file.arrayBuffer(); 
            const pdfInst = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fileTransactions = [];
            for (let p = 1; p <= pdfInst.numPages; p++) {
                const page = await pdfInst.getPage(p); 
                const textContent = await page.getTextContent();
                fileTransactions = fileTransactions.concat(groupIntoTransactions(textContent.items, p, loadedFiles.length));
            }
            
            const suggestedName = detectAndSetSuggestedFileName(fileTransactions, file.name);
            
            loadedFiles.push({
                id: 'file-' + Date.now() + '-' + loadedFiles.length,
                file: file,
                name: file.name,
                pdfInstance: pdfInst,
                transactions: fileTransactions,
                exportName: suggestedName
            });
        } catch (err) { alert(`Datei ${file.name} konnte nicht gelesen werden.`); }
    }
    
    processingIndicator.classList.add('hidden');
    
    if (loadedFiles.length > 0) {
        if (rules.length === 0) addAllQuickGroups(); 
        switchActiveFile(activeFileIndex === -1 ? 0 : activeFileIndex);
        showToast(`${files.length} Datei(en) erfolgreich geladen.`);
    }
}

window.switchActiveFile = function(index) {
    activeFileIndex = index;
    const activeData = loadedFiles[index];
    
    originalFileNameDisplay.textContent = activeData.name;
    exportFileNameInput.value = activeData.exportName;
    document.getElementById('pageCount').textContent = `${activeData.pdfInstance.numPages} Seite(n)`;
    
    renderPdfTabs();
    updateUI();
}

function renderPdfTabs() {
    pdfTabsContainer.innerHTML = '';
    if (loadedFiles.length <= 1) { pdfTabsContainer.classList.add('hidden'); return; }
    pdfTabsContainer.classList.remove('hidden');
    
    loadedFiles.forEach((fileData, index) => {
        const isActive = index === activeFileIndex;
        const btn = document.createElement('button');
        btn.className = `px-4 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap ${isActive ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`;
        btn.innerHTML = `<div class="flex items-center gap-2"><svg class="w-3 h-3 ${isActive ? 'text-blue-400' : 'text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="truncate max-w-[150px]">${fileData.exportName}</span></div>`;
        btn.onclick = () => switchActiveFile(index);
        pdfTabsContainer.appendChild(btn);
    });
}

function detectAndSetSuggestedFileName(transArray, originalName) {
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    const stats = {}; const dateRegex = /(\d{2})\.(\d{2})\.(\d{2,4})/;
    transArray.forEach(t => { 
        const match = t.text.match(dateRegex); 
        if (match) { 
            const m = match[2]; const y = match[3].length === 2 ? "20" + match[3] : match[3]; 
            const key = `${m}-${y}`; stats[key] = (stats[key] || 0) + 1; 
        } 
    });
    let bestKey = null; let maxCount = -1;
    for (let key in stats) { if (stats[key] > maxCount) { maxCount = stats[key]; bestKey = key; } }
    if (bestKey) { const [mNum, y] = bestKey.split('-'); const mName = months[parseInt(mNum) - 1]; return `Kontoauszug ${mNum} ${mName} ${y}`; } 
    return `Kontoauszug_${originalName.replace('.pdf', '')}`; 
}

function groupIntoTransactions(items, pageNum, fileIndex) {
    let lines = {};
    items.forEach(item => { const y = Math.round(item.transform[5]); if (!lines[y]) lines[y] = []; lines[y].push(item); });
    const sortedY = Object.keys(lines).sort((a, b) => b - a);
    let blocks = []; let currentBlock = null;
    sortedY.forEach(y => {
        const lineItems = lines[y].sort((a,b) => a.transform[4] - b.transform[4]);
        const lineText = lineItems.map(i => i.str).join(' ');
        const amountItem = findAmountItem(lineItems, lineText);
        if (amountItem) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = { id: `t-f${fileIndex}-p${pageNum}-${Math.random().toString(36).substr(2, 5)}`, text: lineText, items: lineItems, amountItem: amountItem, page: pageNum, y: parseFloat(y) };
        } else if (currentBlock) { currentBlock.text += " " + lineText; currentBlock.items = currentBlock.items.concat(lineItems); }
    });
    if (currentBlock) blocks.push(currentBlock); return blocks;
}

function findAmountItem(items, blockText) {
    const lower = (blockText || "").toLowerCase();
    if (lower.includes("saldo") || lower.includes("kontostand") || lower.includes("übertrag") || lower.includes("freistellungsauftrag")) return null;
    const amountRegex = /^-?(\d{1,3}(\.\d{3})*|\d+),\d{2}$/;
    const cand = items.filter(i => { const s = i.str.trim(); return amountRegex.test(s) && !/[a-zA-Z]/.test(s) && !(/^\d{2}\.\d{2}\.\d{4}$/.test(s)); });
    if (cand.length === 0) return null; return cand.reduce((prev, curr) => (curr.transform[4] > prev.transform[4]) ? curr : prev);
}

async function updateUI() {
    if (activeFileIndex === -1 || !loadedFiles[activeFileIndex] || isRendering) return; 
    isRendering = true;
    
    const activePdf = loadedFiles[activeFileIndex].pdfInstance;
    
    pdfContainer.innerHTML = '';
    for (let i = 1; i <= activePdf.numPages; i++) { 
        const page = await activePdf.getPage(i); 
        await renderPageWithHighlights(page, i); 
    }
    renderResults(); 
    isRendering = false;
}

async function renderPageWithHighlights(page, pageNum) {
    const activeData = loadedFiles[activeFileIndex];
    const viewport = page.getViewport({ scale: 1.5 });
    const wrapper = document.createElement('div'); wrapper.className = 'canvas-wrapper'; wrapper.id = `page-wrapper-${pageNum}`;
    const canvas = document.createElement('canvas'); canvas.height = viewport.height; canvas.width = viewport.width;
    const hlCanvas = document.createElement('canvas'); hlCanvas.className = 'highlight-layer'; hlCanvas.height = viewport.height; hlCanvas.width = viewport.width;
    const ctx = hlCanvas.getContext('2d');
    wrapper.appendChild(canvas); wrapper.appendChild(hlCanvas); pdfContainer.appendChild(wrapper);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    activeData.transactions.filter(t => t.page === pageNum).forEach(trans => {
        const assignment = manualAssignments[trans.id];
        let matched = null; let finalColor = null;
        if (assignment) { finalColor = customItemColors[trans.id] || assignment.color || '#cbd5e1'; } 
        else { matched = findMatchingRule(trans.text); finalColor = matched ? (customItemColors[trans.id] || matched.rule.color) : (showUnassigned ? (customItemColors[trans.id] || '#cbd5e1') : null); }

        if (finalColor) {
            const amount = trans.amountItem;
            if (amount) {
                const transform = pdfjsLib.Util.transform(viewport.transform, amount.transform);
                ctx.fillStyle = finalColor; ctx.globalAlpha = 0.4;
                ctx.fillRect(transform[4], transform[5] - (amount.height * 1.1), amount.width, amount.height * 1.4); trans.canvasY = transform[5] - (amount.height * 1.1);
            }
        }
    });
}

function getShortName(text, amountStr) {
    let clean = text.replace(amountStr, '').replace(/\d{2}\.\d{2}\.\d{2,4}/g, '').trim();
    const noise = ["lastschrift", "gutschrift", "dauerauftrag", "terminueberw", "basislastschrift", "sepa", "kartenzahlung", "aus", "einkauf", "umsatz", "entgelt", "mandat", "referenz", "folgenr"];
    let words = clean.split(/[\/\s,\-:\(\)]+/).filter(w => { let low = w.toLowerCase().trim(); return low.length > 2 && !noise.includes(low) && !/^\d+$/.test(low); });
    return words.slice(0, 2).join(' ') || 'Unbekannt';
}

function renderResults() {
    if (activeFileIndex === -1 || !loadedFiles[activeFileIndex]) return;
    
    resultsList.innerHTML = ''; 
    let groups = {}; let incomeList = { primary: [], assigned: [] }; let unassignedItems = [];
    const activeData = loadedFiles[activeFileIndex];

    activeData.transactions.forEach(t => {
        const amountItem = t.amountItem; if (!amountItem) return;
        const { value, isNegativeResult } = invertSign(amountItem.str); const numeric = parseGermanNum(value); if (numeric === 0) return;

        const assignment = manualAssignments[t.id];
        let matched = null; let groupKey = null; let itemKeyword = null; let itemColor = null;

        if (assignment) { groupKey = assignment.group; itemKeyword = assignment.keyword; itemColor = assignment.color; } 
        else { matched = findMatchingRule(t.text); if (matched) { groupKey = matched.rule.name; itemKeyword = matched.matchedKeyword; itemColor = matched.rule.color; } }

        const itemData = { id: t.id, value, numeric: numeric, original: amountItem.str, isNegative: isNegativeResult, page: t.page, yPos: t.canvasY, ruleColor: itemColor, keyword: itemKeyword, description: getShortName(t.text, amountItem.str), isManual: !!assignment };

        if (groupKey) {
            if (!groups[groupKey]) { const groupColor = assignment?.color || matched?.rule?.color || '#ccc'; groups[groupKey] = { color: groupColor, items: [], isCategory: true }; }
            groups[groupKey].items.push(itemData);
        } else { unassignedItems.push(itemData); }

        if (isNegativeResult) { if (groupKey) incomeList.assigned.push({ ...itemData, groupName: groupKey }); else incomeList.primary.push(itemData); }
    });

    Object.keys(groups).forEach(name => { if (groups[name].items.length > 0) renderGroupUI(name, groups[name], resultsList); });
    if (showUnassigned && unassignedItems.length > 0) renderUnassignedUI(unassignedItems);
    if (incomeList.primary.length > 0 || incomeList.assigned.length > 0) renderIncomeUI(incomeList);

    window.currentGroups = groups; window.incomeData = incomeList;
}

function renderUnassignedUI(items) {
    const name = "Restliche Einträge"; const isCollapsed = collapsedGroups.has(name);
    const el = document.createElement('div'); 
    el.id = 'result-group-' + name.replace(/\s+/g, '-');
    el.className = 'bg-slate-50 border-2 border-slate-300 rounded-lg shadow-sm mb-4 overflow-hidden flex flex-col transition-all';
    
    el.innerHTML = `<div class="p-2 px-3 bg-slate-200 border-b flex justify-between items-center shrink-0 cursor-pointer select-none hover:bg-slate-300 transition-colors" onclick="toggleGroupCollapse('${name}')"><div class="flex items-center gap-2"><svg class="w-3 h-3 text-slate-500 transform transition-transform ${isCollapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg><span class="color-pill bg-slate-400"></span><span class="text-[10px] font-bold text-slate-700 uppercase tracking-widest">${name}</span><span class="text-[9px] text-slate-500 bg-white px-1 rounded font-mono">${items.length}</span></div></div>`;
    if (!isCollapsed) {
        const list = document.createElement('div'); list.className = 'divide-y divide-slate-200 overflow-y-auto flex-1 custom-scrollbar';
        items.forEach(item => {
            const color = customItemColors[item.id] || '#cbd5e1'; const row = document.createElement('div'); row.className = 'p-3 flex items-center gap-3 hover:bg-white cursor-pointer group transition-colors'; row.onclick = () => scrollToEntry(item.page, item.yPos);
            
            let safeDesc = item.description.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const mult = window.itemSignFlips[item.id] || 1;
            const eNum = item.numeric * mult;
            const displayVal = eNum > 0 ? `+${eNum.toLocaleString('de-DE', {minimumFractionDigits:2})}` : eNum.toLocaleString('de-DE', {minimumFractionDigits:2});
            const numColor = eNum > 0 ? 'text-emerald-600' : 'text-rose-500';

            row.innerHTML = `<div class="flex items-center gap-2 shrink-0"><span onclick="openColorSelector('item', '${item.id}', '${color}', event)" class="color-pill color-pill-interactive border" style="background-color: ${color}"></span><span class="text-[9px] text-slate-300 font-mono">S.${item.page}</span></div><div class="flex-1 min-w-0"><div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-sm font-mono font-bold ${numColor}">${displayVal}</span><span class="text-[10px] text-slate-500 font-medium truncate italic" title="${item.description}">${item.description}</span></div></div></div><div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"><button onclick="event.stopPropagation(); prepareMagicAdd('${safeDesc}')" class="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-emerald-200 border border-emerald-200">+ REGEL</button><button onclick="event.stopPropagation(); copySingleItem('${item.id}', ${item.numeric})" class="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700">KOPIEREN</button></div>`;
            list.appendChild(row);
        });
        el.appendChild(list);
    }
    resultsList.appendChild(el);
}

window.copySingleItem = function(id, numValue) { 
    const mult = window.itemSignFlips[id] || 1;
    const eNum = numValue * mult;
    const str = eNum.toLocaleString('de-DE', {minimumFractionDigits: 2}).replace(/\./g, '');
    const copyStr = eNum > 0 ? `+${str}` : str;
    navigator.clipboard.writeText(copyStr); 
    showToast(`Kopiert: ${copyStr}`); 
}

function renderGroupUI(name, group, container) {
    const isCollapsed = collapsedGroups.has(name);
    const isFlipMode = window.groupFlipMode[name] || false;
    
    const el = document.createElement('div'); 
    el.id = 'result-group-' + name.replace(/\s+/g, '-');
    el.className = 'bg-white border rounded-lg shadow-sm mb-4 overflow-hidden flex flex-col transition-all';
    
    const toggleHtml = `
        <label class="flex items-center cursor-pointer mr-2" title="Vorzeichen manuell drehen" onclick="event.stopPropagation()">
            <div class="relative">
                <input type="checkbox" class="sr-only toggle-checkbox" onchange="toggleGroupFlipMode('${name}')" ${isFlipMode ? 'checked' : ''}>
                <div class="block bg-slate-300 w-7 h-4 rounded-full toggle-label transition-colors"></div>
                <div class="dot absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition transform ${isFlipMode ? 'translate-x-3' : ''}"></div>
            </div>
        </label>
    `;

    el.innerHTML = `<div class="p-2 px-3 bg-slate-50 border-b flex justify-between items-center shrink-0 cursor-pointer select-none hover:bg-slate-100 transition-colors" onclick="toggleGroupCollapse('${name}')"><div class="flex items-center gap-2"><svg class="w-3 h-3 text-slate-400 transform transition-transform ${isCollapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg><span class="color-pill" style="background-color: ${group.color}"></span><span class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">${name}</span><span class="text-[9px] text-slate-400 bg-slate-200 px-1 rounded font-mono">${group.items.length}</span></div><div class="flex items-center" onclick="event.stopPropagation()">${toggleHtml}<button onclick="copyGroupAsExcel('${name}')" class="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-700 transition shadow-sm">KOPIEREN</button></div></div>`;
    
    if (!isCollapsed) {
        const list = document.createElement('div'); list.className = 'divide-y divide-slate-100 overflow-y-auto flex-1 custom-scrollbar';
        if (group.isCategory) {
            const subgroups = {}; group.items.forEach(item => { const kw = item.keyword || "Manuell"; if (!subgroups[kw]) subgroups[kw] = { items: [], sum: 0 }; subgroups[kw].items.push(item); 
                const mult = window.itemSignFlips[item.id] || 1;
                subgroups[kw].sum += (item.numeric * mult); 
            });
            Object.keys(subgroups).sort((a, b) => { if (a === "Manuell") return 1; if (b === "Manuell") return -1; return a.localeCompare(b); }).forEach(kw => {
                const sub = subgroups[kw]; const subContainer = document.createElement('div'); subContainer.className = 'bg-slate-50/50 border-l-2 border-slate-200 my-1 py-1';
                
                const sumStr = sub.sum > 0 ? `+${sub.sum.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : sub.sum.toLocaleString('de-DE', { minimumFractionDigits: 2 });
                const sumColor = sub.sum > 0 ? 'text-emerald-500' : 'text-rose-400';

                const subHeader = document.createElement('div'); subHeader.className = 'px-3 py-1 flex justify-between items-center bg-slate-100/50 shrink-0'; subHeader.innerHTML = `<span class="text-[9px] font-black text-slate-500 uppercase">${kw}</span><span class="text-[9px] font-mono ${sumColor} font-bold italic">Summe: ${sumStr} €</span>`;
                subContainer.appendChild(subHeader); sub.items.forEach(item => { subContainer.appendChild(createItemRow(item, name, isFlipMode)); }); list.appendChild(subContainer);
            });
        }
        el.appendChild(list);
    }
    container.appendChild(el);
}

function createItemRow(item, groupName, isFlipMode) {
    const color = customItemColors[item.id] || item.ruleColor; const row = document.createElement('div'); row.className = 'p-3 flex items-center gap-3 hover:bg-blue-50 cursor-pointer group transition-colors'; row.onclick = () => scrollToEntry(item.page, item.yPos);
    const showDescription = (groupName === "Fixkosten" || item.isManual);
    
    const mult = window.itemSignFlips[item.id] || 1;
    const eNum = item.numeric * mult;
    const displayVal = eNum > 0 ? `+${eNum.toLocaleString('de-DE', {minimumFractionDigits:2})}` : eNum.toLocaleString('de-DE', {minimumFractionDigits:2});
    const numColor = eNum > 0 ? 'text-emerald-600' : 'text-rose-500';

    let flipBtn = '';
    if (isFlipMode) {
        flipBtn = `<button onclick="event.stopPropagation(); flipItemSign('${item.id}')" class="bg-slate-200 text-slate-700 hover:bg-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm mr-1 border border-slate-300" title="Vorzeichen drehen">[+/-]</button>`;
    }

    row.innerHTML = `<div class="flex items-center gap-2 shrink-0"><span onclick="openColorSelector('item', '${item.id}', '${color}', event)" class="color-pill color-pill-interactive border" style="background-color: ${color}"></span><span class="text-[9px] text-slate-300 font-mono">S.${item.page}</span></div><div class="flex-1 min-w-0"><div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-sm font-mono font-bold ${numColor}">${displayVal}</span>${showDescription ? `<span class="text-[10px] text-slate-500 font-medium truncate italic" title="${item.description}">${item.description}</span>` : ''}</div></div></div><div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">${flipBtn}<button onclick="event.stopPropagation(); copySingleItem('${item.id}', ${item.numeric})" class="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700">KOPIEREN</button></div>`;
    return row;
}

function renderIncomeUI(data) {
    const isCollapsed = collapsedGroups.has("Einnahmen"); const el = document.createElement('div'); 
    el.id = 'result-group-Einnahmen';
    el.className = 'bg-emerald-50/30 border-2 border-dashed border-emerald-100 rounded-lg shadow-sm mb-4 overflow-hidden flex flex-col transition-all';
    
    el.innerHTML = `<div class="p-2 px-3 bg-white border-b flex justify-between items-center shrink-0 cursor-pointer select-none" onclick="toggleGroupCollapse('Einnahmen')"><div class="flex items-center gap-2"><svg class="w-3 h-3 text-emerald-400 transform transition-transform ${isCollapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg><span class="w-3 h-3 border border-emerald-300 rounded-full bg-emerald-100"></span><span class="text-[10px] font-bold text-emerald-700 uppercase">Einnahmen</span></div><div class="flex gap-2 items-center" onclick="event.stopPropagation()"><button onclick="copyIncomeAsExcel()" class="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded font-bold">KOPIEREN</button></div></div>`;
    if (!isCollapsed) {
        const list = document.createElement('div'); list.className = 'divide-y divide-emerald-50 overflow-y-auto flex-1 custom-scrollbar';
        data.primary.forEach(item => {
            const row = document.createElement('div'); row.className = 'p-3 flex items-center gap-3 hover:bg-white cursor-pointer group transition-colors'; row.onclick = () => scrollToEntry(item.page, item.yPos);
            row.innerHTML = `<div class="flex items-center gap-2 shrink-0"><span onclick="openColorSelector('item', '${item.id}', '#ccc', event)" class="color-pill color-pill-interactive border bg-white"></span><span class="text-[9px] text-slate-300 font-mono">S.${item.page}</span></div><div class="flex-1 min-w-0"><div class="flex flex-col"><div class="text-sm font-mono text-emerald-600 font-bold">+${item.value}</div><div class="text-[10px] text-slate-500 truncate italic">${item.description}</div></div></div><button onclick="event.stopPropagation(); copySingleItem('${item.id}', ${item.numeric})" class="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700">KOPIEREN</button>`;
            list.appendChild(row);
        });
        data.assigned.forEach(item => {
            const row = document.createElement('div'); row.className = 'p-3 flex items-center gap-3 opacity-40 hover:opacity-100 cursor-pointer transition-opacity bg-slate-100/30 group'; row.onclick = () => scrollToEntry(item.page, item.yPos);
            row.innerHTML = `<div class="flex items-center gap-2 shrink-0"><span class="color-pill border" style="background-color: ${item.ruleColor}"></span><span class="text-[9px] text-slate-300 font-mono">S.${item.page}</span></div><div class="flex-1 min-w-0"><div class="flex flex-col"><div class="text-sm font-mono text-emerald-600 font-bold line-through opacity-50">+${item.value}</div><div class="text-[10px] text-slate-400 italic">In: ${item.groupName} - ${item.description}</div></div></div><button onclick="event.stopPropagation(); copySingleItem('${item.id}', ${item.numeric})" class="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700">KOPIEREN</button>`;
            list.appendChild(row);
        });
        el.appendChild(list);
    }
    resultsList.appendChild(el);
}

function scrollToEntry(pageNum, yInPage) { 
    const wrapper = document.getElementById(`page-wrapper-${pageNum}`); 
    if (wrapper) {
        pdfContainer.scrollTo({ top: wrapper.offsetTop + (yInPage || 0) - 100, behavior: 'smooth' });
    }
}

function parseGermanNum(str) { return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0; }
function invertSign(str) {
    let clean = str.trim(); let isGerman = clean.includes(',') && (!clean.includes('.') || clean.lastIndexOf(',') > clean.lastIndexOf('.'));
    let num = isGerman ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) : parseFloat(clean.replace(/,/g, ''));
    if (isNaN(num)) return { value: str, isNegativeResult: false }; let inv = num * -1; return { value: inv.toLocaleString('de-DE', { minimumFractionDigits: 2 }), isNegativeResult: inv < 0 };
}

window.copyGroupAsExcel = function(name) { 
    let formula = "=";
    window.currentGroups[name].items.forEach(i => {
        const mult = window.itemSignFlips[i.id] || 1;
        const eNum = i.numeric * mult;
        const str = eNum.toLocaleString('de-DE', {minimumFractionDigits: 2}).replace(/\./g, '');
        formula += eNum > 0 ? `+${str}` : str;
    });
    navigator.clipboard.writeText(formula); showToast(`Excel-Summe kopiert!`); 
}

window.copyIncomeAsExcel = function() { 
    const all = [...window.incomeData.primary, ...window.incomeData.assigned]; 
    let formula = "=";
    all.forEach(i => {
        const mult = window.itemSignFlips[i.id] || 1;
        const eNum = i.numeric * mult;
        const str = eNum.toLocaleString('de-DE', {minimumFractionDigits: 2}).replace(/\./g, '');
        formula += eNum > 0 ? `+${str}` : str;
    });
    navigator.clipboard.writeText(formula); showToast(`Einnahmen-Summe kopiert!`); 
}

function applyHighlights() {
    if(activeFileIndex === -1 || !loadedFiles[activeFileIndex]) return alert("Keine PDF geladen.");
    
    if (hasUnsavedChanges) {
        document.getElementById('unsavedModal').classList.remove('hidden');
    } else {
        executePdfExport();
    }
}

async function executePdfExport() {
    const btn = document.getElementById('applyBtn'); btn.disabled = true; 
    
    const activeData = loadedFiles[activeFileIndex];
    const exportName = exportFileNameInput.value.trim() || `Auswertung_${activeData.name}`;
    
    try {
        const arrayBuffer = await activeData.file.arrayBuffer(); 
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        
        for (let i = 0; i < pdfDoc.getPageCount(); i++) {
            const page = pdfDoc.getPages()[i]; const pageNum = i + 1;
            activeData.transactions.filter(t => t.page === pageNum).forEach(t => {
                const assignment = manualAssignments[t.id]; let matched = null; if (assignment) matched = assignment; else matched = findMatchingRule(t.text);
                const finalColor = matched ? (customItemColors[t.id] || (assignment ? assignment.color : matched.rule.color)) : (showUnassigned ? (customItemColors[t.id] || '#cbd5e1') : null);
                if (finalColor) {
                    const amount = t.amountItem;
                    if (amount) { const hex = finalColor.replace('#', ''); page.drawRectangle({ x: amount.transform[4], y: amount.transform[5] - 2, width: amount.width, height: amount.height + 4, color: PDFLib.rgb(parseInt(hex.substring(0,2),16)/255, parseInt(hex.substring(2,4),16)/255, parseInt(hex.substring(4,6),16)/255), opacity: 0.4 }); }
                }
            });
        }
        const bytes = await pdfDoc.save(); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})); link.download = `${exportName}.pdf`; link.click(); showToast("PDF mit Highlights exportiert!");
    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
}

function showToast(msg) { toast.innerText = msg; toast.classList.remove('opacity-0', 'translate-y-4'); toast.classList.add('opacity-100', 'translate-y-0'); setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); toast.classList.remove('opacity-100', 'translate-y-0'); }, 2500); }
