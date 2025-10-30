# Store Logo System

This application uses **fallback SVG logos** for store branding. Due to CORS (Cross-Origin Resource Sharing) restrictions on external retailer websites, the app cannot directly load official logos from their servers.

## CORS Limitation

External retailer websites typically don't allow cross-origin image loading, which means browsers block attempts to load their logos directly. This is a security feature that protects their assets.

**Error you might see:**
```
Access to image at 'https://www.magasins-u.com/...' from origin 'https://yoursite.github.io' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

## Current Implementation

The app uses **high-quality fallback SVG logos** that match each store's brand colors. These work reliably without any CORS issues and look great at any size.

## Using Official Logos (Manual Process)

If you want to use official logos instead of the generated SVGs, you can manually download and replace them:

### Option 1: Download and Replace SVG Files

1. Download the official logo from the retailer's website
2. Save it as SVG (or convert to SVG format)
3. Replace the file in `store-logos/[store-name].svg`
4. The app will automatically use your local copy

### Option 2: Use a CORS Proxy (Advanced)

For dynamic loading, you could set up your own CORS proxy service, but this requires additional infrastructure and is not recommended for simple static hosting.

## Official Logo Sources

Reference URLs for official logos (for manual download):

- **Magasins U**: https://www.magasins-u.com/content/dam/ufrfront/edito/assets-u/dam/logos/logo-u.svg
- **Decathlon**: https://www.decathlon.fr/themes/custom/dc_theme/assets/images/logo-decathlon.svg
- **Leroy Merlin**: https://www.leroymerlin.fr/assets/logo-lr.svg
- **Picard**: https://www.picard.fr/assets/images/logo.svg
- **Franprix**: https://www.franprix.fr/static/media/logo-franprix.svg
- **Fnac**: https://static.fnac-static.com/assets/logo-fnac.svg
- **McDonald's**: https://www.mcdonalds.com/content/dam/sites/usa/nfl/icons/arches-logo_108x108.jpg
- **Truffaut**: https://www.truffaut.com/skin/frontend/truffaut/default/images/logo.svg
- **E. Leclerc**: https://www.e.leclerc/img/logo-leclerc.svg

## Fallback SVG Logos

The current SVG logos in `store-logos/` directory are:
- Simple, clean designs
- Match each store's official brand colors
- Scalable to any size without quality loss
- Work reliably without network dependencies
- No CORS issues

## Adding New Stores

1. Add store configuration to `stores.json`:
```json
{
  "name": "Store Name",
  "matchStrings": ["store", "store name"],
  "iconUrl": "https://example.com/logo.svg",
  "icon": "store-logos/store-name.svg",
  "color": "#000000",
  "background": "linear-gradient(135deg, #000000, #333333)"
}
```

2. Create an SVG logo in `store-logos/store-name.svg` matching the brand

3. The app will use your local SVG logo

## Why Not Use CORS Proxies?

While there are public CORS proxy services, they:
- Add latency and unreliability
- May violate terms of service
- Can be blocked or rate-limited
- Require trusting a third party
- Not suitable for production use

For a static GitHub Pages site, local SVG fallbacks are the most reliable solution.
