---
phase: 01-data-integrity
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/config/floorPlan.json
  - src/components/FloorPlan.tsx
autonomous: true
requirements: [DATA-01, DATA-02]

must_haves:
  truths:
    - "floorPlan.json contains no canvasWidth or canvasHeight keys"
    - "All 54 table coordinates are floats in the range [0, 1]"
    - "Table 46 and table 47 have distinct (x, y) values"
    - "FloorPlanConfig interface no longer declares canvasWidth or canvasHeight"
    - "npm run build passes cleanly at end of Wave 1"
  artifacts:
    - path: "src/config/floorPlan.json"
      provides: "Percentage-based table coordinate config"
      contains: "tablePositions"
    - path: "src/components/FloorPlan.tsx"
      provides: "FloorPlanConfig interface aligned with percentage JSON shape"
      contains: "interface FloorPlanConfig"
  key_links:
    - from: "src/config/floorPlan.json"
      to: "src/components/FloorPlan.tsx"
      via: "default JSON import"
      pattern: "import floorPlanConfig from '../config/floorPlan.json'"
---

<objective>
Migrate `src/config/floorPlan.json` from pixel coordinates to percentage coordinates (0-1), fix the duplicate table 46/47 bug, and update the `FloorPlanConfig` interface in `FloorPlan.tsx` in lockstep so the TypeScript strict build stays green at the Wave 1 boundary.

Purpose: Establish a self-describing coordinate system that survives image swaps, eliminate the 46/47 overlap (DATA-01, DATA-02), and keep the interface in lockstep with the JSON so Plan 02's render rewrite starts from a green build.
Output: A rewritten `floorPlan.json` with no `canvasWidth`/`canvasHeight` fields and all 54 tables expressed as 4-decimal percentages (table 47 at a distinct position from table 46), plus a `FloorPlanConfig` interface in `FloorPlan.tsx` with those two fields dropped.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-data-integrity/01-CONTEXT.md
@.planning/phases/01-data-integrity/01-RESEARCH.md
@src/config/floorPlan.json
@src/components/FloorPlan.tsx

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

Target TypeScript interface (this plan edits FloorPlan.tsx to match):
```typescript
interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}
```

Transform: xPercent = xPixel / 3300, yPercent = yPixel / 2517, rounded to 4 decimals.

