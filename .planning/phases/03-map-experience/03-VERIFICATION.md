---
phase: 03-map-experience
verified: 2026-04-17T14:42:30Z
status: human_needed
score: 5/5 must-haves verified (code-complete; 4 of 5 require iPhone UAT sign-off)
overrides_applied: 0
automated_gates:
  typecheck: passed
  build: passed
  tests: passed (2 files, 5 tests)
  lint: passed
uat_required:
  - requirement: MAP-01
    why: Animation smoothness/feel is subjective and only observable on real iOS Safari
  - requirement: MAP-02
    why: Pinch-to-zoom and drag-to-pan require real touch hardware
  - requirement: MAP-03
    why: Visual hierarchy (red pin vs slate dots, adaptive labels at >=1.8x) needs human eye
  - requirement: MAP-04
    why: iOS Safari scroll-bleed and rubber-band only reproduce on device
  - requirement: MAP-05
    why: Browser <picture> format negotiation (AVIF delivery, srcset selection) only observable via DevTools on real browser
human_verification:
  - test: "UAT step 3–7: Open app on iPhone, select a guest, observe full-screen map"
    expected: "Map opens edge-to-edge; red teardrop on correct table; 250ms hold then ~700ms smooth zoom to 2.75×; neighbor labels fade in at final zoom"
    why_human: "Animation feel and visual hierarchy — not programmatically assertable"
  - test: "UAT steps 8–9: Pinch and drag the map on iPhone"
    expected: "Gestures work; page behind does NOT scroll or rubber-band"
    why_human: "Requires real iOS Safari gesture engine; jsdom has no touch model"
  - test: "UAT step 10: Double-tap a point on the map"
    expected: "Zoom toggles between current and ~2.75×"
    why_human: "doubleClick prop wired (mode:'toggle', step:2.75) but behavior only observable on device"
  - test: "UAT step 15: DevTools → Network → filter image/avif, reload with cache off"
    expected: "Floor plan served as AVIF (one of 900/1600/2400 widths)"
    why_human: "Browser picture/srcset negotiation cannot be mocked meaningfully"
  - test: "UAT step 16: Resize browser to 600px wide OR use iPhone viewport"
    expected: "900w AVIF variant is the one fetched (not 2400w)"
    why_human: "Browser sizes+srcset picker behavior is per-engine"
  - test: "UAT step 17: On iPhone, zoom in on the floor plan"
    expected: "All table numbers remain legible — no AVIF q=50 compression artifacts destroying text"
    why_human: "Visual quality judgment on real device + display DPI"
  - test: "UAT step 18: Enable Reduce Motion in iOS Settings, select a guest"
    expected: "Zoom jumps instantly to final state; pin pulse disabled"
    why_human: "OS-level accessibility toggle"
  - test: "UAT step 19: While map is open, search and select a DIFFERENT guest"
    expected: "Map re-runs overview-hold-zoom sequence for new pin with no stuck half-zoomed state"
    why_human: "End-to-end state transition — key={tableNumber} remount pattern wired but only observable in real use"
requirements_verified:
  - id: MAP-01
    status: PASS (code); UAT-gated for animation feel
    evidence: "MapView.tsx:71-78 zoomToElement(pin, 2.75, 700, 'easeOutQuart', 0, 64); 250ms hold at line 66-79; vitest 'zooms to assigned table' and 'overview hold before zoom' pass"
  - id: MAP-02
    status: PASS (code); UAT-gated for real pinch/pan
    evidence: "MapView.tsx:115-128 TransformWrapper with pinch.disabled:false, panning.velocityDisabled:false, minScale=1.0, maxScale=6, doubleClick.mode=toggle step=2.75"
  - id: MAP-03
    status: PASS (code); UAT-gated for visual quality
    evidence: "FloorPlan.tsx:47-109 renders 54 markers with .pin-assigned (red #d90429 teardrop SVG + pulse ring + number) for assigned table, .pin-dot (slate #8d99ae) for others; adaptive labels gated by state.scale >= 1.8 (FloorPlan.tsx:52); 44×44 hitbox; FloorPlan.css:101-116 label fade cascade"
  - id: MAP-04
    status: PASS (code); UAT-gated for iOS scroll-bleed
    evidence: "MapView.css:38 position:fixed; inset:0; line 42 overscroll-behavior:contain; lines 51,59 touch-action:none; reduced-motion guard MapView.tsx:62-67 collapses hold+zoom to 0ms"
  - id: MAP-05
    status: PASS (code); UAT-gated for real AVIF delivery
    evidence: "9 variants exist public/floor-plan/*.{avif,webp,png} (27.9KB to 895.1KB); FloorPlan.tsx:57-70 <picture> with AVIF→WebP→PNG <source> chain at 900/1600/2400w; App.tsx:28-43 preload link with imagesrcset + fetchPriority=high; App.tsx:125-130 belt-and-suspenders hidden <img>; dist/floor-plan/ confirms Vite passthrough"
