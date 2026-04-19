---
phase: 01-data-integrity
verified: 2026-04-12T00:00:00Z
status: passed
score: 3/3 must-haves code-verified; human UAT 3 pass / 1 skip (see 01-HUMAN-UAT.md)
overrides_applied: 0
human_verification:
  - test: "Visual distinctness of tables 46 and 47 on the rendered floor plan"
    expected: "Tables 46 and 47 render as two separate pulsing markers at visibly distinct horizontal positions (46 at ~65.76% x, 47 at ~68.58% x) — no overlap"
    why_human: "Marker visual placement must be eyeballed against the actual floor plan image in a browser. Code-level check confirms distinct coordinates (0.6576 vs 0.6858), but whether the rendered pixel offset is perceptibly distinct on the deployed image requires visual confirmation."
  - test: "Browser resize does not shift markers off tables"
    expected: "With a guest selected, dragging the browser from ~400px to ~1400px wide keeps the pulsing marker centered on its table throughout the resize"
    why_human: "ResizeObserver behavior cannot be validated by static inspection — requires live DOM resize. Code correctly wires ResizeObserver to the img element and updates imageWidth/imageHeight on resize, but runtime tracking fidelity is a visual/timing property."
  - test: "Enlarged-view marker alignment"
    expected: "Clicking the floor plan to enlarge keeps the marker aligned to the correct table within the letterboxed enlarged image"
    why_human: "Enlarged-view math uses offsetX/offsetY from object-fit: contain letterbox calculation — correctness depends on actual rendered container dimensions."
  - test: "CSV reorder tolerance (end-to-end)"
    expected: "Rearranging columns in the source Google Sheet (or swapping to a test sheet with reordered headers) still loads guests correctly with matching table numbers"
    why_human: "The happy-path code logic is code-verified (header-indexed lookup, case-insensitive match). Verifying against a live CSV with truly reordered columns is a data-side test that requires either modifying the source sheet or pointing at a fixture."
---

# Phase 01: Data Integrity Verification Report

**Phase Goal:** All table positions are correct and data parsing is resilient to format changes
**Verified:** 2026-04-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tables 46 and 47 appear in visually distinct positions — no overlap | ✓ VERIFIED (code) / ? NEEDS HUMAN (visual) | floorPlan.json line 49-50: table 46 `{x:0.6576, y:0.3655}`, table 47 `{x:0.6858, y:0.3655}` — coordinates differ by 0.0282 (~2.8% of image width). Visual separation requires browser verification. |
| 2 | Resizing browser window or changing floor plan image does not shift markers off position | ✓ VERIFIED (code) / ? NEEDS HUMAN (runtime) | FloorPlan.tsx lines 50-61: ResizeObserver attached to `imageRef`, updates both `imageWidth` and `imageHeight` via `entry.contentRect`. Markers render using `position.x * imageWidth` / `position.y * imageHeight` (lines 134-135) — intrinsically resolution-independent. `canvasWidth`/`canvasHeight` removed from JSON and interface. |
| 3 | A CSV with reordered or renamed columns still parses correctly without code changes | ✓ VERIFIED | googleSheets.ts lines 5-11 define HEADER_MAP; lines 93-104 `buildHeaderIndex` normalizes via `trim().toLowerCase()`; lines 30-42 build idx by canonical name and loud-fail on missing columns. No positional `fields[0..4]` indexing remains. |