Note: Plan 02 (Wave 2) rewrites the marker render sites and adds ResizeObserver. This plan only touches the JSON and the interface declaration — it does NOT change the render math. Because the current render code reads `config.canvasWidth` via `scaleFactor`, after this plan the markers will render incorrectly (percentage * scaleFactor) — but the TypeScript strict build still passes because `scaleFactor` becomes `NaN` at runtime (not a compile error) since `config.canvasWidth` is `undefined` (property removed from both JSON and interface). Runtime correctness is restored by Plan 02. The Wave 1 gate is `npm run build` green, not runtime correctness.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite floorPlan.json with percentage coordinates, fix table 47, and align FloorPlanConfig interface</name>
  <files>src/config/floorPlan.json, src/components/FloorPlan.tsx</files>
  <read_first>
    - src/config/floorPlan.json (all 54 current pixel coordinates)
    - src/components/FloorPlan.tsx (locate the `interface FloorPlanConfig` declaration)
    - .planning/phases/01-data-integrity/01-RESEARCH.md (sections: "Percentage Coordinate Migration", "Table 47 Positioning", "JSON Shape After Migration", "TypeScript Interface Update", "Pitfall 5: Stale Type Interface")
    - .planning/phases/01-data-integrity/01-CONTEXT.md (D-01, D-02, D-03, D-04)
  </read_first>
  <action>
    Edit two files atomically. Both edits land in a single commit so the JSON shape and the TS interface stay in lockstep (per RESEARCH Pitfall 5).

    **Edit A — `src/config/floorPlan.json`** (full rewrite):

    1. REMOVE both `"canvasWidth": 3300` and `"canvasHeight": 2517` keys entirely (per D-03).
    2. KEEP `"imageFileName": "Reception Seat Diagram.png"`.
    3. REPLACE every entry in `tablePositions` with percentage form: `xPercent = round(xPixel / 3300, 4)`, `yPercent = round(yPixel / 2517, 4)` (4 decimal places exactly, per RESEARCH "Precision" section).
    4. For table 47 specifically: do NOT use the old duplicate `(2170, 920)`. Use the resolved coordinate `(2263, 920)` → `{ "x": 0.6858, "y": 0.3655 }` (per RESEARCH Open Question 1 RESOLVED — Option A). Table 46 remains at `(2170, 920)` → `{ "x": 0.6576, "y": 0.3655 }`.
    5. Preserve key order: `imageFileName` first, then `tablePositions`. Keys inside `tablePositions` keep numeric-string order "1" through "54".
    6. Generate the migrated values programmatically via an inline `node -e` one-off computation. Do NOT commit any script file to the repo — only the resulting JSON diff (per RESEARCH Open Question 2 RESOLVED).

    Reference conversion spot-checks (from RESEARCH "Full Migration Table"):
    - 1: 910,970 → 0.2758, 0.3854
    - 2: 1633,973 → 0.4948, 0.3866
    - 13: 672,945 → 0.2036, 0.3754
    - 46: 2170,920 → 0.6576, 0.3655
    - 47: 2263,920 → 0.6858, 0.3655  (NEW — was duplicate)
    - 54: 2159,240 → 0.6542, 0.0954

    2-space indent, single trailing newline at end of file (standard).

    **Edit B — `src/components/FloorPlan.tsx`** (interface only — do NOT change render sites in this plan):

    Locate the `interface FloorPlanConfig` declaration and REMOVE both `canvasWidth: number;` and `canvasHeight: number;` lines. Final shape:

    ```typescript
    interface FloorPlanConfig {
      imageFileName: string;
      tablePositions: Record<string, TablePosition>;
    }
    ```

    Do NOT touch anything else in `FloorPlan.tsx` — the render sites, `scaleFactor`, `handleImageLoad`, and enlarged-view math are all Plan 02's responsibility. Leaving `scaleFactor` computing against a now-missing field is expected and acceptable for Wave 1: it yields runtime `NaN` (not a compile error), which Plan 02 fixes. Strict TS build must remain green because no code path reads `canvasWidth`/`canvasHeight` via the interface type after this edit — the only reads are through `config.canvasWidth` / `config.canvasHeight`, which are now `undefined` at runtime but still type-check as `number | undefined`-compatible arithmetic in TS widened JSON import. If strict mode surfaces a new error after the interface edit (e.g. `Property 'canvasWidth' does not exist on type`), Plan 02's steps 5 and 7 (which remove those reads) are pre-conditions — in that case, apply Plan 02's steps 5 and 7 now as part of this task to keep the build green. The Wave 1 gate is `npm run build` exits 0, full stop.
  </action>
  <verify>
    <automated>npm run build</automated>
    Additional greps to confirm structural correctness:
    - `grep -c '"canvasWidth"' src/config/floorPlan.json` → 0
    - `grep -c '"canvasHeight"' src/config/floorPlan.json` → 0
    - `grep -E '"(x|y)": [0-9]+\.[0-9]{4}' src/config/floorPlan.json | wc -l` → 108 (54 x's + 54 y's)
    - `grep -c 'canvasWidth\|canvasHeight' src/components/FloorPlan.tsx` on the `interface FloorPlanConfig` block → 0 (interface no longer declares them)
    - Table 46/47 distinct: `node -e "const c=require('./src/config/floorPlan.json'); const a=c.tablePositions['46'], b=c.tablePositions['47']; if(a.x===b.x && a.y===b.y) process.exit(1)"` exits 0
  </verify>
  <acceptance_criteria>
    - `src/config/floorPlan.json` does NOT contain the substring `canvasWidth`
    - `src/config/floorPlan.json` does NOT contain the substring `canvasHeight`
    - `src/config/floorPlan.json` key `"47"` has `x` equal to `0.6858` (distinct from table 46's `0.6576`)
    - `src/config/floorPlan.json` key `"46"` has `x` equal to `0.6576` and `y` equal to `0.3655`
    - All 54 entries (`"1"` through `"54"`) are present under `tablePositions`
    - Every `x` and every `y` value is a decimal in `[0, 1]` with exactly 4 fractional digits
    - The `interface FloorPlanConfig` block in `src/components/FloorPlan.tsx` does NOT declare `canvasWidth` or `canvasHeight`
    - `npm run build` exits 0 (unambiguous green gate — no hedging)
  </acceptance_criteria>
  <done>
    floorPlan.json is percentage-based with 54 distinct table entries, canvas fields removed. `FloorPlanConfig` interface in `FloorPlan.tsx` matches the new JSON shape (no canvas fields). `npm run build` passes cleanly, giving Plan 02 a green starting point.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | This plan edits a static, in-repo JSON config and a TS interface declaration, both consumed at build time by Vite. No new external inputs, no new auth surface, no new secrets. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01-01 | Tampering | src/config/floorPlan.json | accept | Static asset under source control; any tampering surfaces as a git diff in code review. No runtime write path. |
| T-01-01-02 | Information Disclosure | src/config/floorPlan.json | accept | Contains table coordinates only — no PII, no secrets. Already shipped to every client in production bundle. |
</threat_model>

<verification>
- `npm run build` exits 0 (clean green, not hedged)
- Grep shows zero occurrences of `canvasWidth` / `canvasHeight` in `src/config/floorPlan.json`
- Grep shows zero occurrences of `canvasWidth` / `canvasHeight` inside the `interface FloorPlanConfig` block in `src/components/FloorPlan.tsx`
- Table 46 and 47 have different `x` values
- All 54 tables present, all values in [0,1] with 4 decimals
</verification>

<success_criteria>
floorPlan.json is percentage-based, self-contained (no canvas fields), and tables 46/47 have distinct coordinates. `FloorPlanConfig` interface aligns with the new JSON shape so strict TS build is green at the Wave 1 boundary. Plan 02 can now rewrite the scaling math against a consistent type.
</success_criteria>

<output>
After completion, create `.planning/phases/01-data-integrity/01-01-SUMMARY.md` per template.
</output>