deferred: []
---

# Phase 3: Map Experience — Verification Report

**Phase Goal:** Selecting a guest animates the floor plan to center on their table, and the map is usable on mobile (MAP-01..MAP-05).
**Verified:** 2026-04-17T14:42:30Z
**Status:** human_needed — all automation gates green; UAT sign-off still required per 03-VALIDATION.md
**Re-verification:** No — initial verification

---

## Executive Summary

Phase 3 is **code-complete**. Every automated gate is green:

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npm run build` | PASS (exit 0, 43 modules, 217.74 KB JS / 6.84 KB CSS) |
| `npx vitest run` | PASS (2 files, 5/5 tests passing, 0 todo, 0 failed) |
| `npm run lint` | PASS (exit 0, 0 warnings) |
| Image variants exist | PASS (9 files at `public/floor-plan/`) |
| Dist contains images | PASS (9 files at `dist/floor-plan/`) |
| TableModal deleted | PASS (zero references under `src/`) |
| No `it.todo` remaining | PASS |
| No TODO/FIXME in Phase 3 surfaces | PASS |

Five of five Phase 3 requirements (MAP-01..MAP-05) have code in place that implements the stated design. However, all five have UAT-gated acceptance checks per `03-VALIDATION.md` — animation feel, pinch-to-zoom on real hardware, visual hierarchy judgment, iOS Safari scroll-bleed, and real AVIF delivery cannot be asserted from jsdom. Overall status is **human_needed** until the 19-step iPhone UAT script is executed.

---

## Goal Achievement — Observable Truths

Derived from ROADMAP.md Phase 3 Success Criteria.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After selecting a name, the floor plan smoothly pans and zooms to place the guest's table near the center of the screen | VERIFIED (code); UAT-gated | `MapView.tsx:69-79` — `setTimeout(holdMs)` then `zoomToElement(pin, 2.75, zoomMs, 'easeOutQuart', 0, 64)`. Vitest `'zooms to assigned table'` and `'overview hold before zoom'` both pass. Feel is UAT step 5. |
| 2 | A guest on an iPhone can pinch to zoom and drag to pan the floor plan without triggering page scroll | VERIFIED (code); UAT-gated | `MapView.tsx:115-128` TransformWrapper with `pinch.disabled:false`, `panning.velocityDisabled:false`, `minScale:1.0`, `maxScale:6`. `MapView.css` lines 38,42,51,59 apply `position:fixed; inset:0`, `overscroll-behavior:contain`, `touch-action:none` (triple defense). Real pinch is UAT steps 8–9. |
| 3 | Table markers show their table number as a readable label and are large enough to tap accurately on a phone screen | VERIFIED (code); UAT-gated | `FloorPlan.tsx:47-109` — assigned pin is an inline SVG teardrop (`#d90429` fill, white 2px stroke) with `pin-assigned-number` label + `pin-pulse-ring`. Other 53 markers are `pin-dot` slate (`#8d99ae`). Both are 44×44 (FloorPlan.css). Adaptive labels gated by `state.scale >= 1.8` (FloorPlan.tsx:52). Visual quality is UAT step 4+7. |
| 4 | The animated zoom works correctly on iOS Safari — no scroll bleed-through or layout jump | VERIFIED (code); UAT-gated | `position:fixed;inset:0` avoids `vh`-unit layout jump (RESEARCH.md Pitfall 3). `overscroll-behavior:contain` + `touch-action:none` prevent scroll bleed. Reduced-motion path collapses to 0ms (MapView.tsx:62-67). iOS device check is UAT steps 8–9. |
| 5 | Floor plan image loads quickly on mobile — visibly compressed without quality loss on phone screens | VERIFIED (code); UAT-gated | 9 variants exist: 900w AVIF=27.9KB, 1600w AVIF=59.2KB, 2400w AVIF=89.7KB. `<picture>` with AVIF→WebP→PNG at 3 widths + preload link (App.tsx:28-43) + hidden `<img>` fetch belt-and-suspenders (App.tsx:125-130). Real AVIF delivery + phone-screen quality is UAT steps 15–17. |

