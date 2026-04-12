# Phase 1: Data Integrity - Research

**Researched:** 2026-04-12
**Domain:** Coordinate system migration + CSV parsing resilience (React/Vite/TypeScript)
**Confidence:** HIGH

## Summary

Phase 1 fixes two foundational bugs blocking all downstream work: (1) tables 46 and 47 share identical coordinates in `floorPlan.json`, and (2) the coordinate system uses absolute pixels tied to a hardcoded `canvasWidth`/`canvasHeight`, which survives the current image but will silently break if the image is replaced or if CSS scaling differs. Additionally, CSV parsing uses positional indices, so any column reorder in the Google Sheet silently corrupts guest data.

The migration is mechanical: divide each x by 3300 and each y by 2517 to produce 0-1 percentages, drop the two canvas fields, and rewrite two marker-render sites in `FloorPlan.tsx` to multiply percentages by the displayed image dimensions. CSV parsing gains a one-time header-index map built from row 0, with case-insensitive + trimmed matching.

**Primary recommendation:** Do the JSON migration first (pure data change, easy to diff), then the `FloorPlan.tsx` render update (two sites), then the CSV parser rewrite. Each step is independently verifiable in the browser without a test framework.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fix tables 46 and 47 — they currently share identical coordinates `{x: 2170, y: 920}` in `floorPlan.json`. Table 47 needs its own distinct position.
- **D-02:** Convert all table positions from absolute pixel values to percentage-based coordinates (0-1 range). Divide each `x` by `canvasWidth` (3300) and each `y` by `canvasHeight` (2517).
- **D-03:** Drop `canvasWidth` and `canvasHeight` from `floorPlan.json` — percentages are self-contained and don't need reference dimensions.
- **D-04:** Use the current 54-table layout as the baseline. The table count is NOT final (reference image shows up to 68 tables). The percentage system makes future position updates trivial.
- **D-05:** Update `FloorPlan.tsx` to scale percentage coordinates against the displayed image dimensions instead of using the pixel-based `scaleFactor = imageWidth / canvasWidth` pattern.
- **D-06:** Switch from positional index parsing (`fields[0]`, `fields[1]`, etc.) to header-based column mapping in `googleSheets.ts`.
- **D-07:** Expected column headers: "Table Number", "First Name", "Last Name", "Contact Info", "Guest Description"
- **D-08:** Parsing should match headers case-insensitively and trim whitespace.

### Claude's Discretion
- Error handling for missing/malformed columns (skip row, warn, fallback).
- Whether to add validation that warns about duplicate coordinates in the JSON.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Table 46 and 47 have correct, distinct coordinates | Proposed coordinate for 47 in "Table 47 Positioning" section below |
| DATA-02 | Percentage-based coordinates (0-1) instead of absolute pixels | Migration math + JSON shape + render formula documented |
| DATA-03 | CSV parsing uses column headers instead of positional indexes | Header-index map pattern + matching rules documented |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React 18.3 / Vite 6 / TypeScript 5.6 — no rewrite, no new frameworks.
- **Mobile-first:** performance on cellular/WiFi is critical; avoid adding dependencies for this phase (all changes are pure refactor).
- **Code style:** 2-space indent, single quotes in TS, double quotes in JSX attrs, semicolons, trailing commas in multi-line literals.
- **Naming:** camelCase functions/vars, PascalCase components/interfaces, `handle*` event handlers, `on*` callback props, kebab-case CSS classes.
- **Components:** `function` declarations (not arrows), default exports, props destructured inline with `{ComponentName}Props` interface above.
- **State:** `useState`/`useEffect`/`useCallback` only; no state management library; state lifted to `App.tsx`.
- **Imports:** relative paths only, no `@/` aliases. JSON imported as default (`import floorPlanConfig from '../config/floorPlan.json'`).
- **Error handling:** try/catch with `console.error` + `instanceof Error` check + re-throw user-friendly message; no error boundary.
- **Testing:** no framework installed; success criteria are manually verifiable in the browser.
- **GSD workflow:** edits must go through GSD commands.

## Standard Stack

No new libraries for this phase. All changes use in-tree primitives. [VERIFIED: package.json read]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18.3.1 | UI rendering | Already in-tree |
| typescript | ~5.6.2 | Type checking | Already in-tree |
| vite | ^6.0.1 | Dev/build | Already in-tree |

