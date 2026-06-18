# Animation section — native integration

Adds the Rive animation library to the **Animation** tab of Groww Visual Assets,
built natively in the site's own vanilla HTML/CSS/JS (no iframe, no React).

## What changed

| File | Change |
|------|--------|
| `animations.json` | **NEW** — manifest the site already fetches at root. `{ items: [{ name, src, tags }] }`. 8 entries. |
| `animations/` | **NEW** — 8 real Groww `.riv` files referenced by the manifest. |
| `index.html` | Added the `#anim-viewer` modal (stage + transport controls + metadata panel); updated the Animation empty-state copy. |
| `styles.css` | Added `.anim-viewer*` styles + card "↗ View" affordance. All via existing MDS tokens; no new colors. |
| `app.js` | Added the animation viewer module: play/pause, restart, scrubber, loop, speed, live metadata inspection (artboards / state machines / animations / view models / inputs), card-click + keyboard wiring, Escape-to-close. The existing `renderAnimations()`/`initRiveCanvases()` gallery is reused as-is (one line: cards now carry `data-anim-name` + are focusable). |

Nothing else in the site was touched — Icons and Illustrations are unchanged.

## How it works (reuses the site's existing machinery)
- The Animation tab was already wired to fetch `animations.json` and render `.riv`
  via the global `@rive-app/canvas` runtime. It only showed 0 because the manifest
  was missing. We added the manifest + assets, then layered a click-to-open viewer
  on top — exactly mirroring the existing `illu-viewer` pattern.

## Verified
- `node --check app.js` clean; `animations.json` valid; all 8 `src` paths resolve.
- Headless (Puppeteer) end-to-end: tab count = 8, 8 cards render, grid Rive canvas
  paints, viewer opens on click, metadata panel populates (5 sections from the live
  instance), viewer canvas paints, Escape closes. All checks passed.

## Adding more animations later
1. Drop the `.riv` (or `.lottie`/`.json`) into `animations/`.
2. Add an entry to `animations.json`: `{ "name": "...", "src": "animations/<file>", "tags": ["..."] }`.
That's it — the gallery + viewer pick it up automatically.

## Getting this onto the live site (repo: anishsoni258-svg/Visual_Library)
The repo is owned by `anishsoni258-svg`, so:
- **If you have write access:** push these changed files to a branch and open a PR to `main` (Vercel auto-deploys on merge).
- **If not:** fork the repo, commit these files to your fork, open a PR.
- **No-git fallback:** upload the changed files via the GitHub web UI
  ("Add file → Upload files") on a branch, then open the PR.

Changed/added paths to include:
```
index.html
styles.css
app.js
animations.json
animations/   (all 8 .riv)
```
