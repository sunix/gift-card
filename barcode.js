// barcode.js - Small wrapper around bwip-js
// Renders a real scannable barcode in a <canvas> placed in the container

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

// Map UI formats to bwip-js names
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

// Validate and normalize: clean and check expected lengths (EAN/UPC)
function normalizeAndValidate(value, format) {
    let v = String(value).replace(/\s+/g, '');
    if (!v) throw new Error('Empty value.');

    switch (format) {
        case 'EAN13':
            if (!/^\d{12,13}$/.test(v)) throw new Error('EAN-13 expects 12 or 13 digits.');
            break;
        case 'EAN8':
            if (!/^\d{7,8}$/.test(v)) throw new Error('EAN-8 expects 7 or 8 digits.');
            break;
        case 'UPC':
            if (!/^\d{11,12}$/.test(v)) throw new Error('UPC-A expects 11 or 12 digits.');
            break;
        case 'ITF14':
            if (!/^\d{13,14}$/.test(v)) throw new Error('ITF-14 expects 13 or 14 digits.');
            break;
        case 'MSI':
            if (!/^\d+$/.test(v)) throw new Error('MSI is numeric only.');
            break;
        default:
            // CODE128 / CODE39 / CODABAR: let them through (bwip-js handles them)
            break;
    }
    return v;
}

/**
 * Render a scannable barcode in a DOM container (selector or element)
 * @param {string|Element} containerSelector - a div that will hold the <canvas>
 * @param {string} value - the data to encode
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
        container.innerHTML = '<p>Format not supported.</p>';
        return;
    }

    let text;
    try {
        text = normalizeAndValidate(value, format);
    } catch (e) {
        container.innerHTML = `<p style="color:#c00">${e.message}</p>`;
        return;
    }

    // Prepare the canvas (recreate each render to be clean)
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    container.appendChild(canvas);

    try {
        // bwip-js options: scale = module width in px; height = bar height in mm
        const bwipOpts = {
            bcid,
            text,                  // data
            scale: options.scale ?? 3,
            height: options.height ?? 15, // mm (approx 150 px with scale 3)
            includetext: options.includetext !== false,
            textxalign: 'center',
            textsize: options.textsize ?? 12, // px font size
            paddingwidth: 10,      // quiet zones left/right
            paddingheight: 10,
            backgroundcolor: 'FFFFFF',
        };

        // Minor adjustments per format
        if (format === 'CODE39') {
            bwipOpts.includecheck = false; // Standard Code39 without checksum
        }
        if (format === 'EAN13' || format === 'EAN8' || format === 'UPC' || format === 'ITF14') {
            // bwip-js calculates checksum if missing
            // nothing to do, just provide 12/7/11/13 digits
        }

        // Render
        bwipjs.toCanvas(canvas, bwipOpts);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Failed to render barcode.</p>';
    }
}

// Global exports for app.js
window.BarcodeFormats = BarcodeFormats;
window.renderBarcode = renderBarcode;