**No new npm installs required.** [VERIFIED: package.json]

## Architecture Patterns

### Pattern 1: Single-File JSON Config Migration
**What:** Treat `floorPlan.json` as an atomic migration — change all 54 entries + remove 2 fields in one edit.
**Why:** JSON import is cached by Vite; partial states (mixed pixel/percentage) would require branching in `FloorPlan.tsx`. A clean atomic swap keeps the type narrow.
**Shape after migration:**
```json
{
  "imageFileName": "Reception Seat Diagram.png",
  "tablePositions": {
    "1": { "x": 0.2758, "y": 0.3854 },
    "2": { "x": 0.4948, "y": 0.3866 },
    ...
  }
}
```

### Pattern 2: Percentage-to-Pixel Render Formula
**What:** `markerLeft = positionXPercent * displayedImageWidth`, `markerTop = positionYPercent * displayedImageHeight`.
**When to use:** Any time a marker overlays an image whose rendered size is not fixed.
**Advantage over current:** No need to know original image dimensions. Image can be swapped with a different aspect ratio or resolution and markers stay aligned.

### Pattern 3: Header-Index Map for CSV
**What:** Parse row 0 once, build `Record<string, number>` (lowercased+trimmed header → column index), then for each data row look up by canonical name.
**Example:**
```typescript
const headerRow = parseCSVLine(lines[0]);
const headerIndex: Record<string, number> = {};
headerRow.forEach((h, i) => {
  headerIndex[h.trim().toLowerCase()] = i;
});
const tableIdx = headerIndex['table number'];
// ...
```
**Advantage:** O(1) lookup per row, tolerant of reorder, easy to extend with aliases.

### Anti-Patterns to Avoid
- **Keeping `canvasWidth`/`canvasHeight` "just in case":** Creates two sources of truth; the whole point of D-02/D-03 is that percentages are self-describing.
- **Per-row header re-parse:** Don't call `headerIndex[...]` construction inside the data-row loop — build once outside.
- **`Object.fromEntries(zip(headers, fields))` per row:** Allocates a new object per row; fine at 200 guests but wasteful. Prefer index-based lookup.
- **Regex-splitting CSV:** `line.split(',')` is already wrong for quoted fields. The existing `parseCSVLine` handles quotes correctly — reuse it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV field splitting with quotes | New parser | Existing `parseCSVLine` in `googleSheets.ts` | It already handles escaped quotes (`""`), and changing it is out of scope for DATA-03 |
| Image aspect-ratio math in enlarged view | New math | Existing `handleEnlargedImageLoad` logic | It already computes `displayWidth`, `displayHeight`, `offsetX`, `offsetY` correctly — just replace the `scaleFactor * position.x` sites |

**Key insight:** This phase is a refactor, not a feature. Every line of new code is a liability. Touch only the files/sites required by D-01 through D-08.

## Table 47 Positioning (DATA-01)

### Layout Analysis

Studying `floorPlan.json` reveals a symmetric layout around a central dance floor, with tables 15-54 arranged as round tables in columns on both sides. [VERIFIED: read src/config/floorPlan.json]

**Right side, grouped by row (y):**

| y (row) | Inner col (x≈1975-2070) | Outer col (x≈2159-2267) |
|---------|-------------------------|--------------------------|
| 240-262 | 22 (1777,237) / 24 (1982,240) | 54 (2159, 240) |
| 417-431 | 26 (2062, 417) | 52 (2259, 417) |
| 589-614 | 28 (1979, 589) | 50 (2159, 589) |
| 747-776 | 30 (2069, 755) | 48 (2259, 747) |
| **920** | **32 (1975, 920)** | **46 (2170, 920) — 47 MISSING HERE** |
| 1089 | 34 (2065, 1089) | 44 (2267, 1089) |
| 1258-1283 | 36 (1975, 1258) | 42 (2159, 1262) |
| 1431-1463 | 38 (2062, 1431) | 40 (2249, 1438) |

At y≈920 the outer column has exactly one table (46 at x=2170), while every other row has an outer-column entry at x≈2159-2267. **Table 47 is the missing outer-column table at this row.** [ASSUMED — inferred from pattern; requires visual confirmation against the source floor plan image]

