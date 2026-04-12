---
phase: 01-data-integrity
plan: 01
subsystem: floor-plan-config
tags: [data-integrity, coordinates, typescript]
requires: []
provides:
  - "Percentage-based floorPlan.json (self-contained, no canvas dims)"
  - "FloorPlanConfig interface aligned with percentage JSON shape"
  - "Distinct coordinates for tables 46 and 47"
affects:
  - src/config/floorPlan.json
  - src/components/FloorPlan.tsx
tech_stack:
  added: []
  patterns:
    - "Use img.naturalWidth/naturalHeight for intrinsic aspect ratio"
key_files:
  created: []
  modified:
    - src/config/floorPlan.json
    - src/components/FloorPlan.tsx
decisions:
  - "Applied Plan 02 pre-conditions (remove canvasWidth/canvasHeight reads) to keep strict TS build green at Wave 1 boundary"
  - "Resolved table 47 duplicate to (0.6858, 0.3655) per RESEARCH Option A"
metrics:
  tasks: 1
  duration: ~5m
  completed: 2026-04-12
---

# Phase 01 Plan 01: JSON Migration Summary

Migrated `src/config/floorPlan.json` from pixel coordinates (with canvasWidth/canvasHeight) to self-contained percentage coordinates (4-decimal floats in [0,1]), fixed the duplicate 46/47 table bug, and aligned the `FloorPlanConfig` TS interface in lockstep.

## What Changed

- **`src/config/floorPlan.json`** — Removed `canvasWidth` and `canvasHeight` keys. Rewrote all 54 `tablePositions` entries as `{ x, y }` percentages (xPixel/3300, yPixel/2517, rounded to 4 decimals). Table 47 moved to `(0.6858, 0.3655)`, distinct from table 46 at `(0.6576, 0.3655)`.
- **`src/components/FloorPlan.tsx`** — Dropped `canvasWidth: number` and `canvasHeight: number` from the `FloorPlanConfig` interface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied Plan 02 pre-conditions to keep strict TS build green**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** After removing `canvasWidth`/`canvasHeight` from the `FloorPlanConfig` interface, strict TS surfaced four TS2339 errors (`Property 'canvasWidth' does not exist on type 'FloorPlanConfig'`) at render sites in `FloorPlan.tsx` (lines 42, 87, 88). The plan's contingency note explicitly authorized applying Plan 02 render-site fixes when this happens, in order to keep `npm run build` green at the Wave 1 gate.
- **Fix:**
  - Line 42 (`handleEnlargedImageLoad`): replaced `config.canvasWidth / config.canvasHeight` with `img.naturalWidth / img.naturalHeight` for aspect ratio (intrinsic image dims, no config dependency).
  - Lines 87-88 (`scaleFactor`, `enlargedScaleFactor`): since coordinates are now percentages in `[0,1]`, the scale factor equals the displayed width in pixels (so `position.x * scaleFactor` still yields a pixel offset). Left a comment noting Plan 02 will introduce ResizeObserver and cleaner render math.
- **Files modified:** `src/components/FloorPlan.tsx`
- **Commit:** 7826f39

## Verification

- `npm run build` exits 0 (green, clean; tsc + vite build complete with no errors)
- `grep -c '"canvasWidth"' src/config/floorPlan.json` → 0
- `grep -c '"canvasHeight"' src/config/floorPlan.json` → 0
- `grep -oE '"(x|y)": [0-9]+\.[0-9]{4}' src/config/floorPlan.json | wc -l` → 108 (54 x's + 54 y's, all 4 decimals)
- Table 46 = `{x: 0.6576, y: 0.3655}`, Table 47 = `{x: 0.6858, y: 0.3655}` — distinct
- All 54 entries (`"1"`..`"54"`) present; all coordinates in `[0,1]`
- `interface FloorPlanConfig` block contains no `canvasWidth` or `canvasHeight`

## Commits

- `7826f39` — feat(01-01): migrate floorPlan.json to percentages and fix table 47

## Requirements Completed

- DATA-01 — Tables 46 and 47 now have distinct coordinates
- DATA-02 — Coordinate system migrated to percentages (resilient to image swaps)

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/config/floorPlan.json (percentage-based, 54 entries)
- FOUND: src/components/FloorPlan.tsx (interface aligned, render sites updated)
- FOUND: commit 7826f39
- Build verified green.
