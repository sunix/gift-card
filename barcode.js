// Simple Barcode-Style Visual Generator using Canvas
// Creates a barcode-like visual representation based on the card number
// Note: This generates decorative barcode-style images for visual identification,
// not functional barcodes compliant with standards like CODE128 or EAN-13.
// For production scanning requirements, use a library like JsBarcode or QuaggaJS.

const JsBarcode = (selector, value, options = {}) => {
    const element = typeof selector === 'string' 
        ? document.querySelector(selector) 
        : selector;
    
    if (!element) return;

    // Create canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Default options
    const width = options.width || 2;
    const height = options.height || 100;
    const displayValue = options.displayValue !== false;
    
    // Simple barcode pattern - alternating bars
    // This creates a simplified visual barcode representation
    const chars = value.toString().split('');
    const barWidth = width;
    const numBars = chars.length * 6 + 10; // Approximate bars per character
    
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
    for (let i = 0; i < 2; i++) {
        ctx.fillRect(x, 10, barWidth, height);
        x += barWidth * 2;
    }
    
    // Data encoding (creates a visual pattern based on characters)
    // This creates a decorative barcode-like image, not a standards-compliant scannable barcode
    chars.forEach((char, idx) => {
        const code = char.charCodeAt(0);
        seed = (seed + code) % 256;
        
        for (let i = 0; i < 6; i++) {
            const bitPattern = ((seed + i + idx) * 7 + code) % 3;
            if (bitPattern > 0) {
                const barHeight = bitPattern === 2 ? height * 0.95 : height;
                ctx.fillRect(x, 10, barWidth * bitPattern, barHeight);
            }
            x += barWidth * 2;
        }
    });
    
    // End pattern
    for (let i = 0; i < 2; i++) {
        ctx.fillRect(x, 10, barWidth, height);
        x += barWidth * 2;
    }
    
    // Display value
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
}
