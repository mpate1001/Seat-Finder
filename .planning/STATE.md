---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-03-PLAN.md (MapView component — 2 files + test flip committed)
last_updated: "2026-04-17T14:20:51.343Z"
last_activity: 2026-04-17
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 10
  completed_plans: 8
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-12)

**Core value:** A guest finds their table in under 10 seconds — search, see the number, see it on the map, walk there.
**Current focus:** Phase 03 — map-experience

## Current Position

Phase: 03 (map-experience) — EXECUTING
Plan: 4 of 5
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

### Pending Todos

None yet.

### Blockers/Concerns

- Table count is still being finalized — floor plan JSON will need updating once table count is locked. Phase 1 (percentage-based coordinates) mitigates the rework cost.

## Session Continuity

Last session: 2026-04-17T14:20:51.340Z
Stopped at: Completed 03-03-PLAN.md (MapView component — 2 files + test flip committed)
Resume file: None