**Score:** 5/5 truths verified at code level. All 5 have explicit UAT-gated residuals.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/MapView.tsx` | Full-screen animated map overlay with zoom orchestration | VERIFIED | 143 lines. Contains `zoomToElement`, `2.75`, `easeOutQuart`, `history.pushState`, `popstate`, `prefers-reduced-motion`, `aria-label="Close map"`. |
| `src/components/MapView.css` | Overlay/card/button styles + pinPulse + iOS safeguards | VERIFIED | 189 lines. Contains `position:fixed;inset:0`, `overscroll-behavior:contain`, `touch-action:none` (2 instances), `@keyframes pinPulse`, `safe-area-inset-*`, reduced-motion media query. |
| `src/components/FloorPlan.tsx` | Refactored presentational child with `<picture>` + percentage markers | VERIFIED | 112 lines. `useTransformComponent`, AVIF/WebP/PNG srcSets at 900/1600/2400w, assigned pin SVG, pin-dot/pin-label adaptive system, `state.scale >= 1.8` gate. |
| `src/components/FloorPlan.css` | Pin styles with adaptive label cascade | VERIFIED | 137 lines. `.pin-assigned`, `.pin-dot`, `.pin-label`, `.pin-pulse-ring`, `#d90429`, `#8d99ae`, `translate(-50%,-100%)`, `labels-visible` cascade, reduced-motion + 600px media queries. |
| `scripts/generate-images.mjs` | Sharp-based image pipeline | VERIFIED | Node ESM script; produces 9 variants deterministically. |
| `public/floor-plan/floor-plan-{900,1600,2400}.{avif,webp,png}` | 9 image variants | VERIFIED | All 9 files present with correct byte sizes per 03-02-SUMMARY.md. AVIF < WebP < PNG at every width. |
| `src/App.tsx` | MapView wired; preload link injected | VERIFIED | Imports MapView (not TableModal); renders `<MapView key={selectedGuest.tableNumber} …>`; preload useEffect with `rel='preload'`, `type='image/avif'`, `imagesrcset`, `imagesizes='100vw'`, `fetchPriority='high'`; hidden `<img src="/floor-plan/floor-plan-1600.avif" …>`. |
| `src/components/MapView.test.tsx` | 4 real tests, no todos | VERIFIED | 4 passing tests: zoomToElement call args, 250ms hold, missing-table fallback, picture source tree. |
| `src/App.test.tsx` | Preload link test, no todos | VERIFIED | 1 passing test: preload link injected on mount with all 6 attributes. |
| `eslint.config.js` | ESLint v9 flat config | VERIFIED | Fixes pre-existing lint rot; `npm run lint` exits 0. |
| `src/test/setup.ts` | jest-dom + matchMedia polyfill | VERIFIED | matchMedia polyfill keeps MapView tests green under jsdom 26. |
| `src/components/TableModal.tsx` | DELETED (D-01) | VERIFIED | File absent; no references anywhere in `src/`. |
| `src/components/TableModal.css` | DELETED (D-01) | VERIFIED | File absent. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| App.tsx | MapView | `import MapView from './components/MapView'` | WIRED | App.tsx:7 |
| App.tsx | MapView render | `<MapView key={selectedGuest.tableNumber} guest={...} onClose={closeModal}/>` | WIRED | App.tsx:117-123 |
| App.tsx | preload link | `useEffect` appends `<link rel=preload>` to `document.head` | WIRED | App.tsx:28-43 with cleanup on unmount |
| MapView | FloorPlan | Child of `<TransformComponent>`; passes `tableNumber`, `assignedPinRef`, `onImageLoad` | WIRED | MapView.tsx:133-137 |
| MapView | react-zoom-pan-pinch | `TransformWrapper` ref + imperative `zoomToElement` | WIRED | MapView.tsx:71-78 |
| FloorPlan | `<picture>` AVIF/WebP/PNG | `<source type="image/avif">` + `<source type="image/webp">` + `<img>` PNG | WIRED | FloorPlan.tsx:57-70 with 100vw sizes |
| FloorPlan | `public/floor-plan/*` | Hard-coded URL strings (AVIF_SRCSET, WEBP_SRCSET, PNG_SRCSET, PNG_FALLBACK_SRC) | WIRED | FloorPlan.tsx:27-33; files confirmed in public/ and dist/ |
| MapView | Escape dismissal | `document.addEventListener('keydown')` → onClose | WIRED | MapView.tsx:27-35 |
| MapView | Back dismissal | `history.pushState` + `popstate` listener → onClose | WIRED | MapView.tsx:39-55 (with cleanup that pops the pushed entry) |
| MapView | × button dismissal | `<button onClick={onClose} aria-label="Close map">` | WIRED | MapView.tsx:104-112 |
| MapView | reduced-motion guard | `window.matchMedia('(prefers-reduced-motion: reduce)').matches` | WIRED | MapView.tsx:62-67; holdMs/zoomMs both collapse to 0 |

