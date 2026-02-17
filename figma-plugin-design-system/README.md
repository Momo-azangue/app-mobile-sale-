# Sales Figma Generator

This plugin generates a complete starter design system for the Sales app:

- `Foundations` page
  - color tokens
  - typography tokens
  - spacing tokens
- `Components` page
  - Button variants
  - Input variants
  - KPI Card variants
  - Sidebar component
  - Bottom mobile navigation component
- `App Screens` page
  - Login
  - Dashboard
  - Sales
  - Stocks
  - Clients
  - Settings
  - Desktop shell with sidebar

## How to run in Figma

1. Open Figma Desktop.
2. Create (or open) an empty design file.
3. Go to `Plugins` -> `Development` -> `Import plugin from manifest...`
4. Select `manifest.json` from this folder.
5. Run `Sales Design System Generator`.

## Notes

- The plugin is idempotent per run but will create new pages each time.
- Recommended: run it once in a fresh file.
- Token is **not required** to run this plugin.
