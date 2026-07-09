# Animation section — native integration (Phase B)

The **Animation** tab is now the full Rive animation library from `latest rive repo/`,
mounted natively into Groww Visual Library (no iframe).

Icons and Illustrations remain sourced from the original Groww Visual Library data:
- Icons: deployed `manifest.json` restored exactly (`488` Mint icon entries; names remain `mds_ic_huge_*`).
- Illustrations: deployed `illustrations.json` restored exactly (`148` entries) plus all `296` light/dark SVG assets.
- Figma source anchors checked:
  - Mint Icon library: `CJJaQtz4CTxkwEQ4fzecTe`, node `9221:256` (`mds_ic_huge_id`).
  - Mint Illustrations Library: `RconsMlkjX3frOjBDfvFKQ`, node `9503:4606` (`Images` canvas with light/dark symbol pairs).

## Architecture

| File | Role |
|------|------|
| `rive-section.js` | Animation tab engine (grid, viewer, upload, filters, search) — lazy-loaded |
| `lib/rive/*` | IndexedDB, seed, Rive helpers, filter engine |
| `conventions.html` | Naming guidelines page |
| `animations/` + `animations.json` | Sample `.riv` library |
| `wealth/*.json`, `prime/*.json` | Explicit empty secondary-brand manifests for clean no-asset states |
| `index.html` | `#panel-animation` markup + viewer/upload modals |
| `styles.css` | Appended `rv-*` component styles |
| `app.js` | Wires topbar search + tab switching; calls `initRiveSection()` on first Animation visit |

Reference folders retained intentionally (one level up, outside `latest visual library/`):
- `../latest rive repo/` — source snapshot used to port the native Rive experience.
- `../rive-animation-repo/` — React/source reference and Puppeteer dependency anchor.

## Run locally

```bash
cd "/Users/sagarda/Documents/new visual repo/latest visual library"
node server.mjs
# → http://localhost:8080/ (static site + /api auth endpoints)
# One-time credential setup: node scripts/setup-auth.mjs <username> <password>
```

Rive runtime: `@rive-app/canvas@2.38.1` (bumped from 2.21.6 for ViewModel metadata APIs).

## Verification

```bash
BASE_URL=http://localhost:8081 node scripts/verify-phase-b.mjs
BASE_URL=http://localhost:8081 node scripts/audit-site-deep.mjs
```

Checks:
- Icons tab: 488 original icon cards.
- Illustrations tab: 148 original illustration records, non-empty hero grid.
- Animation tab: 8 Rive tiles, search/filter/upload/viewer/conventions path.
- Viewer: opens with detected metadata.
- Conventions page: 10 sections.
- Deep audit: traverses primary flows, responsive layouts, accessibility basics, runtime errors, dependency observations, and conservative cleanup signals.
