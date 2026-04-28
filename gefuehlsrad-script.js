// --- 1. DIE VOLLSTÄNDIGEN DATEN ---
const emotionsData = {
    name: "Root", 
    children: [
        {
            name: "Schlecht", color: "#5ec2b6",
            children: [
                { name: "Gelangweilt", children: [{name: "Desinteressiert"}, {name: "Gleichgültig"}] },
                { name: "Beschäftigt", children: [{name: "Unter Druck"}, {name: "Gehetzt"}] },
                { name: "Gestresst", children: [{name: "Überwältigt"}, {name: "Außer Kontrolle"}] },
                { name: "Müde", children: [{name: "Schläfrig"}, {name: "Unkonzentriert"}] }
            ]
        },
        {
            name: "Überrascht", color: "#f79e5e",
            children: [
                { name: "Aufgeschreckt", children: [{name: "Schockiert"}, {name: "Bestürzt"}] },
                { name: "Verwirrt", children: [{name: "Desillusioniert"}, {name: "Verdutzt"}] },
                { name: "Staunend", children: [{name: "Verblüfft"}, {name: "Ehrfürchtig"}] },
                { name: "Aufgeregt", children: [{name: "Eifrig"}, {name: "Energiegeladen"}] }
            ]
        },
        {
            name: "Glücklich", color: "#f16d54",
            children: [
                { name: "Spielerisch", children: [{name: "Entbrannt"}, {name: "Frech"}] },
                { name: "Zufrieden", children: [{name: "Frei"}, {name: "Freudig"}] },
                { name: "Interessiert", children: [{name: "Neugierig"}, {name: "Wissbegierig"}] },
                { name: "Stolz", children: [{name: "Erfolgreich"}, {name: "Selbstsicher"}] },
                { name: "Akzeptiert", children: [{name: "Respektiert"}, {name: "Geschätzt"}] },
                { name: "Mächtig", children: [{name: "Mutig"}, {name: "Kreativ"}] },
                { name: "Friedlich", children: [{name: "Liebevoll"}, {name: "Dankbar"}] },
                { name: "Vertrauensvoll", children: [{name: "Feinfühlig"}, {name: "Vertraut"}] },
                { name: "Optimistisch", children: [{name: "Hoffnungsvoll"}, {name: "Inspiriert"}] }
            ]
        },
        {
            name: "Traurig", color: "#f58e7e",
            children: [
                { name: "Einsam", children: [{name: "Verlassen"}, {name: "Vereinsamt"}] },
                { name: "Verletzlich", children: [{name: "Zerbrechlich"}, {name: "Benachteiligt"}] },
                { name: "Verzweifelt", children: [{name: "Machtlos"}, {name: "Trauernd"}] },
                { name: "Schuldig", children: [{name: "Beschämt"}, {name: "Reumütig"}] },
                { name: "Deprimiert", children: [{name: "Leer"}, {name: "Unsichtbar"}] },
                { name: "Verletzt", children: [{name: "Enttäuscht"}, {name: "Peinlich berührt"}] }
            ]
        },
        {
            name: "Angeekelt", color: "#a56b64",
            children: [
                { name: "Zurückgestoßen", children: [{name: "Zögernd"}, {name: "Entsetzt"}] },
                { name: "Entsetzlich", children: [{name: "Verabscheut"}, {name: "Angewidert"}] },
                { name: "Unbehaglich", children: [{name: "Abgestoßen"}, {name: "Fassungslos"}] },
                { name: "Missbilligend", children: [{name: "Verurteilt"}, {name: "Urteilend"}] }
            ]
        },
        {
            name: "Wütend", color: "#9f73ab",
            children: [
                { name: "Kritisch", children: [{name: "Ablehnend"}, {name: "Skeptisch"}] },
                { name: "Distanziert", children: [{name: "Gefühllos"}, {name: "Zurückgezogen"}] },
                { name: "Frustriert", children: [{name: "Ärgerlich"}, {name: "Erzürnt"}] },
                { name: "Aggressiv", children: [{name: "Feindlich"}, {name: "Provoziert"}] },
                { name: "Rasend", children: [{name: "Eifersüchtig"}, {name: "Aufgebracht"}] },
                { name: "Bitter", children: [{name: "Misshandelt"}, {name: "Empört"}] },
                { name: "Erniedrigt", children: [{name: "Verspottet"}, {name: "Nicht respektiert"}] },
                { name: "Im Stich gelassen", children: [{name: "Nachtragend"}, {name: "Verraten"}] }
            ]
        },
        {
            name: "Ängstlich", color: "#54a7c8",
            children: [
                { name: "Bedroht", children: [{name: "Ungeschützt"}, {name: "Nervös"}] },
                { name: "Zurückgewiesen", children: [{name: "Verfolgt"}, {name: "Ausgeschlossen"}] },
                { name: "Schwach", children: [{name: "Unbedeutend"}, {name: "Wertlos"}] },
                { name: "Unsicher", children: [{name: "Unterlegen"}, {name: "Unzulänglich"}] },
                { name: "Angespannt", children: [{name: "Beunruhigt"}, {name: "Besorgt"}] },
                { name: "Verängstigt", children: [{name: "Erschrocken"}, {name: "Hilflos"}] }
            ]
        }
    ]
};