All 11 key links verified.

---

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|----------|---------------|--------|--------------------|--------|
| MapView | `guest` | Prop from App.tsx `selectedGuest` state, sourced from Google Sheets CSV → `searchGuests` → `GuestDropdown.onSelect` | YES (real guest list from fetchGuests) | FLOWING |
| MapView | `hasValidPosition` | Computed from `floorPlanConfig.tablePositions[guest.tableNumber]` | YES (54 tables in floorPlan.json) | FLOWING |
| FloorPlan | `config.tablePositions` | Imported from `../config/floorPlan.json` | YES (54 entries, percentage coords from Phase 1) | FLOWING |
| FloorPlan | `state.scale` | From `useTransformComponent` callback, driven by user gestures / `zoomToElement` | YES (real transform state) | FLOWING |
| App.tsx | hidden `<img src>` | Hardcoded string `/floor-plan/floor-plan-1600.avif` | YES (file exists in public/) | FLOWING |
| App.tsx | preload link `imagesrcset` | Hardcoded string with all 3 AVIF widths | YES (all 3 files exist) | FLOWING |

No hollow props, no static empty returns. All rendered data flows from real sources (CSV guests → floorPlan.json coords → transform state → DOM).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest suite runs without hanging | `npx vitest run` | 2 files, 5 passed, 0 todo, 0 failed, 796ms | PASS |
| TypeScript strict mode clean | `npx tsc --noEmit` | exit 0 | PASS |
| Production build succeeds | `npm run build` | exit 0, 43 modules, 217.74 KB JS | PASS |
| Lint clean (0 warnings) | `npm run lint` | exit 0 | PASS |
| All 9 image variants exist on disk | `ls public/floor-plan/` | 9 files (3 AVIF + 3 WebP + 3 PNG) | PASS |
| Build copies images to dist | `ls dist/floor-plan/` | 9 files present | PASS |
| TableModal.tsx deleted | `test -f src/components/TableModal.tsx` | absent | PASS |
| TableModal.css deleted | `test -f src/components/TableModal.css` | absent | PASS |
| No TableModal references | `grep -rn TableModal src/` | 0 matches | PASS |
| No it.todo remaining | `grep -rn "it\.todo" src/` | 0 matches | PASS |

