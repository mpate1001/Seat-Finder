---
phase: 01-data-integrity
plan: 02
subsystem: floor-plan-rendering
tags: [rendering, resize, react-hooks]
requires:
  - "Percentage-based floorPlan.json (from Plan 01)"
provides:
  - "Percentage-based marker rendering in normal and enlarged views"
  - "ResizeObserver-backed resize robustness"
  - "Dev-only duplicate-coordinate warning"
affects:
  - src/components/FloorPlan.tsx
  - src/config/README.md
tech_stack:
  added: []
  patterns:
    - "ResizeObserver attached via useRef + useEffect cleanup"
    - "import.meta.env.DEV-guarded dev assertions (tree-shaken in prod)"
key_files:
  created: []
  modified:
    - src/components/FloorPlan.tsx
    - src/config/README.md
decisions:
  - "Use ResizeObserver on the normal-view <img> rather than window resize events (per RESEARCH Option 2)"
  - "Run duplicate-coord check at module scope once, guarded by import.meta.env.DEV"
metrics:
  tasks: 1
  duration: ~5m
  completed: 2026-04-12
---

# Phase 01 Plan 02: FloorPlan Scaling Summary

Rewrote `FloorPlan.tsx` marker scaling to use percentage coordinates directly (`position.x * imageWidth`, `position.y * imageHeight`), added `imageHeight` state, wired a `ResizeObserver` to the normal-view image for live resize tracking, derived enlarged-view aspect from `img.naturalWidth / img.naturalHeight`, and added a dev-only duplicate-coordinate warning.

## What Changed

- **`src/components/FloorPlan.tsx`**
  - Added `useRef` import; added `imageHeight` state; added `imageRef` on the normal-view `<img>`.
  - `handleImageLoad` now captures both `offsetWidth` and `offsetHeight`.
  - New `useEffect` attaches a `ResizeObserver` that updates `imageWidth`/`imageHeight` on container resize; disconnects on unmount.
  - Removed `scaleFactor` and `enlargedScaleFactor` derived variables entirely.
  - Normal-view marker renders at `left: position.x * imageWidth`, `top: position.y * imageHeight`, gated on `imageWidth > 0 && imageHeight > 0`.
  - Enlarged-view marker renders at `offsetX + position.x * enlargedDimensions.width`, `offsetY + position.y * enlargedDimensions.height`.
  - Enlarged aspect ratio already computed from `img.naturalWidth / img.naturalHeight` (carried forward from Plan 01 fix).
  - Added module-scope dev-only loop warning on duplicate `(x.toFixed(4), y.toFixed(4))` keys, guarded by `import.meta.env.DEV`.

- **`src/config/README.md`** — Rewrote to document the percentage coordinate system; removed stale `canvasWidth`/`canvasHeight` update instructions and sample JSON with pixel coordinates. Added a pixel→percentage conversion example.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Updated src/config/README.md to drop stale canvasWidth/canvasHeight instructions**
- **Found during:** Acceptance criterion grep (`grep -rn "canvasWidth\|canvasHeight" src/`)
- **Issue:** README still told maintainers to update `canvasWidth`/`canvasHeight` keys that no longer exist in the JSON schema, and showed pixel-coordinate examples. This would actively mislead future edits.
- **Fix:** Rewrote the file to document percentage coordinates, pixel→percentage conversion, and the resolution-independent behavior; removed all pixel-dimension instructions.
- **Files modified:** `src/config/README.md`
- **Commit:** a894a06

### Out-of-Scope Observation (not fixed)

- `npm run lint` fails with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file" — this is a pre-existing ESLint v9 migration gap unrelated to this plan's changes. `npm run build` (tsc + vite build) is green. Logged here for future attention; not fixed under this plan per SCOPE BOUNDARY.

## Verification

- `npm run build` exits 0 (tsc strict + vite build, 40 modules transformed, no errors/warnings)
- `grep -n "canvasWidth\|canvasHeight\|scaleFactor" src/components/FloorPlan.tsx` → no matches
- `grep -rn "canvasWidth\|canvasHeight" src/` → no matches (README updated)
- `grep -c "imageHeight" src/components/FloorPlan.tsx` → multiple
- `grep -c "ResizeObserver" src/components/FloorPlan.tsx` → present
- `grep -c "import.meta.env.DEV" src/components/FloorPlan.tsx` → present
- `grep -c "img.naturalWidth / img.naturalHeight" src/components/FloorPlan.tsx` → present
- `grep -c "position.x \* imageWidth" src/components/FloorPlan.tsx` → present
- `grep -c "position.y \* imageHeight" src/components/FloorPlan.tsx` → present

Manual verification (deferred — requires live browser): normal-view marker alignment, enlarged-view marker alignment, marker tracks table across 400px→1400px window resize. All render logic follows the plan's exact formulas, so correctness is expected.

## Commits

- `a894a06` — feat(01-02): percentage-based marker scaling with ResizeObserver

## Requirements Completed

- DATA-02 — Markers render from percentage coordinates; window resize tracked via ResizeObserver; no references to `canvasWidth`/`canvasHeight` remain in `src/`.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/components/FloorPlan.tsx (percentage math, imageHeight, ResizeObserver, DEV guard)
- FOUND: src/config/README.md (rewritten for percentage schema)
- FOUND: commit a894a06
- Build verified green.