// --- 2. SETUP ---
const svg = document.getElementById('wheel-container');
const infoBox = document.getElementById('info-box');

const width = 900;
const height = 900;
const centerX = width / 2;
const centerY = height / 2;
const maxRadius = 420; 
const levels = 3; 
const ringWidth = maxRadius / levels;

// --- 3. GEWICHTUNG ---
function calculateWeights(node) {
    if (!node.children || node.children.length === 0) {
        node.weight = 1;
    } else {
        node.weight = node.children.reduce((sum, child) => sum + calculateWeights(child), 0);
    }
    return node.weight;
}
const totalWeight = calculateWeights(emotionsData);

// --- 4. MATHEMATIK ---
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeArc(x, y, innerRadius, outerRadius, startAngle, endAngle) {
    const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
    const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
    const startInner = polarToCartesian(x, y, innerRadius, endAngle);
    const endInner = polarToCartesian(x, y, innerRadius, startAngle);
    // Ein kleiner Ausgleich, damit Kreise sauber geschlossen werden
    const sweepFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
        "M", startOuter.x, startOuter.y,
        "A", outerRadius, outerRadius, 0, sweepFlag, 0, endOuter.x, endOuter.y,
        "L", endInner.x, endInner.y,
        "A", innerRadius, innerRadius, 0, sweepFlag, 1, startInner.x, startInner.y,
        "Z"
    ].join(" ");
}

// --- 5. ZEICHNEN ---
function drawWheel(node, depth, startAngle, sweepAngle, pathText, parentColor) {
    if (depth > 0) {
        const currentPath = pathText ? `${pathText} > ${node.name}` : node.name;
        const innerRadius = (depth - 1) * ringWidth;
        const outerRadius = depth * ringWidth;
        const color = node.color || parentColor;

        // A) SVG Pfad (das farbige Tortenstück) zeichnen
        const pathData = describeArc(centerX, centerY, innerRadius, outerRadius, startAngle, startAngle + sweepAngle);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", color);
        path.classList.add("slice");
        path.addEventListener("mouseover", () => infoBox.textContent = currentPath);
        svg.appendChild(path);

        // B) Text platzieren und radial rotieren
        const midAngle = startAngle + sweepAngle / 2;
        const textRadius = innerRadius + (outerRadius - innerRadius) / 2;
        const textCoords = polarToCartesian(centerX, centerY, textRadius, midAngle);
        
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElement.textContent = node.name;
        textElement.classList.add("slice-text");

        // LÖSUNG FÜR DIE ROTATION: 
        // Wir ziehen 90 Grad vom Mittelwinkel ab, damit der Text exakt vom Zentrum nach außen "strahlt".
        const rotation = midAngle - 90;
        
        textElement.setAttribute("transform", `translate(${textCoords.x}, ${textCoords.y}) rotate(${rotation})`);
        svg.appendChild(textElement);

        parentColor = color;
    }

    // C) Untergefühle zeichnen
    if (node.children && node.children.length > 0) {
        let currentAngle = startAngle;
        node.children.forEach(child => {
            const childSweep = (child.weight / node.weight) * sweepAngle;
            const newPathText = depth === 0 ? "" : (pathText ? `${pathText} > ${node.name}` : node.name);
            drawWheel(child, depth + 1, currentAngle, childSweep, newPathText, parentColor);
            currentAngle += childSweep;
        });
    }
}

// --- 6. INITIALISIERUNG ---
// Wir berechnen den Startwinkel so, dass das allererste Element ("Schlecht") 
// exakt oben auf der 12-Uhr Position zentriert ist, wie im Foto.
const firstChildWeight = emotionsData.children[0].weight;
const initialAngle = -((firstChildWeight / totalWeight) * 360) / 2;

drawWheel(emotionsData, 0, initialAngle, 360, "", null);

// Tooltip zurücksetzen
svg.addEventListener("mouseleave", () => {
    infoBox.textContent = "Fahre mit der Maus über das Rad...";
});