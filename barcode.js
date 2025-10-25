// Barcode Visual Generator using Canvas
// Generates barcode images based on actual barcode standards
// CODE128 implementation follows the standard specification for scannable barcodes

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

// CODE128 encoding patterns - each pattern is 11 modules (bars/spaces)
// Pattern format: 1=black bar, 0=white space, read left to right
const CODE128_PATTERNS = [
    '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
    '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
    '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
    '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
    '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
    '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
    '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
    '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
    '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
    '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
    '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
    '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
    '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
    '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
    '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
    '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
    '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
    '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
    '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
    '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
    '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
    '11010011100', '1100011101011' // Stop pattern
];

// CODE128 start codes
const CODE128_START_A = 103;
const CODE128_START_B = 104;
const CODE128_START_C = 105;

// Encode data using CODE128-C (numeric pairs) or CODE128-B (ASCII)
function encodeCODE128(data) {
    const dataStr = data.toString();
    let encoded = [];
    let checksum = 0;
    
    // Check if data is all numeric and even length - use Code C for efficiency
    const isNumeric = /^\d+$/.test(dataStr);
    
    if (isNumeric && dataStr.length % 2 === 0) {
        // Use Code C (encodes pairs of digits)
        encoded.push(CODE128_START_C);
        checksum = CODE128_START_C;
        
        for (let i = 0; i < dataStr.length; i += 2) {
            const pair = parseInt(dataStr.substr(i, 2));
            encoded.push(pair);
            checksum += pair * ((i / 2) + 1);
        }
    } else if (isNumeric && dataStr.length % 2 === 1) {
        // Odd length numeric - start with B for first char, then switch to C
        encoded.push(CODE128_START_B);
        checksum = CODE128_START_B;
        
        // First digit using Code B
        const firstChar = dataStr.charCodeAt(0) - 32;
        encoded.push(firstChar);
        checksum += firstChar * 1;
        
        // Switch to Code C
        encoded.push(99); // Code C
        checksum += 99 * 2;
        
        // Rest as pairs
        for (let i = 1; i < dataStr.length; i += 2) {
            const pair = parseInt(dataStr.substr(i, 2));
            encoded.push(pair);
            checksum += pair * (((i - 1) / 2) + 3);
        }
    } else {
        // Use Code B for ASCII characters
        encoded.push(CODE128_START_B);
        checksum = CODE128_START_B;
        
        for (let i = 0; i < dataStr.length; i++) {
            const charCode = dataStr.charCodeAt(i) - 32;
            encoded.push(charCode);
            checksum += charCode * (i + 1);
        }
    }
    
    // Add checksum
    checksum = checksum % 103;
    encoded.push(checksum);
    
    return encoded;
}

// Generate CODE128 barcode pattern string
function generateCODE128Pattern(data) {
    const encoded = encodeCODE128(data);
    let pattern = '';
    
    // Add each encoded value's pattern
    for (const value of encoded) {
        pattern += CODE128_PATTERNS[value];
    }
    
    // Add stop pattern
    pattern += CODE128_PATTERNS[106]; // Stop pattern
    
    return pattern;
}

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
    
    // For CODE128, use proper encoding
    if (format === BarcodeFormats.CODE128) {
        try {
            const pattern = generateCODE128Pattern(value);
            const barWidth = width;
            const totalWidth = pattern.length * barWidth + 20; // Add margins
            
            canvas.width = totalWidth;
            canvas.height = height + (displayValue ? 40 : 10);
            
            // Fill white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw bars based on pattern
            ctx.fillStyle = '#000000';
            let x = 10; // Left margin
            
            for (let i = 0; i < pattern.length; i++) {
                if (pattern[i] === '1') {
                    ctx.fillRect(x, 10, barWidth, height);
                }
                x += barWidth;
            }
            
            // Display value
            if (displayValue) {
                ctx.fillStyle = '#000000';
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(value, canvas.width / 2, canvas.height - 10);
            }
            
            // Replace element content with canvas
            if (element.tagName === 'SVG') {
                element.parentNode.replaceChild(canvas, element);
            } else {
                element.innerHTML = '';
                element.appendChild(canvas);
            }
            return;
        } catch (e) {
            console.error('CODE128 generation failed:', e);
            element.innerHTML = '<p>Barcode could not be generated</p>';
            return;
        }
    }
    
    // For other formats, use the decorative pattern generation
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
        default:
            numBars = chars.length * 6 + 12;
            patternMultiplier = 7;
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
