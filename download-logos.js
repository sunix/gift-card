#!/usr/bin/env node
/**
 * Script to download official store logos from their websites
 * Falls back to generated SVG logos if download fails
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, outputPath)
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
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Process each store logo
 */
async function processStore(store) {
  const filename = store.icon;
  const outputPath = path.join(__dirname, filename);
  
  // Check if we already have the file
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    // If file is recent (less than 7 days old), skip download
    const age = Date.now() - stats.mtimeMs;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (age < maxAge) {
      console.log(`✓ Using cached logo for ${store.name}`);
      return true;
    }
  }
  
  if (!store.iconUrl) {
    console.log(`✓ ${store.name}: Using fallback logo (no URL provided)`);
    return false;
  }
  
  try {
    console.log(`⬇ Downloading logo for ${store.name}...`);
    await downloadFile(store.iconUrl, outputPath);
    console.log(`✓ Downloaded logo for ${store.name}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to download ${store.name} logo: ${error.message}`);
    console.log(`  Using fallback logo for ${store.name}`);
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
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { downloadFile, processStore };