All 10 spot-checks PASS.

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| MAP-01 | 03-03, 03-05 | Floor plan animates with smooth pan + zoom to center on assigned table when selected | SATISFIED (code); UAT-gated | MapView.tsx:69-79 orchestration; vitest `zooms to assigned table` + `overview hold before zoom` pass; feel verified by UAT step 5 |
| MAP-02 | 03-03, 03-05 | Guest can pinch-to-zoom and pan the floor plan on mobile | SATISFIED (code); UAT-gated | TransformWrapper configured for pinch+pan (MapView.tsx:115-128); real iPhone gesture is UAT steps 8–9 |
| MAP-03 | 03-04 | Table markers are larger and higher-contrast with visible number labels | SATISFIED (code); UAT-gated | FloorPlan.tsx:47-109 + FloorPlan.css .pin-assigned/.pin-dot/.pin-label; palette confirmed (#d90429 / #8d99ae); adaptive labels at scale>=1.8 |
| MAP-04 | 03-03, 03-05 | Animated zoom works correctly on iOS Safari without scroll bleed-through | SATISFIED (code); UAT-gated | position:fixed + overscroll-behavior:contain + touch-action:none triple defense; reduced-motion guard; device verification UAT |
| MAP-05 | 03-02, 03-04, 03-05 | Floor plan image optimized for mobile (compressed, appropriate resolution) | SATISFIED (code); UAT-gated | 9 variants generated (900w AVIF 27.9KB — ~98% smaller than 1.5MB source); `<picture>` fallback chain + preload link + hidden img belt-and-suspenders; DevTools AVIF confirmation UAT steps 15–17 |

No orphaned requirements. REQUIREMENTS.md Traceability table marks MAP-01..MAP-05 as "Complete"; this verification confirms code-level completeness with UAT as the acceptance gate.

---

## Anti-Patterns Scan

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| src/ (all Phase 3 files) | `TODO\|FIXME\|XXX\|HACK\|PLACEHOLDER` | — | 0 matches (the 2 `placeholder` matches are in SearchForm: `::placeholder` CSS pseudo-class and `placeholder="Enter first or last name"` attribute — not stubs) |
| src/ | `it\.todo\|it\.skip\|xit\|xdescribe` | — | 0 matches |
| src/ | `TableModal` | — | 0 matches (cleanly deleted) |
| MapView.tsx | hardcoded empty returns | — | None. `return <div …>` renders real overlay JSX with guest data |
| FloorPlan.tsx | hollow props to children | — | None. All props forwarded from App.tsx `selectedGuest` (real data) |
| MapView.tsx | empty handlers / preventDefault-only | — | None. onClose always invoked; keydown + popstate handlers do real work |
| App.tsx | empty useEffect | — | None. Two useEffects: `loadGuests()` (real CSV fetch) + preload link injection (real DOM mutation) |

No anti-patterns detected in Phase 3 surfaces.

---

## Human Verification Required

Per 03-VALIDATION.md `## Manual-Only Verifications`, the following MUST be executed on an actual iPhone running current iOS Safari (plus a desktop browser for cross-check):

### 1. UAT Steps 3–7: Full map reveal animation

**Test:** Open app on iPhone → search a name → select a guest.
**Expected:** Full-screen map opens edge-to-edge. Red teardrop pin pulses on correct table. Overlay card shows "Welcome, {firstName}! — Table {N}" at top. After ~250ms hold, map smoothly zooms (~700ms) to center on the pin. Neighbor labels fade in at final zoom level.
**Why human:** Animation feel and visual hierarchy are subjective and not programmatically assertable.

### 2. UAT Steps 8–9: Pinch-to-zoom + drag-to-pan on iPhone

**Test:** Pinch in/out on the map; drag in any direction.
**Expected:** Gestures work smoothly. Page behind does NOT scroll. No rubber-band bleed at zoom bounds.
**Why human:** jsdom has no touch engine; `touch-action:none` + `overscroll-behavior:contain` behavior only reproducible on real iOS.

### 3. UAT Step 10: Double-tap toggle

**Test:** Double-tap any point on the map.
**Expected:** Zoom toggles between current and ~2.75×.
**Why human:** Library `doubleClick.mode='toggle'` wired but only observable on device.

### 4. UAT Step 11/12/13: Three dismissal affordances

**Test:** Tap ×; then reproduce, press hardware/Android back OR swipe-back on iOS; then reproduce on desktop and press Escape.
**Expected:** Each path closes the map and returns to search with dropdown state intact.
**Why human:** `onClose` wiring unit-tested; real browser back-button behavior requires device.

### 5. UAT Step 14: Missing-table fallback

**Test:** Edit `floorPlan.json` to remove a guest's table OR assign a guest to a non-existent table; open map.
**Expected:** Map opens, overview stays visible, overlay card shows "Table {N} — please ask staff for directions".
**Why human:** Edge case; unit test covers fallback text presence but real selection flow is a manual integration check.

### 6. UAT Step 15: Browser serves AVIF to modern devices

**Test:** DevTools → Network → filter `image/avif` → reload with cache off.
**Expected:** Floor plan served as one of `floor-plan-900.avif`, `floor-plan-1600.avif`, or `floor-plan-2400.avif`.
**Why human:** Browser `<picture>` format negotiation cannot be mocked meaningfully in jsdom.

### 7. UAT Step 16: srcset picks smaller variant on mobile viewport

**Test:** Resize browser to 600px wide OR load app on iPhone native viewport.
**Expected:** 900w AVIF variant fetched (not 2400w).
**Why human:** Browser `sizes` + `srcset` resolver is per-engine and per-viewport.

### 8. UAT Step 17: AVIF compression quality on iPhone

**Test:** On iPhone, open map and pinch-zoom in on floor plan.
**Expected:** All table numbers remain legible. No AVIF q=50 compression artifacts destroying text.
**Why human:** Visual quality judgment on real display + DPI.

### 9. UAT Step 18: Reduced-motion path

**Test:** iOS Settings → Accessibility → Reduce Motion ON → open app → select a guest.
**Expected:** Zoom jumps instantly to final state (no 700ms animation). Pin pulse disabled.
**Why human:** OS-level accessibility toggle cannot be set from test code; the `prefers-reduced-motion` CSS + `matchMedia` path is wired and unit-covered.

### 10. UAT Step 19: Guest-switch mid-session

**Test:** Select a guest → while map is open, search + select a DIFFERENT guest.
**Expected:** Map re-runs overview-hold-zoom sequence for the new pin. No stuck half-zoomed state.
**Why human:** `key={selectedGuest.tableNumber}` remount pattern wired (App.tsx:119); end-to-end remount behavior only observable in real use.

---

## Gaps Summary

**No code gaps.** Phase 3 is code-complete. All automation gates (tsc, vitest, lint, build) pass. All 5 Phase 3 requirements have implementations consistent with the ROADMAP success criteria. TableModal has been cleanly deleted. The `it.todo` test stubs from earlier waves are all flipped to real passing tests.

**Residual work:** The 10 UAT items above are the documented acceptance gate per `03-VALIDATION.md`. None of them can be automated (iOS Safari gesture engine, OS accessibility toggles, browser format negotiation, real-device visual quality). Until they are executed on an actual iPhone and a desktop browser, Phase 3 is not production-ready for the wedding event.

**Recommendation:**
- If the developer has an iPhone handy: run the 19-step UAT script in `03-VALIDATION.md`, mark all rows ✓, and Phase 3 can be closed as PASSED.
- If UAT reveals issues: run `/gsd-plan-phase 3 --gaps` with specific failures noted.
- If UAT cannot be performed yet (no device access): Phase 3 remains `human_needed`. Phase 4 (Performance & Offline) is independently executable per ROADMAP.md (Phase 4 depends on Phase 2, not Phase 3), so forward progress is not blocked.

---

## Commits in Phase 3

| Plan | Commits |
|------|---------|
| 03-01 | 0876c46, dd65fcc, 001bd62 |
| 03-02 | 7963d20, 70c005c, fb03034 |
| 03-03 | e8c8e98, f82b576, 3df81cb, e3425c4 |
| 03-04 | 6c5fda5, 1de6796, 12e42ff |
| 03-05 | b1565ee, 3987928, 7fecfb8, 6deeacf |

16 commits across 5 plans, all atomic and described per subsystem (chore/test/feat/refactor/docs).

---

## Final Verdict

**PASS (code) — human_needed (UAT)**

All automated gates green; all 5 Phase 3 requirements have implementations that satisfy the ROADMAP success criteria at the code level; data flows from real sources through wired connections; no anti-patterns detected; TableModal cleanup complete.

Status is `human_needed` because every Phase 3 requirement has at least one UAT-gated acceptance check per `03-VALIDATION.md` that requires an actual iPhone running current iOS Safari (or a desktop browser for the Escape + DevTools checks). This is a known constraint documented upfront in the phase's validation strategy, not a deficiency of the implementation.

---

_Verified: 2026-04-17T14:42:30Z_
_Verifier: Claude (gsd-verifier)_
