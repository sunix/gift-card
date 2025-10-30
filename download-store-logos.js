#!/usr/bin/env node
/**
 * Download store logos from official URLs
 * Falls back to existing SVG logos if download fails
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const storesConfig = require('./stores.json');
const logosDir = path.join(__dirname, 'store-logos');

// Ensure logos directory exists
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

/**
 * Download a file from URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(url).origin
      }
    }, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
        downloadFile(absoluteUrl, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Clean up on error
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Process each store logo
 */
async function processStore(store) {
  if (!store.iconUrl) {
    console.log(`ℹ ${store.name}: No iconUrl specified, using fallback`);
    return false;
  }

  // Determine file extension from URL
  const urlExt = path.extname(new URL(store.iconUrl).pathname).toLowerCase();
  const ext = urlExt || '.svg';
  const filename = store.icon.replace('.svg', ext);
  const outputPath = path.join(__dirname, filename);
  
  try {
    console.log(`⬇ Downloading logo for ${store.name}...`);
    await downloadFile(store.iconUrl, outputPath);
    console.log(`✓ Downloaded logo for ${store.name} to ${filename}`);
    
    // Update the icon path if extension changed
    if (ext !== '.svg' && fs.existsSync(outputPath)) {
      // Keep both files - the downloaded one and the fallback
      console.log(`  Fallback SVG still available: ${store.icon}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to download ${store.name} logo: ${error.message}`);
    console.log(`  Using fallback SVG: ${store.icon}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting logo download process...\n');
  
  const results = await Promise.all(
    storesConfig.map(store => processStore(store))
  );
  
  const successful = results.filter(r => r).length;
  const failed = results.length - successful;
  
  console.log(`\n✓ Download complete: ${successful} successful, ${failed} using fallback`);
  console.log('\nNote: Fallback SVG logos are always kept for reliability.');
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(0); // Don't fail the build
  });
}

module.exports = { downloadFile, processStore };
