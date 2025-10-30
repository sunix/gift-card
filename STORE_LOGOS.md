# Store Logo System

This application uses a **client-side logo loading system** that works perfectly with static hosting (like GitHub Pages) without any build steps.

## How It Works

The system automatically tries to load official store logos from retailer websites and gracefully falls back to local SVG logos if the official logos fail to load.

### Client-Side Logo Loading

1. **stores.json** contains:
   - `iconUrl`: Official logo URL from the store's website
   - `icon`: Local fallback SVG path

2. **app.js** automatically:
   - Attempts to load each official logo URL in the background
   - Detects if the logo loads successfully (handles CORS, 404s, etc.)
   - Uses the official logo if successful
   - Falls back to the local SVG if loading fails
   - All done dynamically in the browser, no build step needed!

3. **Fallback SVG logos**:
   - Always available as reliable backup
   - Located in `store-logos/` directory
   - Simple brand-colored graphics

## Benefits

✅ **No build step required** - Works with pure static hosting  
✅ **GitHub Pages compatible** - No Node.js or npm needed  
✅ **Automatic fallback** - Always shows something, never broken images  
✅ **Dynamic loading** - Tries to use official logos when available  
✅ **CORS-aware** - Handles cross-origin restrictions gracefully  
✅ **Offline-friendly** - Falls back to cached SVGs  

## Official Logo URLs

The system attempts to load from:

- **Magasins U**: https://www.magasins-u.com/content/dam/ufrfront/edito/assets-u/dam/logos/logo-u.svg
- **Decathlon**: https://www.decathlon.fr/themes/custom/dc_theme/assets/images/logo-decathlon.svg
- **Leroy Merlin**: https://www.leroymerlin.fr/assets/logo-lr.svg
- **Picard**: https://www.picard.fr/assets/images/logo.svg
- **Franprix**: https://www.franprix.fr/static/media/logo-franprix.svg
- **Fnac**: https://static.fnac-static.com/assets/logo-fnac.svg
- **McDonald's**: https://www.mcdonalds.com/content/dam/sites/usa/nfl/icons/arches-logo_108x108.jpg
- **Truffaut**: https://www.truffaut.com/skin/frontend/truffaut/default/images/logo.svg
- **E. Leclerc**: https://www.e.leclerc/img/logo-leclerc.svg

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

2. Create fallback SVG in `store-logos/store-name.svg`

3. The app will automatically try the official URL and fallback as needed!

## Browser Console

Check the browser console to see which logos loaded successfully:
- ✓ Loaded official logo for [Store Name]
- ✗ Using fallback logo for [Store Name]