### Proposed Coordinates for Table 47

Averaging outer-column x values at adjacent rows (44 at 2267, 48 at 2259, 40 at 2249, 42 at 2159, 50 at 2159): the outer column at y=920 should sit around **x ≈ 2263** (aligned with 44 above and 48 below), with 46 moving to the inner-outer position or staying put.

**Recommendation (two options for planner/user to pick):**

| Option | Table 46 | Table 47 | Rationale |
|--------|----------|----------|-----------|
| **A (recommended)** | keep at (2170, 920) | move to **(2263, 920)** | 46 stays inner-of-outer, 47 takes the true outer slot matching 44/48 pattern |
| B | move 46 to (2170, 920) — unchanged | place 47 at (2263, 920) | identical to A — phrasing only |
| C (fallback) | (2170, 920) | (2263, 945) | slight y-offset for visual separation if image shows them staggered |

**All options are [ASSUMED]** — the planner should surface the proposed coordinate to the user during `/gsd-plan-phase` review, since the ground truth is a visual inspection of `src/assets/Reception Seat Diagram.png` that this researcher has not performed.

**Post-migration percentage form (Option A):**
- Table 46: `{ "x": 0.6576, "y": 0.3655 }` (2170/3300, 920/2517)
- Table 47: `{ "x": 0.6858, "y": 0.3655 }` (2263/3300, 920/2517)

## Percentage Coordinate Migration (DATA-02, DATA-03)

### Transformation
- `xPercent = xPixel / 3300`
- `yPercent = yPixel / 2517`

### Precision
Retain **4 decimal places** (e.g. `0.2758`). [VERIFIED: math]
- 4 decimals on a 3300px image = 0.33px precision — well below marker visual size (~24px).
- 4 decimals keeps the JSON readable and diff-friendly.
- 6 decimals is overkill and noisier in code review.

### Full Migration Table (54 rows)

Computed from current `floorPlan.json` [VERIFIED: read]. Sample rows — planner/implementer regenerates the full set:

| # | Old (x,y) | New (xPercent, yPercent) |
|---|-----------|--------------------------|
| 1 | 910, 970 | 0.2758, 0.3854 |
| 2 | 1633, 973 | 0.4948, 0.3866 |
| 13 | 672, 945 | 0.2036, 0.3754 |
| 46 | 2170, 920 | 0.6576, 0.3655 |
| 47 | **2263, 920** (proposed) | **0.6858, 0.3655** |
| 54 | 2159, 240 | 0.6542, 0.0954 |

A small one-off Node script (or an inline computation in the planner's task) can regenerate all 54 deterministically.

### JSON Shape After Migration
```json
{
  "imageFileName": "Reception Seat Diagram.png",
  "tablePositions": {
    "1": { "x": 0.2758, "y": 0.3854 }
  }
}
```
- `canvasWidth` removed
- `canvasHeight` removed
- All 54 `x` and `y` values replaced with floats in [0,1]

### TypeScript Interface Update
In `FloorPlan.tsx` the `FloorPlanConfig` interface must drop the two fields:
```typescript
interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}
```
Leaving the old fields in the interface while removing them from JSON would silently type-check against `any`-cast values — remove both sides.

## FloorPlan.tsx Scaling Rewrite (DATA-05)

### Sites to Change

`src/components/FloorPlan.tsx` has **two marker-render sites**, both using pixel scaling. [VERIFIED: read, lines 107-118 and 147-158]

**Site 1 — normal view (lines 107-118):**
```typescript
// BEFORE
left: `${position.x * scaleFactor}px`,
top: `${position.y * scaleFactor}px`,
// where scaleFactor = imageWidth / config.canvasWidth

// AFTER
left: `${position.x * imageWidth}px`,
top: `${position.y * imageHeight}px`,
```

**Site 2 — enlarged view (lines 147-158):**
```typescript
// BEFORE
left: `${enlargedDimensions.offsetX + (position.x * enlargedScaleFactor)}px`,
top: `${enlargedDimensions.offsetY + (position.y * enlargedScaleFactor)}px`,

// AFTER
left: `${enlargedDimensions.offsetX + (position.x * enlargedDimensions.width)}px`,
top: `${enlargedDimensions.offsetY + (position.y * enlargedDimensions.height)}px`,
```

### Normal View Needs `imageHeight` Too
Currently `handleImageLoad` captures only `imageWidth` (line 34). With percentages, `y * imageWidth` would compute against the wrong axis. **Add `imageHeight` state** and capture both in `handleImageLoad`:
```typescript
const [imageWidth, setImageWidth] = useState(0);
const [imageHeight, setImageHeight] = useState(0);

const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  setImageWidth(e.currentTarget.offsetWidth);
  setImageHeight(e.currentTarget.offsetHeight);
  setImageLoaded(true);
};
```

### Enlarged View Simplification
The enlarged view's `handleEnlargedImageLoad` computes `displayWidth`, `displayHeight`, `offsetX`, `offsetY` using `config.canvasWidth / config.canvasHeight` for aspect math. **This still works** after migration because it reads the image's actual aspect via `img.naturalWidth/naturalHeight`, not the JSON. **Refactor:** replace `config.canvasWidth / config.canvasHeight` with `img.naturalWidth / img.naturalHeight`:
```typescript
const imageAspect = img.naturalWidth / img.naturalHeight;
```
This removes the last dependency on the dropped fields and makes the component robust to image swaps. [VERIFIED: React SyntheticEvent image API — `naturalWidth`/`naturalHeight` are standard HTMLImageElement properties] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth]