**Score:** 3/3 truths code-verified; 1 requires human visual confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/config/floorPlan.json` | Percentage-based coords, no canvas fields, 54 entries, 46/47 distinct | ✓ VERIFIED | 54 entries present (1-54), all x/y values in [0,1] with 4 decimals, no canvasWidth/canvasHeight keys, 46/47 distinct |
| `src/components/FloorPlan.tsx` | Percentage rendering, ResizeObserver, imageHeight state, no canvas refs, DEV duplicate check | ✓ VERIFIED | All acceptance criteria met: imageHeight (line 37), ResizeObserver (line 53), `position.x * imageWidth` (line 134), `position.y * imageHeight` (line 135), `img.naturalWidth / img.naturalHeight` (line 69), `import.meta.env.DEV` (line 23), no canvasWidth/canvasHeight/scaleFactor substrings |
| `src/services/googleSheets.ts` | Header-indexed parsing with HEADER_MAP, buildHeaderIndex, loud-fail missing columns | ✓ VERIFIED | HEADER_MAP (line 5), buildHeaderIndex (line 93), `toLowerCase()` (line 97), missing-column error (line 41), parseCSVLine preserved unchanged, fetchGuests signature unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| floorPlan.json | FloorPlan.tsx | default JSON import | ✓ WIRED | `import floorPlanConfig from '../config/floorPlan.json'` (line 3); used as `config.tablePositions[tableNumber]` (line 41) |
| FloorPlan.tsx | floorPlan.json | tablePositions lookup | ✓ WIRED | `config.tablePositions` referenced in both render path and DEV duplicate loop |
| googleSheets.ts | App.tsx | fetchGuests() import | ✓ WIRED | Exported function, called from App (existing wiring — unchanged by this phase) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| FloorPlan.tsx marker | `position` | `config.tablePositions[tableNumber]` → floorPlan.json | Yes — 54 real coordinate entries | ✓ FLOWING |
| FloorPlan.tsx render | `imageWidth`/`imageHeight` | `handleImageLoad` (onLoad) + ResizeObserver | Yes — populated from real DOM offsetWidth/contentRect | ✓ FLOWING |
| FloorPlan.tsx enlarged | `enlargedDimensions` | `handleEnlargedImageLoad` computes from naturalWidth/Height | Yes — computed from intrinsic image dims | ✓ FLOWING |
| googleSheets.ts guests | `guests` array | `parseCSVLine` over fetched CSV, mapped via idx | Yes — iterates all non-blank rows | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build passes clean | `npm run build` | tsc + vite build, 40 modules, 0 errors | ✓ PASS |
| No canvas references in src/ | `grep canvasWidth\|canvasHeight\|scaleFactor src/` | No matches | ✓ PASS |
| 46/47 coordinates distinct | Inline inspection of floorPlan.json | 0.6576 vs 0.6858 — differ | ✓ PASS |
| 54 table entries present | JSON inspection | Keys "1" through "54" all present | ✓ PASS |
| All coordinates in [0,1] | JSON inspection | All x/y values 4-decimal floats, 0 ≤ v ≤ 1 | ✓ PASS |
| Live Google Sheets parsing | Requires network + browser | Not run | ? SKIP — routed to human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 01-01 | Table 46 and 47 have correct, distinct coordinates in floorPlan.json | ✓ SATISFIED | floorPlan.json — table 46 `(0.6576, 0.3655)`, table 47 `(0.6858, 0.3655)` distinct |
| DATA-02 | 01-01, 01-02 | Percentage-based coordinates (0-1) surviving image resizes | ✓ SATISFIED | Percentage JSON + percentage render math + ResizeObserver in FloorPlan.tsx |
| DATA-03 | 01-03 | CSV parsing uses column headers instead of positional indexes | ✓ SATISFIED | HEADER_MAP + buildHeaderIndex in googleSheets.ts; no fields[0..4] positional access remains |

All three phase requirements declared in PLAN frontmatter are accounted for. No orphaned REQUIREMENTS.md entries for Phase 1.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None detected | — | Files scanned: floorPlan.json, FloorPlan.tsx, googleSheets.ts. No TODO/FIXME/placeholder/stub markers. No hollow returns. No hardcoded empty-data stubs. |

### Human Verification Required

See frontmatter `human_verification` section. Four items require live browser testing:

1. **Visual 46/47 distinctness** — confirm the two markers render at perceptibly separate horizontal positions on the actual Reception Seat Diagram.png image.
2. **Window resize tracking** — drag browser 400px → 1400px and confirm markers stay centered on their tables throughout.
3. **Enlarged-view alignment** — click to enlarge and confirm marker stays aligned within the letterboxed image.
4. **Live CSV reorder test** — optionally reorder columns in the source Google Sheet (or stage a fixture) to confirm end-to-end resilience beyond unit-level code review.

### Gaps Summary

No code-level gaps. All three ROADMAP success criteria are structurally satisfied by the committed code: (1) 46/47 have distinct coordinates in JSON, (2) percentage-based rendering with ResizeObserver is fully wired with no lingering canvas references, (3) CSV parsing is header-indexed with canonical-name lookup and loud-fail on missing columns. `npm run build` exits 0.

The phase's three success criteria are inherently visual/runtime behaviors — coordinate distinctness must be eyeballed, resize tracking must be observed live, and CSV resilience is best validated with an actually reordered CSV. These are routed to human verification rather than counted as gaps.

A minor environmental deviation exists (ESLint v9 has no flat config in the repo), but this pre-existed this phase and is logged in `deferred-items.md`. It does not affect phase goal achievement.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
