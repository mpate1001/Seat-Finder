---
phase: 01-data-integrity
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/config/floorPlan.json
autonomous: true
requirements: [DATA-01, DATA-02]

must_haves:
  truths:
    - "floorPlan.json contains no canvasWidth or canvasHeight keys"
    - "All 54 table coordinates are floats in the range [0, 1]"
    - "Table 46 and table 47 have distinct (x, y) values"
  artifacts:
    - path: "src/config/floorPlan.json"
      provides: "Percentage-based table coordinate config"
      contains: "tablePositions"
  key_links:
    - from: "src/config/floorPlan.json"
      to: "src/components/FloorPlan.tsx"
      via: "default JSON import"
      pattern: "import floorPlanConfig from '../config/floorPlan.json'"
---

<objective>
Migrate `src/config/floorPlan.json` from pixel coordinates to percentage coordinates (0-1) and fix the duplicate table 46/47 bug.

Purpose: Establish a self-describing coordinate system that survives image swaps and eliminates the 46/47 overlap (DATA-01, DATA-02).
Output: A rewritten `floorPlan.json` with no `canvasWidth`/`canvasHeight` fields and all 54 tables expressed as 4-decimal percentages, with table 47 at a distinct position from table 46.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-data-integrity/01-CONTEXT.md
@.planning/phases/01-data-integrity/01-RESEARCH.md
@src/config/floorPlan.json

<interfaces>
Current JSON shape (from src/config/floorPlan.json):
```json
{
  "imageFileName": "Reception Seat Diagram.png",
  "canvasWidth": 3300,
  "canvasHeight": 2517,
  "tablePositions": { "1": { "x": 910, "y": 970 }, ... }
}
```

Target JSON shape (post-migration):
```json
{
  "imageFileName": "Reception Seat Diagram.png",
  "tablePositions": { "1": { "x": 0.2758, "y": 0.3854 }, ... }
}
```

Transform: xPercent = xPixel / 3300, yPercent = yPixel / 2517, rounded to 4 decimals.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite floorPlan.json with percentage coordinates and fix table 47</name>
  <files>src/config/floorPlan.json</files>
  <read_first>
    - src/config/floorPlan.json (all 54 current pixel coordinates)
    - .planning/phases/01-data-integrity/01-RESEARCH.md (sections: "Percentage Coordinate Migration", "Table 47 Positioning", "JSON Shape After Migration")
    - .planning/phases/01-data-integrity/01-CONTEXT.md (D-01, D-02, D-03, D-04)
  </read_first>
  <action>
    Rewrite `src/config/floorPlan.json` in full. Do the following atomically in one edit:

    1. REMOVE both `"canvasWidth": 3300` and `"canvasHeight": 2517` keys entirely (per D-03).
    2. KEEP `"imageFileName": "Reception Seat Diagram.png"`.
    3. REPLACE every entry in `tablePositions` with percentage form: `xPercent = round(xPixel / 3300, 4)`, `yPercent = round(yPixel / 2517, 4)` (4 decimal places exactly, per RESEARCH "Precision" section).
    4. For table 47 specifically: do NOT use the old duplicate `(2170, 920)`. Use the Claude's-Discretion proposed coordinate `(2263, 920)` → `{ "x": 0.6858, "y": 0.3655 }` (per RESEARCH "Table 47 Positioning" Option A). Table 46 remains at `(2170, 920)` → `{ "x": 0.6576, "y": 0.3655 }`.
    5. Preserve key order: `imageFileName` first, then `tablePositions`. Keys inside `tablePositions` keep numeric-string order "1" through "54".
    6. Generate the migrated values programmatically (e.g. a one-off `node -e` computation) to avoid arithmetic mistakes, but only commit the resulting JSON — no script file in the repo (per RESEARCH Open Question 2).

    Reference conversion spot-checks (from RESEARCH "Full Migration Table"):
    - 1: 910,970 → 0.2758, 0.3854
    - 2: 1633,973 → 0.4948, 0.3866
    - 13: 672,945 → 0.2036, 0.3754
    - 46: 2170,920 → 0.6576, 0.3655
    - 47: 2263,920 → 0.6858, 0.3655  (NEW — was duplicate)
    - 54: 2159,240 → 0.6542, 0.0954

    2-space indent, no trailing newline inside the file beyond the standard one.
  </action>
  <verify>
    <automated>npm run build</automated>
    Additional greps to confirm structural correctness:
    - `grep -c '"canvasWidth"' src/config/floorPlan.json` → 0
    - `grep -c '"canvasHeight"' src/config/floorPlan.json` → 0
    - `grep -E '"(x|y)": [0-9]+\.[0-9]{4}' src/config/floorPlan.json | wc -l` → 108 (54 x's + 54 y's)
    - Table 46/47 distinct: `node -e "const c=require('./src/config/floorPlan.json'); const a=c.tablePositions['46'], b=c.tablePositions['47']; if(a.x===b.x && a.y===b.y) process.exit(1)"` exits 0
  </verify>
  <acceptance_criteria>
    - `src/config/floorPlan.json` does NOT contain the substring `canvasWidth`
    - `src/config/floorPlan.json` does NOT contain the substring `canvasHeight`
    - `src/config/floorPlan.json` key `"47"` has `x` equal to `0.6858` (distinct from table 46's `0.6576`)
    - `src/config/floorPlan.json` key `"46"` has `x` equal to `0.6576` and `y` equal to `0.3655`
    - All 54 entries (`"1"` through `"54"`) are present under `tablePositions`
    - Every `x` and every `y` value is a decimal in `[0, 1]` with exactly 4 fractional digits
    - `npm run build` exits 0 (note: build will still reference `canvasWidth` in FloorPlan.tsx — acceptable for this plan because the TS `FloorPlanConfig` interface still declares those fields as widened JSON; Plan 02 removes the interface fields. Build should still pass because the JSON import type is widened to `any`-compatible Record.) If `npm run build` fails due to JSON type narrowing, re-check Plan 02 ordering.
  </acceptance_criteria>
  <done>
    floorPlan.json is percentage-based with 54 distinct table entries, canvas fields removed, and 46/47 at different coordinates. `npm run build` passes (or surfaces only the expected interface-mismatch to be fixed in Plan 02).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | This plan edits a static, in-repo JSON config consumed only at build time by Vite. No new external inputs, no new auth surface, no new secrets. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01-01 | Tampering | src/config/floorPlan.json | accept | Static asset under source control; any tampering surfaces as a git diff in code review. No runtime write path. |
| T-01-01-02 | Information Disclosure | src/config/floorPlan.json | accept | Contains table coordinates only — no PII, no secrets. Already shipped to every client in production bundle. |
</threat_model>

<verification>
- `npm run build` exits 0
- Grep shows zero occurrences of `canvasWidth` / `canvasHeight` in `src/config/floorPlan.json`
- Table 46 and 47 have different `x` values
- All 54 tables present, all values in [0,1] with 4 decimals
</verification>

<success_criteria>
floorPlan.json is percentage-based, self-contained (no canvas fields), and tables 46/47 have distinct coordinates. Downstream plan (02) can now rewrite the scaling math against the new shape.
</success_criteria>

<output>
After completion, create `.planning/phases/01-data-integrity/01-01-SUMMARY.md` per template.
</output>
