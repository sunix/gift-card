// barcode.js — petit wrapper autour de bwip-js
// Rend un vrai code-barres scannable dans un <canvas> placé dans le conteneur

const BarcodeFormats = {
    CODE128: 'CODE128',
    CODE39: 'CODE39',
    EAN13:  'EAN13',
    EAN8:   'EAN8',
    UPC:    'UPC',
    ITF14:  'ITF14',
    MSI:    'MSI',
    CODABAR:'CODABAR',
};

// Map formats UI -> noms bwip-js
const BWIP_MAP = {
    CODE128: 'code128',
    CODE39:  'code39',
    EAN13:   'ean13',
    EAN8:    'ean8',
    UPC:     'upca',
    ITF14:   'itf14',
    MSI:     'msi',
    CODABAR: 'rationalizedCodabar',
};

// Valide/minor : nettoie et vérifie les longueurs attendues (EAN/UPC)
function normalizeAndValidate(value, format) {
    let v = String(value).replace(/\s+/g, '');
    if (!v) throw new Error('Valeur vide.');

    switch (format) {
        case 'EAN13':
            if (!/^\d{12,13}$/.test(v)) throw new Error('EAN-13 attend 12 ou 13 chiffres.');
            break;
        case 'EAN8':
            if (!/^\d{7,8}$/.test(v)) throw new Error('EAN-8 attend 7 ou 8 chiffres.');
            break;
        case 'UPC':
            if (!/^\d{11,12}$/.test(v)) throw new Error('UPC-A attend 11 ou 12 chiffres.');
            break;
        case 'ITF14':
            if (!/^\d{13,14}$/.test(v)) throw new Error('ITF-14 attend 13 ou 14 chiffres.');
            break;
        case 'MSI':
            if (!/^\d+$/.test(v)) throw new Error('MSI est numérique uniquement.');
            break;
        default:
            // CODE128 / CODE39 / CODABAR : on laisse passer (bwip-js gère)
            break;
    }
    return v;
}

/**
 * Rend un code-barres scannable dans un conteneur DOM (selector ou élément)
 * @param {string|Element} containerSelector - un div qui accueillera le <canvas>
 * @param {string} value - la donnée à encoder
 * @param {object} options - { format, scale, height, includetext }
 */
function renderBarcode(containerSelector, value, options = {}) {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) return;

    const format = options.format || BarcodeFormats.CODE128;
    const bcid = BWIP_MAP[format];
    if (!bcid) {
        container.innerHTML = '<p>Format non supporté.</p>';
        return;
    }

    let text;
    try {
        text = normalizeAndValidate(value, format);
    } catch (e) {
        container.innerHTML = `<p style="color:#c00">${e.message}</p>`;
        return;
    }

    // Prépare le canvas (on recrée à chaque rendu pour être propre)
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    container.appendChild(canvas);

    try {
        // Options bwip-js : scale = largeur module px ; height = hauteur barres en mm
        const bwipOpts = {
            bcid,
            text,                  // données
            scale: options.scale ?? 3,
            height: options.height ?? 15, // mm (≈ 150 px avec scale 3)
            includetext: options.includetext !== false,
            textxalign: 'center',
            textsize: options.textsize ?? 12, // px police
            paddingwidth: 10,      // zones calmes à gauche/droite
            paddingheight: 10,
            backgroundcolor: 'FFFFFF',
        };

        // Petits réglages par format
        if (format === 'CODE39') {
            bwipOpts.includecheck = false; // Code39 standard sans checksum
        }
        if (format === 'EAN13' || format === 'EAN8' || format === 'UPC' || format === 'ITF14') {
            // bwip-js calcule le checksum si manquant
            // rien à faire, juste fournir 12/7/11/13 chiffres
        }

        // Rendu
        bwipjs.toCanvas(canvas, bwipOpts);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Échec du rendu du code-barres.</p>';
    }
}

// Exports globaux pour app.js
window.BarcodeFormats = BarcodeFormats;
window.renderBarcode = renderBarcode;
