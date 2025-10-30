# Store Logo Download System

This application automatically downloads official store logos from retailer websites and caches them locally. If a download fails or the URL is unavailable, it falls back to generated SVG logos.

## How it Works

1. **stores.json** contains both:
   - `iconUrl`: Official logo URL from the store's website
   - `icon`: Local fallback path to generated SVG logo

2. **download-logos.js** script:
   - Attempts to download logos from official URLs
   - Caches downloaded logos for 7 days
   - Falls back to generated SVG if download fails
   - Runs automatically on `npm install` via postinstall hook

3. **Fallback SVG logos**:
   - Simple, brand-colored SVG graphics
   - Always available as backup
   - Located in `store-logos/` directory

## Manual Logo Download

To manually refresh logos:

```bash
npm run download-logos
```

## Store Logo URLs

Current official logo sources:

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

To add a new store:

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

3. Run `npm run download-logos` to fetch the official logo