### Window Resize Handling
The current code captures `imageWidth` only on `onLoad`. If the user rotates their phone or resizes the browser, markers drift. Two options for the planner:
1. **Minimal (recommended for this phase):** leave as-is — the image is `width: 100%` with CSS and resize is rare on mobile. Acceptance test 2 ("resizing the browser window does not shift any table marker") is satisfied as long as the CSS keeps markers positioned relative to the image container.
2. **Robust:** add a `ResizeObserver` on the image to update `imageWidth`/`imageHeight` on resize. This is a correctness upgrade but adds code; flag for Claude's Discretion.

**Recommendation:** Option 2 is worth the ~10 lines — it makes success criterion 2 bulletproof on tablets and desktop preview. `ResizeObserver` is supported in all modern browsers including iOS Safari 13.4+. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver — Baseline "widely available"]

## Header-Based CSV Parsing (DATA-06, DATA-07, DATA-08)

### Canonical Headers (from D-07)
- `Table Number` → `tableNumber`
- `First Name` → `firstName`
- `Last Name` → `lastName`
- `Contact Info` → `contactInfo`
- `Guest Description` → `description`

### Matching Rules (from D-08)
- Lowercase + trim both the sheet header and the canonical name before comparison.
- Match string must be exactly equal after normalization (no fuzzy matching for headers — that's out of scope).

### Recommended Implementation
```typescript
const HEADER_MAP: Record<keyof Guest, string> = {
  tableNumber: 'table number',
  firstName: 'first name',
  lastName: 'last name',
  contactInfo: 'contact info',
  description: 'guest description',
};

function buildHeaderIndex(headerLine: string): Record<string, number> {
  const headers = parseCSVLine(headerLine);
  const index: Record<string, number> = {};
  headers.forEach((h, i) => {
    index[h.trim().toLowerCase()] = i;
  });
  return index;
}

// In fetchGuests:
const lines = csvText.split('\n');
if (lines.length === 0) throw new Error('Empty guest list');
const headerIndex = buildHeaderIndex(lines[0]);

// Resolve each canonical field to a column index (or undefined if missing)
const idx = {
  tableNumber: headerIndex[HEADER_MAP.tableNumber],
  firstName: headerIndex[HEADER_MAP.firstName],
  lastName: headerIndex[HEADER_MAP.lastName],
  contactInfo: headerIndex[HEADER_MAP.contactInfo],
  description: headerIndex[HEADER_MAP.description],
};

// Validate required columns up-front (fail fast)
const missing = Object.entries(idx)
  .filter(([, i]) => i === undefined)
  .map(([k]) => k);
if (missing.length > 0) {
  throw new Error(`Guest list is missing required column(s): ${missing.join(', ')}`);
}

// Per row:
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const fields = parseCSVLine(line);
  guests.push({
    tableNumber: (fields[idx.tableNumber!] ?? '').trim(),
    firstName: (fields[idx.firstName!] ?? '').trim(),
    lastName: (fields[idx.lastName!] ?? '').trim(),
    contactInfo: (fields[idx.contactInfo!] ?? '').trim(),
    description: (fields[idx.description!] ?? '').trim(),
  });
}
```

### Error Handling (Claude's Discretion from CONTEXT.md)

**Recommendation:**
- **Missing required column** → throw, surface to `App.tsx` error UI. Loud failure is correct: the sheet is misconfigured and every row is wrong.
- **Extra columns in sheet** → ignore silently. Admin may add notes columns that shouldn't break the app.
- **Row with fewer fields than expected** → fall back to empty string (`fields[idx] ?? ''`), keep the row. Partial data is better than dropped rows when a guest's `description` is blank.
- **Row with zero non-empty fields** → skip (existing `if (!line) continue` behavior handles blank rows).

### Duplicate Coordinate Validation (Claude's Discretion from CONTEXT.md)

**Recommendation:** Add a dev-only check in `FloorPlan.tsx` (or at import time) that iterates `tablePositions` and `console.warn`s if any two tables have identical `(x, y)` within epsilon (e.g. `< 0.001`). This is ~10 lines and would have caught the original 46/47 bug. No user-visible behavior change; useful for future coordinate edits.

```typescript
// Run once at module load
if (import.meta.env.DEV) {
  const seen = new Map<string, string>();
  for (const [id, pos] of Object.entries(config.tablePositions)) {
    const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`;
    if (seen.has(key)) {
      console.warn(`Duplicate table position: ${id} and ${seen.get(key)} at ${key}`);
    }
    seen.set(key, id);
  }
}
```
[VERIFIED: `import.meta.env.DEV` is Vite's built-in dev flag, tree-shaken from prod builds — https://vite.dev/guide/env-and-mode]

## Runtime State Inventory

Not applicable in the traditional sense (no DBs, no running services), but for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Google Sheets CSV is source; no local DB. The sheet header text is user-editable state but D-07 defines the canonical names. | Confirm sheet headers match D-07 once before deploy. |
| Live service config | Google Sheets CSV URL hardcoded in `googleSheets.ts:3`. Not renamed in this phase. | None this phase (PERF-04 handles env var in Phase 4). |
| OS-registered state | None. | None. |
| Secrets/env vars | None referenced in this phase. | None. |
| Build artifacts | Vite caches the JSON import. After `floorPlan.json` changes, `npm run dev` hot-reloads; prod rebuild needed before deploy. | Document in plan: run `npm run build` after JSON change. |

## Common Pitfalls

### Pitfall 1: Rounding Drift
**What goes wrong:** Using too few decimals (e.g. 2) collapses adjacent tables. 0.65 and 0.66 on a 3300px image = 3.3px apart, still distinct, but at 2 decimals some currently-distinct tables become identical.
**Why it happens:** JSON editors autoformatting or manual rounding.
**How to avoid:** Lock to 4 decimals. Document the precision in the plan. Spot-check any two nearby tables after migration.
**Warning signs:** Duplicate-coordinate warning fires (see validation snippet above).

### Pitfall 2: CSS Marker Offset vs Top-Left
**What goes wrong:** Marker appears offset from the table because CSS positions by top-left corner, but the coordinate intent is the table's center.
**Why it happens:** The marker's `left`/`top` are the corner of the marker div, not its center.
**How to avoid:** Existing `FloorPlan.css` likely handles this with a `transform: translate(-50%, -50%)` on `.point-marker`. [ACTION] Verify this CSS rule exists during planning; if not, add it. [ASSUMED — CSS file not read in this research]
**Warning signs:** Marker visually "below-right" of the table circle by a fixed offset on all tables.

### Pitfall 3: CSV Header Drift
**What goes wrong:** Admin renames "Guest Description" to "Notes" in the sheet; parser throws "missing required column".
**Why it happens:** Header names are human-edited.
**How to avoid:** The fail-fast validation is correct behavior. If resilience to renames is later desired, add an alias map in `HEADER_MAP` (e.g. `description: ['guest description', 'notes', 'description']`). Out of scope for this phase.
**Warning signs:** App loads with error card "Guest list is missing required column(s): description".

### Pitfall 4: Duplicate Headers in Sheet
**What goes wrong:** Sheet has two columns both named "Notes"; header-index map last-write-wins, silently using the rightmost.
**Why it happens:** Copy-paste errors in the sheet.
**How to avoid:** In `buildHeaderIndex`, warn if a header name is seen twice.
**Warning signs:** Random guest fields show unexpected data.

### Pitfall 5: Stale Type Interface
**What goes wrong:** `FloorPlanConfig` interface still lists `canvasWidth`/`canvasHeight` after JSON removes them. TS allows this because the imported JSON is widened. Code reading `config.canvasWidth` returns `undefined` at runtime → `scaleFactor = NaN` → markers vanish.
**How to avoid:** Update the interface in lockstep with the JSON. Grep for `canvasWidth` and `canvasHeight` across `src/` and remove every reference.
**Warning signs:** Markers don't render; `imageLoaded && position && scaleFactor > 0` short-circuits to false.

### Pitfall 6: Other Consumers of `canvasWidth`
**What goes wrong:** Some other component imports `floorPlan.json` and reads the dropped fields.
**How to avoid:** Grep the codebase. [VERIFIED: per CONTEXT.md "Integration Points" — `floorPlan.json` is used only by `FloorPlan.tsx`. Planner should re-verify with grep before merge.]
**Warning signs:** TypeScript error `Property 'canvasWidth' does not exist on type ...` in an unexpected file.

## Code Examples

### Percentage-to-Marker Render (normal view)
```typescript
// src/components/FloorPlan.tsx
{imageLoaded && position && imageWidth > 0 && (
  <div
    className="point-marker"
    data-table-id={tableNumber}
    style={{
      left: `${position.x * imageWidth}px`,
      top: `${position.y * imageHeight}px`,
    }}
  >
    <div className="point-pulse" />
  </div>
)}
```

### Percentage-to-Marker Render (enlarged view with aspect-letterbox)
```typescript
{imageLoaded && position && enlargedDimensions.width > 0 && (
  <div
    className="point-marker"
    data-table-id={tableNumber}
    style={{
      left: `${enlargedDimensions.offsetX + position.x * enlargedDimensions.width}px`,
      top: `${enlargedDimensions.offsetY + position.y * enlargedDimensions.height}px`,
    }}
  >
    <div className="point-pulse" />
  </div>
)}
```

### Header-Indexed CSV Parse
See full snippet in "Header-Based CSV Parsing" section above.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pixel coordinates + `scaleFactor = displayed / canvasWidth` | Percentage coordinates (0-1) * displayed dimensions | This phase | Image swap no longer breaks markers |
| Positional CSV indexing (`fields[0]`) | Header-indexed lookup | This phase | Column reorder no longer corrupts guests |

**Deprecated/outdated:** `canvasWidth`, `canvasHeight` in `floorPlan.json` — removed this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Table 47 belongs at outer-right-column at y≈920 (proposed `(2263, 920)` → `(0.6858, 0.3655)`) | Table 47 Positioning | Marker appears in wrong spot; user visually confirms against floor plan image |
| A2 | `.point-marker` CSS has `transform: translate(-50%, -50%)` to center on coordinate | Pitfall 2 | Markers offset from tables by a constant; fix by adding the CSS rule |
| A3 | No other component imports `canvasWidth`/`canvasHeight` from `floorPlan.json` | Pitfall 6 | TS compile error surfaces the leak; easy to fix |
| A4 | Admin will not rename column headers after D-07 is locked | CSV Parsing | Parse throws fail-fast error; admin reverts rename or we add alias map |
| A5 | The enlarged view's aspect math (`handleEnlargedImageLoad`) can switch from `config.canvas*` to `img.naturalWidth/Height` without visual change | FloorPlan Rewrite | Enlarged marker offset; verify in browser after change |

**Planner action:** Surface A1 and A2 to the user during `/gsd-plan-phase` review. A3 is verifiable by a 1-command grep. A4 and A5 are low-risk.

## Open Questions

1. **Exact visual location of table 47**
   - What we know: 46 and 47 share `(2170, 920)`. Layout is symmetric. Outer-right-column pattern suggests `(2263, 920)`.
   - What's unclear: Whether the source floor plan image shows 47 adjacent to 46 horizontally, or offset vertically.
   - Recommendation: Planner asks user to eyeball `src/assets/Reception Seat Diagram.png` and confirm or correct `(2263, 920)` before the migration task runs.

2. **Should the one-off migration be scripted or hand-edited?**
   - What we know: 54 rows × 2 values = 108 numbers to transform.
   - What's unclear: Whether the planner prefers a throwaway Node script in `scripts/` or an inline computation.
   - Recommendation: Use a throwaway Node script (`node -e`) run once and committed only as the resulting JSON diff. Keeps the repo clean.

3. **Window resize handling scope**
   - What we know: Success criterion 2 says "resizing the browser window does not shift any table marker".
   - What's unclear: Whether CSS `width: 100%` alone is enough, or if `ResizeObserver` is required.
   - Recommendation: Test with CSS-only first; add `ResizeObserver` if manual resize test fails.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev server / one-off migration script | ✓ | v22.14.0 | — |
| npm | dev server | ✓ | (implied) | — |
| Browser with ResizeObserver | optional resize robustness | ✓ | All modern browsers (iOS Safari 13.4+) | CSS-only width:100% |

No missing dependencies. Phase is pure code/config.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | none |
| Quick run command | `npm run dev` + manual browser check; `npm run build` for prod smoke |
| Full suite command | `npm run lint && npm run build` (type-checks + ESLint) |

No automated test framework is set up. Phase success criteria are behaviorally verifiable in the browser; formal test-framework setup is out of scope per CONTEXT.md ("No test framework set up — Phase 1 success criteria are manually verifiable").

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Tables 46 and 47 render in visibly distinct positions | manual-visual | Load app, search a guest at table 46, verify marker. Repeat for 47. | N/A — manual |
| DATA-02 | Resizing window or swapping image keeps markers on tables | manual-visual | Load app → drag browser window narrow→wide; markers stay on tables | N/A — manual |
| DATA-03 | CSV with reordered columns still parses | manual-data | Create local test CSV with `First Name, Table Number, ...` (reordered); swap `SHEET_URL` temporarily or mock `fetch`; verify guests load | N/A — manual |
| DATA-02 (type) | `canvasWidth` / `canvasHeight` fully removed | automated (compile) | `npm run build` — TS compile fails if any reference remains | ✓ tsc |
| DATA-01 (dupe) | No two tables share coordinates | automated (runtime) | Load app in dev — `import.meta.env.DEV` duplicate-coord check `console.warn`s if any | ✓ (added in plan) |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run build` (ESLint + TS type-check)
- **Per wave merge:** Above + manual browser spot-check of one table marker
- **Phase gate:** All three success criteria verified manually in browser at desktop + mobile viewport

