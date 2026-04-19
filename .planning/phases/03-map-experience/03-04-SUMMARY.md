---
phase: 03-map-experience
plan: 04
subsystem: component
tags: [component, markers, image-pipeline, MAP-03, MAP-05]

requires:
  - phase: 03-map-experience
    plan: 02
    provides: 9 static floor-plan variants at /floor-plan/*.{avif|webp|png} addressable at runtime
  - phase: 03-map-experience
    plan: 03
    provides: MapView component with assignedPinRef forwarded to FloorPlan and TransformComponent wrapping FloorPlan
provides:
  - src/components/FloorPlan.tsx — reduced presentational component rendering <picture> (AVIF/WebP/PNG at 900/1600/2400w) + 54 percentage-positioned markers inside useTransformComponent
  - src/components/FloorPlan.css — new .pin-assigned teardrop/.pin-dot slate/.pin-label adaptive system; all enlarge-modal + legacy point-marker/header/legend styles deleted
  - MAP-03 implementation (larger higher-contrast markers with labels — red teardrop pin for assigned, muted slate dots for others, adaptive labels via .labels-visible gate at scale >= 1.8)
  - MAP-05 child half (srcset-aware <picture> element — AVIF → WebP → PNG fallback at 3 widths, loading=eager, decoding=async)
  - Resolution of the Wave 3 FloorPlanProps TypeScript mismatch: `npx tsc --noEmit` now passes cleanly
affects: [03-05-PLAN]

tech-stack:
  added: []
  patterns:
    - "Percentage CSS positioning (left/top as `${pct * 100}%`) replaces pixel-math + ResizeObserver from Phase 1 — resolution-independent, no state cost (RESEARCH.md Pattern 7)"
    - "useTransformComponent returning entire JSX tree — React re-renders only the child subtree on gesture state changes; wrapper class toggle drives CSS fade for neighbor labels (RESEARCH.md Pattern 3)"
    - "<picture> markup uses runtime URL strings for public/ assets (never Vite `import` — anti-pattern)"
    - "Inline SVG teardrop (viewBox 0 0 36 44) with explicit fill/stroke — avoids background-image PNG asset; renders at any zoom without pixelation"
    - "Pointer-events: none on every marker (D-12 visual-only gate) — simultaneously prevents gesture-theft conflict with library and satisfies phase scope"
    - "Backward-compat props (assignedPinRef?/onImageLoad? optional) — lets legacy TableModal continue to compile until Wave 5 deletes it, without ts-ignore or `as any` casts"

key-files:
  created: []
  modified:
    - src/components/FloorPlan.tsx
    - src/components/FloorPlan.css

key-decisions:
  - "Made `assignedPinRef` and `onImageLoad` OPTIONAL in FloorPlanProps (not required as plan draft suggested) so the legacy TableModal.tsx `<FloorPlan tableNumber={...} />` call continues to type-check. Wave 5 will delete TableModal and can tighten these to required if it prefers. This keeps the acceptance criterion `npx tsc --noEmit` green without bypassing strict mode. Auto-fix Rule 3 (blocking issue)."
  - "Typed `assignedPinRef` as `React.Ref<HTMLDivElement>` instead of the plan's literal `React.RefObject<HTMLDivElement | null>`. Reason: React 18 intrinsic `<div ref={...}>` expects `LegacyRef<HTMLDivElement>` which is incompatible with `RefObject<HTMLDivElement | null>` (the non-null generic is stricter). `React.Ref<HTMLDivElement>` is a superset that accepts both MutableRefObject (from useRef<HTMLDivElement | null>(null) in MapView) and callback refs. No behavioral change; purely a type-widening fix. Auto-fix Rule 1 (bug)."
  - "Kept the DEV duplicate-position warning guard verbatim from Phase 1 — retained as a cheap regression guard (explicitly called out in the plan as a survivor)."
  - "Used `line-height: 0` on `.floor-plan-wrapper` to eliminate the ~4px baseline gap below the `<img>`. Without this, markers near y≈1.0 drift down by that gap on some browsers. Small correctness fix, documented here."
  - "Pulse-ring sized at 28×28 positioned at `top: 4px` — sits centered on the teardrop's circular head (which occupies roughly y=0..30 in the 44px pin box). Subtle enough not to compete with the 700ms zoom animation (UI-SPEC `<specifics>`)."

patterns-established:
  - "Container/child handshake: MapView owns pan/zoom state + refs + animation; FloorPlan is purely presentational with three optional props (tableNumber / assignedPinRef / onImageLoad). Clean test boundary — MapView tests mock FloorPlan; FloorPlan-only tests (if added later) don't need the library."
  - "Public-asset URL pattern: runtime strings like `/floor-plan/floor-plan-900.avif` (const-exported at module top for grep-ability). No Vite asset imports for public/ files — per RESEARCH.md anti-patterns."
  - "Inline SVG marker pattern: a single `<path d=...>` with named fill + stroke, wrapped in a positioned `<div>` that has the tap-target footprint. Pattern is reusable for any map overlay needing a custom vector marker."

requirements-completed: [MAP-03, MAP-05]

duration: 3min
completed: 2026-04-17
---

# Phase 3 Plan 04: FloorPlan Refactor Summary

**Refactored FloorPlan.tsx + FloorPlan.css from the Phase 1 pixel-math-with-enlarge-modal component into the reduced container-child shape MapView expects: a single `useTransformComponent` render returning a `<picture>` element (AVIF → WebP → PNG at 900/1600/2400w) plus 54 percentage-positioned markers (red teardrop SVG for the assigned table, muted slate dots for the other 53, adaptive labels gated by `.labels-visible` at scale ≥ 1.8). Implements MAP-03 and the child half of MAP-05. Resolves the Wave 3 `FloorPlanProps` TypeScript mismatch — `npx tsc --noEmit` is now clean.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T14:22:09Z
- **Completed:** 2026-04-17T14:24:59Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (no new files)

## Line Counts (before / after)

| File | Before | After | Δ |
|------|--------|-------|---|
| `src/components/FloorPlan.tsx` | 187 lines | 112 lines | **−75 (−40%)** |
| `src/components/FloorPlan.css` | 250 lines | 137 lines | **−113 (−45%)** |
| **Total** | 437 | 249 | **−188 (−43%)** |

FloorPlan.tsx exceeded the plan's rough "~80 line" target by ~30 lines. The overage is exclusively in well-factored blocks: the three module-scope `*_SRCSET` consts (6 lines), the 8-line DEV duplicate-position guard, and the inline SVG path+number rendering (14 lines for the assigned pin). Every acceptance criterion's grep pattern is present; no dead code. If tightening is required later, collapsing the const URLs to a single `srcsetFor(ext)` helper would save ~4 lines — deferred as not-worth-it.

## Accomplishments

- **`src/components/FloorPlan.tsx` (112 lines)** rewritten:
  - Single `useTransformComponent(({ state }) => <div className={`floor-plan-wrapper ${state.scale >= 1.8 ? 'labels-visible' : ''}`}>…</div>)` as the whole function body
  - `<picture>` with `<source type="image/avif">` + `<source type="image/webp">` + `<img>` PNG fallback, each with 900/1600/2400w srcSet, `sizes="100vw"`, `loading="eager"`, `decoding="async"`
  - 54 markers rendered via `Object.entries(config.tablePositions).map(…)` at `left: ${pos.x * 100}%; top: ${pos.y * 100}%`
  - Assigned table (`id === tableNumber`): `.pin-assigned` wrapper with `ref={assignedPinRef}`, inline SVG teardrop (viewBox 0 0 36 44, `fill="#d90429"`, `stroke="#ffffff"` 2px), `.pin-pulse-ring` behind, `.pin-assigned-number` (white bold) overlaid
  - Other 53: `.pin-dot` with a `.pin-label` span (hidden by default; revealed when parent has `.labels-visible`)
  - DEV duplicate-position warning retained verbatim
  - Props interface: `{ tableNumber: string; assignedPinRef?: React.Ref<HTMLDivElement>; onImageLoad?: () => void }` — `assignedPinRef` / `onImageLoad` are **optional** for backward-compat with legacy TableModal (see Deviations)
  - Zero removed-in-this-plan items retained: no `ResizeObserver`, no `imageWidth`/`imageHeight` state, no `isEnlarged` state, no `handleEnlarge`, no `.floor-plan-header`/`.floor-plan-legend` JSX, no escape-to-close effect, no PNG asset import
- **`src/components/FloorPlan.css` (137 lines)** rewritten:
  - `.floor-plan-wrapper` (position: relative, line-height: 0 to eliminate img baseline gap)
  - `.floor-plan-image` (width:100%, user-select:none, -webkit-user-drag:none)
  - `.pin-assigned` (44×44 with `translate(-50%, -100%)` bottom-tip anchor, drop-shadow)
  - `.pin-assigned-svg` (36×44 centered)
  - `.pin-assigned-number` (14px white bold at top:14px inside the head)
  - `.pin-pulse-ring` (28×28 #d90429 circle at top:4px, consuming `pinPulse` keyframe defined in MapView.css)
  - `.pin-dot` (44×44 hitbox center-anchored) + `.pin-dot::before` (12px slate #8d99ae visual dot with 1px white border)
  - `.pin-label` (12px navy #2b2d42 with double-layer white text-shadow halo, opacity:0 by default, 0.2s ease fade)
  - `.floor-plan-wrapper.labels-visible .pin-dot .pin-label` (opacity:1 cascade)
  - `@media (prefers-reduced-motion: reduce)` disables pulse animation + label transition
  - `@media (max-width: 600px)` shrinks labels to 11px (tap targets stay 44×44)
- **TypeScript `npx tsc --noEmit` now passes cleanly** — the Wave 3 transient error documented in 03-03-SUMMARY.md is resolved by this plan's new FloorPlan interface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite FloorPlan.tsx** — `6c5fda5` (refactor)
2. **Task 2: Rewrite FloorPlan.css** — `1de6796` (refactor)

_Plan metadata commit will be recorded after STATE/ROADMAP updates._

## Files Created/Modified

### Created
_None._

### Modified
- `src/components/FloorPlan.tsx` — full rewrite, 187 → 112 lines (−40%)
- `src/components/FloorPlan.css` — full rewrite, 250 → 137 lines (−45%)

## Verification Results

| Check | Result |
|-------|--------|
| `test -f src/components/FloorPlan.tsx` | ✓ |
| `test -f src/components/FloorPlan.css` | ✓ |
| All 32 Task 1 grep acceptance criteria | ✓ |
| All 27 Task 2 grep acceptance criteria | ✓ |
| `npx tsc --noEmit` | ✓ exits 0 |
| `npm run build` | ✓ exits 0 (43 modules, 214.66 KB JS, 6.43 KB CSS) |
| `npx vitest run` | ✓ 2 passed, 3 todo, 0 failed |

## Decisions Made

- **Made `assignedPinRef` and `onImageLoad` optional props (Rule 3 auto-fix — blocking issue).** The plan's literal interface required both as non-optional. However, `src/components/TableModal.tsx` still calls `<FloorPlan tableNumber={guest.tableNumber} />` without these props (Wave 5 will replace TableModal). Making them required would break `tsc --noEmit` — which is an acceptance criterion of this plan. Making them optional is the minimal surgery that satisfies both the plan's "FloorPlan accepts new props" truth (they ARE accepted; they're just optional) and the tsc-clean criterion. Wave 5 can tighten to required after deleting TableModal.
- **Typed `assignedPinRef` as `React.Ref<HTMLDivElement>` instead of `React.RefObject<HTMLDivElement | null>` (Rule 1 auto-fix — bug).** The literal plan type produced: `Type 'RefObject<HTMLDivElement | null>' is not assignable to type 'LegacyRef<HTMLDivElement>'`. React 18's intrinsic ref prop uses `LegacyRef`, which is a union of `RefObject<T>` (non-null generic), `RefCallback<T>`, and string. `React.Ref<HTMLDivElement>` is exactly that union. The MapView's `useRef<HTMLDivElement | null>(null)` produces a `MutableRefObject<HTMLDivElement | null>` which is assignable to `React.Ref<HTMLDivElement>`. This change preserves the plan's intent (MapView can forward its ref to the marker div) with a stricter-compliant type.
- **Did not flip the 2 remaining `it.todo` entries in MapView.test.tsx.** The plan explicitly does not ask for test-flipping (its acceptance criteria only require tsc-clean and the 59 grep checks). The Wave 3 summary deferred the two zoom-call assertions to Plan 05, citing the need for a `forwardRef`-capable TransformWrapper mock to spy on `zoomToElement`. That infrastructure is not part of this plan's scope. Keeping as `it.todo` honors the Wave 3 deferral and leaves Plan 05's prompt clean.
- **Did not delete TableModal.tsx / TableModal.css** — Wave 5 territory per the prompt note. They remain on disk, still compile against the now-optional FloorPlan props.

## Patterns Established

- **Container/child handshake via optional refs:** `MapView` (container) owns pan/zoom state + refs + animation; `FloorPlan` (child) is purely presentational and accepts the ref as an optional forwarded prop. When the ref is undefined (legacy caller like TableModal), the assigned marker simply doesn't receive a ref attachment — `zoomToElement(null, …)` would be a no-op if it ever fired, but MapView's `hasValidPosition` guard prevents that path in practice.
- **Public-asset URL string constants at module scope:** `AVIF_SRCSET`, `WEBP_SRCSET`, `PNG_SRCSET`, `PNG_FALLBACK_SRC` — keeps the URL strings grep-able (plan's acceptance criteria hinge on this) and avoids re-constructing them on every render.
- **Inline SVG marker with CSS-positioned wrapper:** A single `<path>` teardrop inside a CSS-positioned 44×44 div. Reusable for any future map-marker variant: change the viewBox + path + fill, keep the wrapper positioning math identical.

## Deviations from Plan

### Auto-fixed Issues (no user permission needed per Rule 1 / Rule 3)

**1. [Rule 3 — Blocking Issue] `assignedPinRef` + `onImageLoad` made optional instead of required**
- **Found during:** Task 1 (first `npx tsc --noEmit` run)
- **Issue:** Literal interface `{ assignedPinRef: React.RefObject<HTMLDivElement | null>; onImageLoad: () => void }` (both required) breaks `src/components/TableModal.tsx` line 43 (`<FloorPlan tableNumber={guest.tableNumber} />`), which does not pass these props. TableModal is still imported by App.tsx and will not be removed until Wave 5. Keeping required props would fail the plan's own `npx tsc --noEmit` acceptance criterion.
- **Fix:** Added `?:` to both props in FloorPlanProps. Annotated with a comment explaining Wave 5 will tighten if desired.
- **Files modified:** `src/components/FloorPlan.tsx`
- **Commit:** `6c5fda5`

**2. [Rule 1 — Type Bug] `assignedPinRef` type widened from `React.RefObject<HTMLDivElement | null>` to `React.Ref<HTMLDivElement>`**
- **Found during:** Task 1 (second `npx tsc --noEmit` run, after fix 1)
- **Issue:** `RefObject<HTMLDivElement | null>` (non-null generic with nullable payload) is not assignable to React 18's intrinsic `<div ref={...}>` prop, which expects `LegacyRef<HTMLDivElement>` = `RefObject<HTMLDivElement> | RefCallback<HTMLDivElement> | string | null`. The `| null` inside the generic makes the strict-mode check reject the assignment.
- **Fix:** Used `React.Ref<HTMLDivElement>` which is the official union type React 18 uses for ref props. Accepts MutableRefObject (from MapView's `useRef<HTMLDivElement | null>(null)`), callback refs, and null.
- **Files modified:** `src/components/FloorPlan.tsx`
- **Commit:** `6c5fda5` (folded in before first commit)

**Both fixes were necessary to satisfy `npx tsc --noEmit` in the plan's acceptance criteria.** No user permission needed (Rule 1 + Rule 3). No architectural change (Rule 4 not triggered).

### Scope boundaries honored

- TableModal.tsx + TableModal.css — not modified (Wave 5 territory per prompt note). Still compile cleanly against the new optional-props FloorPlan.
- App.tsx — not modified (Wave 5 territory per prompt note). Still renders `<TableModal>` which still renders `<FloorPlan>`. This is technically a broken runtime path right now because FloorPlan now tries to call `useTransformComponent` which requires a `TransformWrapper` ancestor — TableModal does NOT wrap FloorPlan in one. **This is the intended transient state until Wave 5 swaps `<TableModal>` for `<MapView>` in App.tsx.** If the user exercises the "select a guest" flow before Wave 5 lands, the runtime will throw. Build + typecheck + tests all pass, but there is a known runtime regression on the legacy path. See "Deferred Issues" below.
- MapView.test.tsx — not touched (Wave 5 owns the remaining test flips per 03-03-SUMMARY.md).

## Issues Encountered

- **TypeScript ref-type mismatch** between the plan's suggested `React.RefObject<HTMLDivElement | null>` and React 18's intrinsic `<div ref={...}>` expectation (`LegacyRef<HTMLDivElement>`). Resolved by widening to `React.Ref<HTMLDivElement>`. Documented as Deviation #2 above.
- **TableModal cross-cut compilation issue.** TableModal calls `<FloorPlan tableNumber={...} />` without the new props. Required making the new props optional (Deviation #1). This does NOT fix the runtime issue (see Deferred Issues below) but keeps tsc/build green until Wave 5.

## User Setup Required

None — all changes are in-repo files. No new dependencies; no config file changes.

## UAT Observation for the 44×44 Tap-Target Question

The plan's `<output>` section asks for an observation on whether the 44×44 tap-target size looks appropriate at overview zoom.

**Observation (reasoned, not measured):** With `minScale: 1.0` (fit-to-viewport), the 3300×2517 source image scales to ~390px wide on a typical iPhone 14 viewport (390×844 device pixels). Scaled proportionally, the 44px pin box occupies ~11% of viewport width — which is ~1.1× the typical Apple HIG tap-target threshold relative to viewport density. Visually, this is probably **slightly oversized** at overview zoom but does NOT create legibility problems because:

1. D-12 makes markers pointer-events: none this phase — so the 44px is a *visual* footprint, not a tap zone. The perceived size is dominated by the 36×44 teardrop for the assigned pin (SVG inside the hitbox) and the 12px `::before` dot for the others (visible dot within the 44px hitbox). 53 tiny 12px dots will NOT look cluttered at overview.
2. At 2.75× zoom (the final animation state), the 44px renders at 44×2.75 = 121px relative to the image — unambiguously comfortable for both visual parsing and (future) tap targets if D-12 is relaxed later.

**Runtime-tunable knob:** If UAT (step 4 / step 6 in 03-VALIDATION.md) flags the pins as too large at overview, the single knob to touch is `.pin-assigned { width: 44px; height: 44px }` and `.pin-dot { width: 44px; height: 44px }`. Dropping both to 36×36 (with .pin-assigned-svg → 30×36, .pin-assigned-number → top:12px, .pin-pulse-ring → 24×24 at top:4px) would be the next retune. No JS changes needed; CSS-only.

**Recommendation:** Ship the 44×44 to UAT, decide empirically. Do not pre-tune.

## Next Phase Readiness

- **Plan 03-05 (App.tsx wiring + cleanup)**: Unblocked. Wave 5 now has:
  1. A `<MapView>` ready to be swapped in for `<TableModal>` in App.tsx
  2. A FloorPlan that matches MapView's contract cleanly (tsc green)
  3. 9 static image variants in `public/floor-plan/`
  4. 3 `it.todo` test stubs remaining to flip (2 in MapView.test.tsx, 1 in App.test.tsx) — all in the Wave 5 brief per 03-03-SUMMARY.md
  5. TableModal.tsx + TableModal.css to delete

  **Wave 5 MUST do:** Replace `<TableModal>` with `<MapView key={selectedGuest.tableNumber} guest={selectedGuest} onClose={closeModal} />` in App.tsx. Add the `<link rel=preload>` useEffect + belt-and-suspenders hidden img. Delete TableModal.tsx + TableModal.css. After these changes, Wave 5 MAY tighten FloorPlanProps back to required-rather-than-optional if it prefers — the backward-compat hedge will no longer be needed.

- **UAT gate** (Phase verification): After Plan 05 lands, the 19-step UAT in 03-VALIDATION.md can run. Steps that validate this plan's surface: 4 (red teardrop pin pulsing), 6 (assigned table prominent + neighbors visible), 7 (neighbor labels fade in at zoom ≥ 1.8×), 15-17 (AVIF served + srcset selection + compression legibility).

## Deferred Issues

### Known runtime regression on legacy TableModal path

**Severity:** transient (resolved by Wave 5)
**Description:** TableModal.tsx → FloorPlan (new version) calls `useTransformComponent(...)` which requires a `TransformWrapper` ancestor. TableModal does NOT wrap FloorPlan in one. If a user triggers guest selection before Wave 5 lands, the legacy path will throw a runtime error.
**Mitigation:** Wave 5 deletes TableModal entirely and routes through MapView (which does provide `TransformWrapper`). Not fixing here because:
  1. Plan 03-04 scope is strictly the two files listed in frontmatter (`FloorPlan.tsx` + `FloorPlan.css`)
  2. The prompt explicitly says "If App.tsx breaks compilation, that's expected (Wave 5 territory) — document in SUMMARY deferrals"
  3. Build/typecheck/tests all pass — this is a runtime-only regression on a path Wave 5 is removing
**Workaround until Wave 5:** Do not run `npm run dev` and click through a guest selection. If testing is needed, Wave 5 can be executed immediately — it has no other blockers.

### Tests still in it.todo (per Wave 3 plan, not re-opened here)

- `MapView.test.tsx > 'zooms to assigned table'` — awaits Wave 5 forwardRef-capable mock
- `MapView.test.tsx > 'overview hold before zoom'` — same
- `App.test.tsx > 'preload link injected on mount'` — awaits Wave 5 preload useEffect

No change to this state from Plan 04 — none of these tests need the new FloorPlan shape specifically; they need Wave 5's App.tsx + mock infrastructure.

### TypeScript Warnings Noted for Plan 05's Attention

_None remaining._ The Wave 3 transient `FloorPlanProps` mismatch is resolved. `npx tsc --noEmit` is clean.

## Self-Check

- [x] `src/components/FloorPlan.tsx` exists at 112 lines (plan target: ~80, actual: 112; within tolerance, justified above)
- [x] `src/components/FloorPlan.css` exists at 137 lines (plan target: 80+; actual: 137; justified above)
- [x] Commit `6c5fda5` exists in git log (Task 1 — FloorPlan.tsx)
- [x] Commit `1de6796` exists in git log (Task 2 — FloorPlan.css)
- [x] All 32 Task 1 grep acceptance criteria pass
- [x] All 27 Task 2 grep acceptance criteria pass
- [x] `npx tsc --noEmit` exits 0 (Wave 3 mismatch resolved)
- [x] `npm run build` exits 0 (Vite production build)
- [x] `npx vitest run` exits 0 (2 passed, 3 todo, 0 failed)
- [x] FloorPlan.tsx contains `useTransformComponent`, `assignedPinRef`, `onImageLoad`, `state.scale >= 1.8`, AVIF/WebP/PNG srcsets with 900w/1600w/2400w, `pin-assigned`, `pin-dot`, `pin-pulse-ring`, `pin-label`, `pin-assigned-number`, `#d90429`, `pos.x * 100`, `pos.y * 100`
- [x] FloorPlan.tsx does NOT contain `ResizeObserver`, `isEnlarged`, `imageWidth`, `handleEnlarge`, `Reception Seat Diagram.png` import
- [x] FloorPlan.css contains `.floor-plan-wrapper`, `.pin-assigned`, `.pin-dot`, `.pin-label`, `.pin-pulse-ring`, `.pin-assigned-number`, `#d90429`, `#8d99ae`, `animation: pinPulse`, `translate(-50%, -100%)`, `translate(-50%, -50%)`, `width: 44px`, `opacity: 0;`, `.labels-visible .pin-dot .pin-label`, `text-shadow: 0 0 3px #ffffff, 0 0 3px #ffffff`, `@media (prefers-reduced-motion: reduce)`, `@media (max-width: 600px)`
- [x] FloorPlan.css does NOT contain `point-marker`, `floor-plan-header`, `floor-plan-legend`, `floor-plan-enlarged`, `@keyframes ripple`, `@keyframes pulse ` (legacy), `#ef233c`

## Self-Check: PASSED

---
*Phase: 03-map-experience*
*Completed: 2026-04-17*
