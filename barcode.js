// Simple Barcode-Style Visual Generator using Canvas
// Creates a barcode-like visual representation based on the card number
// Note: This generates decorative barcode-style images for visual identification,
// not functional barcodes compliant with standards like CODE128 or EAN-13.
// For production scanning requirements, use a library like JsBarcode or QuaggaJS.

const BarcodeFormats = {
    CODE128: 'CODE128',
    CODE39: 'CODE39',
    EAN13: 'EAN13',
    EAN8: 'EAN8',
    UPC: 'UPC',
    ITF14: 'ITF14',
    MSI: 'MSI',
    CODABAR: 'CODABAR'
};

const JsBarcode = (selector, value, options = {}) => {
    const element = typeof selector === 'string' 
        ? document.querySelector(selector) 
        : selector;
    
    if (!element) return;
    
    // Safety check: ensure value is not empty
    if (!value || value.toString().length === 0) {
        element.innerHTML = '<p>Invalid barcode value</p>';
        return;
    }

    // Create canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Default options
    const width = options.width || 2;
    const height = options.height || 100;
    const displayValue = options.displayValue !== false;
    const format = options.format || BarcodeFormats.CODE128;
    
    // Simple barcode pattern - alternating bars
    // This creates a simplified visual barcode representation
    const chars = value.toString().split('');
    const barWidth = width;
    
    // Different formats have different characteristics
    let numBars, patternMultiplier, startBars, endBars;
    switch (format) {
        case BarcodeFormats.CODE39:
            numBars = chars.length * 7 + 10;
            patternMultiplier = 9;
            startBars = 3;
            endBars = 3;
            break;
        case BarcodeFormats.EAN13:
            numBars = 95; // Standard EAN-13 has 95 bars
            patternMultiplier = 7;
            startBars = 3;
            endBars = 3;
            break;
        case BarcodeFormats.EAN8:
            numBars = 67; // Standard EAN-8 has 67 bars
            patternMultiplier = 7;
            startBars = 3;
            endBars = 3;
            break;
        case BarcodeFormats.UPC:
            numBars = 95; // Standard UPC has 95 bars
            patternMultiplier = 7;
            startBars = 3;
            endBars = 3;
            break;
        case BarcodeFormats.ITF14:
            numBars = chars.length * 5 + 8;
            patternMultiplier = 5;
            startBars = 4;
            endBars = 4;
            break;
        case BarcodeFormats.MSI:
            numBars = chars.length * 8 + 6;
            patternMultiplier = 8;
            startBars = 2;
            endBars = 2;
            break;
        case BarcodeFormats.CODABAR:
            numBars = chars.length * 6 + 12;
            patternMultiplier = 7;
            startBars = 2;
            endBars = 2;
            break;
        case BarcodeFormats.CODE128:
        default:
            numBars = chars.length * 6 + 10;
            patternMultiplier = 11;
            startBars = 2;
            endBars = 2;
            break;
    }
    
    canvas.width = numBars * barWidth + 20;
    canvas.height = height + (displayValue ? 40 : 10);
    
    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bars
    ctx.fillStyle = '#000000';
    let x = 10;
    let seed = 0;
    
    // Start pattern
    for (let i = 0; i < startBars; i++) {
        ctx.fillRect(x, 10, barWidth, height);
        x += barWidth * 2;
    }
    
    // Data encoding (creates a visual pattern based on characters)
    // This creates a decorative barcode-like image, not a standards-compliant scannable barcode
    chars.forEach((char, idx) => {
        const code = char.charCodeAt(0);
        seed = (seed + code) % 256;
        
        const iterations = Math.floor(numBars / chars.length);
        for (let i = 0; i < iterations; i++) {
            const bitPattern = ((seed + i + idx) * patternMultiplier + code) % 3;
            if (bitPattern > 0) {
                const barHeight = bitPattern === 2 ? height * 0.95 : height;
                ctx.fillRect(x, 10, barWidth * bitPattern, barHeight);
            }
            x += barWidth * 2;
        }
    });
    
    // End pattern
    for (let i = 0; i < endBars; i++) {
        ctx.fillRect(x, 10, barWidth, height);
        x += barWidth * 2;
    }
    
    // Display value and format
    if (displayValue) {
        ctx.fillStyle = '#000000';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(value, canvas.width / 2, canvas.height - 10);
    }
    
    // Replace SVG element with canvas
    if (element.tagName === 'SVG') {
        element.parentNode.replaceChild(canvas, element);
    } else {
        element.innerHTML = '';
        element.appendChild(canvas);
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.JsBarcode = JsBarcode;
    window.BarcodeFormats = BarcodeFormats;
}
