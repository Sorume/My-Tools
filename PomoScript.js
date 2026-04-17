// --- 1. Konfiguration & Statusvariablen ---
let times = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
};

let currentMode = 'focus'; // Welcher Modus ist aktiv? ('focus', 'short', 'long')
let timeLeft = times[currentMode];
let timerId = null;
let isRunning = false;
let completedFocusSessions = 0; // Zählt die abgeschlossenen Fokus-Phasen

// --- 2. HTML Elemente greifen ---
const displayElement = document.getElementById('time-left');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');

// Modus-Buttons
const btnFocus = document.getElementById('btn-focus');
const btnShort = document.getElementById('btn-short');
const btnLong = document.getElementById('btn-long');

// Einstellungen
const inputWork = document.getElementById('work-time');
const inputShortBreak = document.getElementById('short-break');
const inputLongBreak = document.getElementById('long-break');
const notifyToggle = document.getElementById('notify-toggle');
const saveBtn = document.getElementById('save-settings-btn');

// --- 3. Modus wechseln (Fokus / Kurze Pause / Lange Pause) ---
function switchMode(mode) {
    // Timer stoppen
    clearInterval(timerId);
    isRunning = false;
    
    // Aktuellen Modus speichern
    currentMode = mode;
    
    // Zeit für den gewählten Modus laden
    timeLeft = times[currentMode];
    
    // Visuelle Hervorhebung der Buttons aktualisieren
    btnFocus.classList.remove('active');
    btnShort.classList.remove('active');
    btnLong.classList.remove('active');
    
    if (mode === 'focus') btnFocus.classList.add('active');
    if (mode === 'short') btnShort.classList.add('active');
    if (mode === 'long') btnLong.classList.add('active');
    
    updateDisplay();
}

// Event Listener für die Modus-Buttons
btnFocus.addEventListener('click', () => switchMode('focus'));
btnShort.addEventListener('click', () => switchMode('short'));
btnLong.addEventListener('click', () => switchMode('long'));

// --- 4. Einstellungen übernehmen ---
function applySettings() {
    times.focus = (parseInt(inputWork.value) || 25) * 60;
    times.short = (parseInt(inputShortBreak.value) || 5) * 60;
    times.long = (parseInt(inputLongBreak.value) || 15) * 60;
    
    // Den Timer direkt auf die neu eingestellte Zeit des AKTUELLEN Modus aktualisieren
    if (!isRunning) {
        timeLeft = times[currentMode];
        updateDisplay();
    }
    
    saveBtn.textContent = "Gespeichert!";
    saveBtn.style.backgroundColor = "#2E7D32";
    setTimeout(() => {
        saveBtn.textContent = "Speichern & Übernehmen";
        saveBtn.style.backgroundColor = "#4CAF50";
    }, 2000);
}

saveBtn.addEventListener('click', applySettings);

// --- 5. Benachrichtigungen ---
notifyToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        Notification.requestPermission().then(permission => {
            if (permission !== 'granted') {
                e.target.checked = false;
            }
        });
    }
});

function sendNotification(title, message) {
    if (notifyToggle.checked && Notification.permission === "granted") {
        new Notification(title, { body: message });
    }
}

// --- 6. Darstellung (UI & Tab) ---
function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    displayElement.textContent = formattedTime;
    
    if (isRunning) {
        document.title = `(${formattedTime}) Pomodoro`;
    } else {
        document.title = "Pomodoro";
    }
}

// --- 7. Timer-Logik & Automatische Auswahl ---
function startTimer() {
    if (isRunning) return; 
    
    isRunning = true;
    timerId = setInterval(() => {
        timeLeft--;
        updateDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerId);
            isRunning = false;
            
            // Logik, was passiert, wenn die Zeit um ist:
            if (currentMode === 'focus') {
                completedFocusSessions++;
                
                // Nach 4 Fokus-Phasen gibt es eine lange Pause
                if (completedFocusSessions % 4 === 0) {
                    sendNotification("Fokus beendet!", "Zeit für eine lange Pause. Gut gemacht!");
                    switchMode('long');
                } else {
                    sendNotification("Fokus beendet!", "Zeit für eine kurze Pause.");
                    switchMode('short');
                }
            } else {
                // Wenn eine Pause endet, springen wir zurück zum Fokus
                sendNotification("Pause beendet!", "Auf geht's zum nächsten Fokus-Block!");
                switchMode('focus');
            }
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerId);
    isRunning = false;
    updateDisplay();
}

// --- 8. Event Listener verknüpfen ---
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);

// Initialisierung
updateDisplay();