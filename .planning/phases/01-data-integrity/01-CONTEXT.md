# Phase 1: Data Integrity - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the table coordinate system and harden data parsing so all downstream features (fuzzy search, animated map, offline, setup tooling) build on a correct, resilient foundation. This phase does NOT add new features — it fixes bugs and replaces brittle patterns.

</domain>

<decisions>
## Implementation Decisions

### Table Position Coordinates (DATA-01, DATA-02)
- **D-01:** Fix tables 46 and 47 — they currently share identical coordinates `{x: 2170, y: 920}` in `floorPlan.json`. Table 47 needs its own distinct position.
- **D-02:** Convert all table positions from absolute pixel values to percentage-based coordinates (0-1 range). Divide each `x` by `canvasWidth` (3300) and each `y` by `canvasHeight` (2517).
- **D-03:** Drop `canvasWidth` and `canvasHeight` from `floorPlan.json` — percentages are self-contained and don't need reference dimensions.
- **D-04:** Use the current 54-table layout as the baseline. The table count is NOT final (reference image shows up to 68 tables). The percentage system makes future position updates trivial — just edit JSON values.
- **D-05:** Update `FloorPlan.tsx` to scale percentage coordinates against the displayed image dimensions instead of using the pixel-based `scaleFactor = imageWidth / canvasWidth` pattern.

### CSV Parsing Resilience (DATA-03)
- **D-06:** Switch from positional index parsing (`fields[0]`, `fields[1]`, etc.) to header-based column mapping in `googleSheets.ts`.
- **D-07:** Expected column headers (confirmed by user): "Table Number", "First Name", "Last Name", "Contact Info", "Guest Description"
- **D-08:** Parsing should match headers case-insensitively and trim whitespace, so reordered or slightly renamed columns still work.

### Claude's Discretion
- Error handling for missing/malformed columns — Claude decides the approach (skip row, warn, fallback)
- Whether to add validation that warns about duplicate coordinates in the JSON (nice-to-have for catching future 46/47-style bugs)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Key Source Files
- `src/config/floorPlan.json` — Current pixel-based table positions (54 tables), the file being migrated
- `src/services/googleSheets.ts` — CSV fetch and positional parsing logic to be replaced with header-based
- `src/components/FloorPlan.tsx` — Rendering logic that scales coordinates, needs percentage-based update
- `src/types.ts` — `Guest` interface (no changes expected, but read for context)

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseCSVLine()` in `googleSheets.ts` — robust quoted-field CSV parser, can be kept as-is for field splitting
- `FloorPlan.tsx` already handles image scaling and enlarged view — coordinate math just needs updating from pixels to percentages

### Established Patterns
- Config loaded via direct JSON import (`import floorPlanConfig from '../config/floorPlan.json'`)
- State managed in `App.tsx`, passed down as props
- No test framework set up — Phase 1 success criteria are manually verifiable

### Integration Points
- `floorPlan.json` is the single source of truth for table positions — used only by `FloorPlan.tsx`
- `googleSheets.ts` is the single data fetch point — used only by `App.tsx`
- No other components reference table coordinates or CSV structure

</code_context>

<specifics>
## Specific Ideas

- User provided a reference floor plan image showing up to 68 tables in a symmetric layout around a central dance floor and stage. Tables 1-14 are rectangular (center bottom), rest are round tables in columns on both sides.
- Table count will change as guest RSVPs come in — the coordinate system must support easy addition/removal of table entries.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-data-integrity*
*Context gathered: 2026-04-12*