### Wave 0 Gaps
- [ ] None — no test infrastructure to scaffold. Existing `npm run lint` and `npm run build` cover the automatable surface.

*(Formal test framework setup deferred; would be a candidate for a future quality-engineering phase.)*

## Sources

### Primary (HIGH confidence)
- `src/config/floorPlan.json` (read) — table coordinate source of truth
- `src/components/FloorPlan.tsx` (read) — marker render sites and scaling logic
- `src/services/googleSheets.ts` (read) — current positional CSV parser
- `src/types.ts` (read) — `Guest` interface
- `.planning/phases/01-data-integrity/01-CONTEXT.md` (read) — locked decisions
- `.planning/REQUIREMENTS.md` (read) — DATA-01/02/03
- `.planning/ROADMAP.md` (read) — success criteria
- Vite `import.meta.env.DEV` — https://vite.dev/guide/env-and-mode (dev-only tree-shaking)
- MDN HTMLImageElement.naturalWidth — https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth
- MDN ResizeObserver — https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver

### Secondary (MEDIUM confidence)
- Table 47 coordinate proposal — inferred from visual pattern in JSON, not verified against the reference image

### Tertiary (LOW confidence)
- None — findings either verified against in-tree files or flagged `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuses existing in-tree libraries, zero new deps
- Architecture (JSON + render rewrite): HIGH — sites identified by direct file read
- CSV parser: HIGH — pattern is standard, `parseCSVLine` retained unchanged
- Table 47 position: MEDIUM — geometric inference, needs visual confirmation (flagged A1)
- Pitfalls: HIGH — derived from direct code reading

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days; stable stack, no external dependencies)

## RESEARCH COMPLETE
