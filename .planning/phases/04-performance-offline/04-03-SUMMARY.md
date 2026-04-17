---
plan: 04-03
phase: 04-performance-offline
completed: 2026-04-17
duration_minutes: 3
tasks_completed: 1
tasks_total: 1
requirements_addressed: [PERF-02]
---

# Plan 04-03: PWA Icon Pipeline — Summary

One-liner: Generated the 4 PWA icon PNGs (192, 512, 512-maskable, 180 apple-touch) from an inline red-teardrop SVG via sharp, so plan 04-05's manifest can reference them at stable `public/` URLs.

## What was built

- `scripts/generate-pwa-icons.mjs` (71 lines, Node ESM + sharp).
  - Source: inline SVG string of the assigned-table teardrop pin from FloorPlan (fill `#d90429`, white 2px stroke).
  - Outputs four PNGs to `public/`:
    - `pwa-192.png` — 192×192, normal icon.
    - `pwa-512.png` — 512×512, normal icon.
    - `pwa-512-maskable.png` — 512×512 with ~10% safe-zone padding per W3C maskable icon spec.
    - `apple-touch-icon.png` — 180×180, no rounding (iOS applies its own mask).
- `package.json`: new `generate-pwa-icons` script so the pipeline can be re-run.

## Artifact sizes

| File | Size |
|------|------|
| pwa-192.png | 5.1 KB |
| pwa-512.png | 15.3 KB |
| pwa-512-maskable.png | 13.1 KB |
| apple-touch-icon.png | 4.7 KB |

Total: ~38 KB committed to repo.

## Gates

- Script runs deterministically: `npm run generate-pwa-icons` regenerates all 4 files with identical bytes each time.
- No new npm deps (sharp was already installed from Phase 3).
- No changes to any existing module's exports or behavior — pure additive asset pipeline.

## Deviations

None from plan intent. Assembly order: wrote script → added npm script → ran generator → committed outputs, matching the plan's single task.

## Downstream

Plan 04-05's `VitePWA({ manifest.icons: [...] })` can now reference `/pwa-192.png`, `/pwa-512.png`, `/pwa-512-maskable.png` (in manifest) and `/apple-touch-icon.png` (in `index.html` `<link rel="apple-touch-icon">`). Vite's `public/` passthrough handles copy-to-dist at build time; plan 04-06's build-smoke script will verify their presence in `dist/`.

## Files committed

- `scripts/generate-pwa-icons.mjs`
- `package.json` (added `generate-pwa-icons` script)
- `public/pwa-192.png`
- `public/pwa-512.png`
- `public/pwa-512-maskable.png`
- `public/apple-touch-icon.png`

## Self-check

- [x] Script exists and is executable via `node scripts/generate-pwa-icons.mjs`
- [x] All 4 PNGs exist in `public/` with expected sizes
- [x] Script re-run produces byte-identical outputs
- [x] `npm run generate-pwa-icons` works
- [x] SUMMARY.md committed before worktree teardown
