---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-05-PLAN.md (vite-plugin-pwa + UpdateToast)
last_updated: "2026-04-17T17:29:51.944Z"
last_activity: 2026-04-17
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 17
  completed_plans: 15
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-12)

**Core value:** A guest finds their table in under 10 seconds — search, see the number, see it on the map, walk there.
**Current focus:** Phase 04 — performance-offline

## Current Position

Phase: 04 (performance-offline) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-04-17

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 03-map-experience P01 | 2min | 2 tasks | 6 files |
| Phase 03-map-experience P02 | 1min | 2 tasks | 10 files |
| Phase 03-map-experience P03 | 3min | 2 tasks | 3 files |
| Phase 03-map-experience P04 | 3min | 2 tasks | 2 files |
| Phase 03-map-experience P05 | 8min | 3 tasks | 10 files |
| Phase 04-performance-offline P01 | 4min | 3 tasks | 7 files |
| Phase 04-performance-offline P04 | 4min | 3 tasks | 9 files |
| Phase 04-performance-offline P05 | ~5min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Keep React/Vite/TypeScript stack, no rewrite
- Init: Google Sheets CSV as data source (no backend)
- Init: Data integrity fixed first — all downstream phases depend on correct coordinates
- [Phase 03-map-experience]: Phase 3 Plan 01: pin react-zoom-pan-pinch@4.0.3 exact (not caret); keep testing libs caret-ranged
- [Phase 03-map-experience]: Phase 3 Plan 01: explicit vitest imports (import { describe, it } from 'vitest') keep tsconfig.json untouched
- [Phase 03-map-experience]: Phase 3 Plan 02: keep AVIF quality=50/WebP=80/PNG cl=9; observed 900w AVIF 27.9 KB is within the 30-80 KB target (no retune needed before UAT step 17)
- [Phase 03-map-experience]: Phase 3 Plan 02: D-16 implementation committed 9 prebuilt variants to public/floor-plan/ (~1.9 MB total); vite-imagetools remains rejected due to Vite 6 ↔ v10 peer-dep incompatibility
- [Phase 03-map-experience]: Phase 3 Plan 03: MapView zoomToElement signature (pinRef, 2.75, 700, 'easeOutQuart', 0, 64) — offsetY=64 biases center so overlay card doesn't cover pin
- [Phase 03-map-experience]: Phase 3 Plan 03: minScale=1.0 (fit-to-viewport lower bound per UI-SPEC) / maxScale=6 — UI-SPEC authoritative over RESEARCH.md earlier 0.3/0.5 examples
- [Phase 03-map-experience]: Phase 3 Plan 03: Flipped 2 of 4 MapView it.todo stubs to real tests (missing-table fallback + picture source tree) via vi.mock on library+FloorPlan; 2 remain deferred to Plan 05 (need Wave 4 FloorPlan)
- [Phase 03-map-experience]: Phase 3 Plan 04: FloorPlan refactored to container-child shape; assignedPinRef typed as React.Ref<HTMLDivElement> (not RefObject<HTMLDivElement|null>) to satisfy React 18 LegacyRef expectation
- [Phase 03-map-experience]: Phase 3 Plan 04: FloorPlan props assignedPinRef/onImageLoad made optional (not required) for TableModal backward-compat until Wave 5; keeps tsc --noEmit green
- [Phase 03-map-experience]: Phase 3 Plan 04: Percentage CSS positioning (pos.x * 100%) replaces Phase 1 ResizeObserver + pixel-math; net -188 lines (-43%) across FloorPlan.tsx + FloorPlan.css
- [Phase 03-map-experience]: Phase 3 Plan 05: App.tsx preload injected via useEffect at mount time (not index.html); hidden <img> at 1600w AVIF belt-and-suspenders inside .app-container
- [Phase 03-map-experience]: Phase 3 Plan 05: key={selectedGuest.tableNumber} on <MapView> to force clean remount when a user selects a different guest while the map is open (RESEARCH.md Pitfall 5)
- [Phase 03-map-experience]: Phase 3 Plan 05: FloorPlan props tightened back to required now that TableModal is deleted (Wave 4 compat shim removed); added eslint.config.js flat config and matchMedia polyfill in src/test/setup.ts as blocking-issue auto-fixes
- [Phase 04-performance-offline]: Phase 4 Plan 01: ImportMetaEnv.VITE_SHEET_URL typed as readonly string (not string | undefined) -- module-load guard crashes before consumers run, so downstream treats as non-nullable
- [Phase 04-performance-offline]: Phase 4 Plan 01: Vite build-time guard uses configResolved hook (not config) because .env files are loaded between the two; guard scoped to config.command === 'build' so dev/test do not require process.env
- [Phase 04-performance-offline]: Phase 4 Plan 01: freshImport() helper -- runtime-built spec + @vite-ignore + typeof cast -- enables per-test module cache-bust for guard tests without breaking strict tsc (ambient module augmentation rejected with TS2664)
- [Phase 04-performance-offline]: StalenessBadge UX — muted slate/navy badge that is silent when online+fresh, shows 'Updated Xm ago' at >=1h, and 'Offline — showing cached list' when offline. Tap fires onRefresh (D-07/D-08/D-09).
- [Phase 04-performance-offline]: src/pwa/ directory adopted as canonical home for PWA-specific hooks (useOnlineStatus, useCacheAge) — distinct from src/services/ (non-React data helpers) and src/components/ (UI).
- [Phase 04-performance-offline]: vite-plugin-pwa@^1.2.0 installed; VitePWA registered with registerType:'prompt' (not autoUpdate) so UpdateToast controls reload timing (D-05)
- [Phase 04-performance-offline]: Vitest virtual-module resolution handled via resolve.alias pointing to src/test/pwa-register-react-stub.ts (vi.mock alone insufficient for Vitest 4.1.4 import-analysis)
- [Phase 04-performance-offline]: UpdateToast uses createPortal(document.body) (Phase 3 MapView precedent) with suppressed={selectedGuest !== null} so the toast hides while MapView is open (D-07)

### Pending Todos

None yet.

### Blockers/Concerns

- Table count is still being finalized — floor plan JSON will need updating once table count is locked. Phase 1 (percentage-based coordinates) mitigates the rework cost.

## Session Continuity

Last session: 2026-04-17T17:29:51.934Z
Stopped at: Completed 04-05-PLAN.md (vite-plugin-pwa + UpdateToast)
Resume file: None
