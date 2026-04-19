---
phase: 03-map-experience
plan: 03
subsystem: component
tags: [component, animation, ios-gestures, MAP-01, MAP-02, MAP-04]

requires:
  - phase: 03-map-experience
    plan: 01
    provides: react-zoom-pan-pinch@4.0.3 installed; vitest + testing-library stack; MapView.test.tsx stub with 4 it.todo entries
  - phase: 03-map-experience
    plan: 02
    provides: 9 static floor-plan variants at /floor-plan/*.avif|webp|png addressable at runtime
provides:
  - src/components/MapView.tsx — full-screen animated map overlay component with TransformWrapper + zoomToElement orchestration
  - src/components/MapView.css — overlay/card/button styles + pinPulse keyframe + safe-area handling + reduced-motion + mobile breakpoint
  - MAP-01 implementation (animated pan + zoom on selection — 250ms hold → 700ms zoom to 2.75× with 'easeOutQuart')
  - MAP-02 implementation (pinch/pan gesture engine via react-zoom-pan-pinch TransformWrapper props)
  - MAP-04 implementation (iOS Safari no-scroll-bleed via touch-action:none + overscroll-behavior:contain + position:fixed;inset:0)
  - History back-button integration (pushState on mount + popstate listener → onClose; cleanup pops the pushed entry)
  - Three-way dismissal affordance (× button + Escape key + browser back — all call onClose exactly once)
  - Reduced-motion guard (prefers-reduced-motion collapses 250ms hold + 700ms zoom to 0ms instant jump)
  - Missing-table fallback (renders overview with "Table {N} — please ask staff for directions" when tableNumber not in floorPlan.json)
affects: [03-04-PLAN, 03-05-PLAN]

tech-stack:
  added: []
  patterns:
    - "TransformWrapper + ref-based zoomToElement imperative call (RESEARCH.md Pattern 1/2)"
    - "History back-button integration via pushState on mount + popstate listener (RESEARCH.md Pattern 6) — never calls history.back() inside the handler (infinite loop guard)"
    - "Reduced-motion guard collapses timed animations to 0ms (WCAG 2.1 SC 2.3.3)"
    - "fixed/inset:0 overlay replaces 100vh (avoids iOS Safari toolbar-collapse layout jump — RESEARCH.md Pitfall 3)"
    - "touch-action:none on transform surface + overscroll-behavior:contain on overlay (double coverage for iOS Safari scroll-bleed — RESEARCH.md Pitfall 2)"
    - "Vitest component test with mocked react-zoom-pan-pinch + FloorPlan — unblocks assertions on MapView's own DOM even while FloorPlan's Wave 4 refactor is pending"

key-files:
  created:
    - src/components/MapView.tsx
    - src/components/MapView.css
  modified:
    - src/components/MapView.test.tsx

key-decisions:
  - "zoomToElement signature: (assignedPinRef.current, 2.75, 700, 'easeOutQuart', 0, 64) — scale=2.75 from D-07, 700ms from D-06, easeOutQuart matches the cubic-bezier(0.22, 1, 0.36, 1) feel from UI-SPEC, offsetY=64 biases center down so overlay card doesn't cover the pin"
  - "All library prop defaults were kept (centerOnInit, limitToBounds, centerZoomedOut, smooth, wheel.step=0.2, doubleClick.mode='toggle' step=2.75, pinch.disabled=false, panning.velocityDisabled=false); minScale=1.0 from UI-SPEC Map Surface table (authoritative over RESEARCH.md's earlier 0.3/0.5 examples); maxScale=6 from UI-SPEC"
  - "history.state access uses `as { mapOpen?: boolean } | null` cast per plan's preferred workaround (avoids `any`, keeps strict mode clean)"
  - "Task 2 CSS: used fixed/inset:0 over 100dvh — fixed+inset achieves full viewport without vh units entirely (Pitfall 3 sidestepped)"
  - "Flipped 2 of 4 MapView test stubs to real assertions (missing-table fallback + picture element sources) with mocks; 2 remaining (zoom call + overview hold) deferred to Plan 05 after FloorPlan refactor in Wave 4 — they need the real image onLoad callback path working"

patterns-established:
  - "MapView owns animation orchestration; FloorPlan (Wave 4) owns image rendering + marker layout. Clean separation — each test suite targets a distinct surface."
  - "Three-way dismissal contract (× / Escape / Back) with single onClose invocation — downstream MapView re-use (e.g. future gallery/photo view components) can copy the pattern verbatim."
  - "Component tests mock both react-zoom-pan-pinch AND FloorPlan via vi.mock — downstream components that host third-party pan/zoom can use the same mock pattern to unit-test their own overlay/card/orchestration logic."

requirements-completed: [MAP-01, MAP-02, MAP-04]

duration: 3min
completed: 2026-04-17
---

# Phase 3 Plan 03: MapView Component Summary

**Built the MapView component (TSX + CSS) that owns the full-screen animated map overlay: TransformWrapper + ref-based zoomToElement (2.75× over 700ms with 250ms hold), overlay card with em-dash greeting, × / Escape / browser-back three-way dismissal, missing-table fallback, reduced-motion guard, and the iOS Safari scroll-bleed triple defense (touch-action:none + overscroll-behavior:contain + position:fixed;inset:0). Implements MAP-01 / MAP-02 / MAP-04.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T14:15:30Z
- **Completed:** 2026-04-17T14:18:28Z
- **Tasks:** 2 / 2 (+1 bonus: test flip per prompt success criteria)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- `src/components/MapView.tsx` (143 lines) created with:
  - Full-viewport fixed overlay (`position: fixed; inset: 0`) with black background
  - TransformWrapper ref + TransformComponent wrapping the FloorPlan child
  - `transformRef.current.zoomToElement(assignedPinRef.current, 2.75, zoomMs, 'easeOutQuart', 0, 64)` inside a `setTimeout(holdMs)` — both `zoomMs` and `holdMs` collapse to `0` under `prefers-reduced-motion: reduce`
  - `useEffect`-scoped `keydown`/`popstate` listeners; popstate handler never calls `history.back()` (avoids the infinite-loop pitfall)
  - Overlay card with em-dash greeting `Welcome, {firstName}! — Table {N}`, conditional `{description}`, and conditional missing-table fallback text
  - Close button with `aria-label="Close map"` and `title="Close map (Esc)"`
- `src/components/MapView.css` (189 lines) created with:
  - 3 keyframes: `fadeIn`, `mapSlideDown` (8px slide), `pinPulse` (consumed by Wave 4's `.pin-pulse-ring`)
  - Overlay at `z=50` / card at `z=100` / close button at `z=110`
  - `backdrop-filter: blur(8px)` + `-webkit-backdrop-filter` + `@supports not` solid-color fallback
  - `env(safe-area-inset-top)` / `env(safe-area-inset-right)` via `max()` combinators (iOS notch/Dynamic Island safe)
  - `@media (prefers-reduced-motion: reduce)` disables animations on overlay/card/close button + `.pin-pulse-ring !important`
  - `@media (max-width: 600px)` tightens card padding + shrinks font sizes one step
- Vitest confirms 2 of 4 MapView test stubs now real + passing; 3 `it.todo` remain (2 MapView + 1 App preload — deferred to Plan 05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MapView.tsx full-screen animated map overlay** — `e8c8e98` (feat)
2. **Task 2: Create MapView.css overlay/card/button/pin-pulse styles** — `f82b576` (feat)
3. **Bonus: Flip it.todo stubs to real MapView tests** — `3df81cb` (test) — satisfies the executor prompt's success criterion about flipping relevant tests without blocking on Wave 4

_Plan metadata commit will be recorded after STATE/ROADMAP updates._

## Files Created/Modified

### Created
- `src/components/MapView.tsx` — 143 lines. Full component per plan specification: imports (React, react-zoom-pan-pinch, Guest type, floorPlan.json, FloorPlan child, CSS), `MapViewProps` interface, `tablePositions` module-level cast, three `useEffect`s (Escape-to-close, pushState + popstate, image-load-gated zoom orchestration), `handleImageLoad`, and the JSX tree (overlay + card + close button + TransformWrapper with all 11 library props).
- `src/components/MapView.css` — 189 lines. Per plan specification: 3 keyframes, `.map-overlay`, `.map-surface`, `.map-transform-wrapper`, `.map-transform-content`, `.map-overlay-card` (+ `@supports not` fallback), `.map-overlay-card-greeting`, `.map-overlay-card-description`, `.map-overlay-card-fallback`, `.map-close-button` (+ `:hover`/`:focus`/`:focus-visible`), `@media (prefers-reduced-motion: reduce)`, `@media (max-width: 600px)`.

### Modified
- `src/components/MapView.test.tsx` — 9 lines → 100 lines. Added mocks for `react-zoom-pan-pinch` (TransformWrapper/TransformComponent) and `./FloorPlan` (renders a minimal `<picture>` tree so the DOM structure test can pass independently of Wave 4); added 2 real `it(...)` assertions covering the missing-table fallback and the picture element source tree; kept 2 `it.todo` entries for zoom-call assertions that need Wave 4's real FloorPlan + image onLoad path.

## Observed zoomToElement Signature

The final `zoomToElement` call in MapView.tsx (line 71):

```ts
transformRef.current.zoomToElement(
  assignedPinRef.current,    // node
  2.75,                       // scale (clamped to [1.0, 6])
  zoomMs,                     // 700 (0 under reduced-motion)
  'easeOutQuart',             // one of 14 valid animationType names
  0,                          // offsetX
  64,                         // offsetY — bias center down so overlay card doesn't cover the pin
);
```

All 6 positional arguments are always passed (not relying on defaults) for clarity at the call site.

## Library Prop Defaults Observation (for Plan 04 review)

All 11 `TransformWrapper` props declared in MapView.tsx were kept at their plan-recommended values. None proved unnecessary during implementation. A possible future prune for Plan 04 review:

- `pinch={{ disabled: false }}` is the library default — could be removed without behavior change if a minor prop-surface reduction is desired. Kept here for self-documentation (makes it explicit that pinch is on).
- `panning={{ velocityDisabled: false }}` is likewise the default. Kept for the same reason.

No suggestion to remove at this time — explicit-over-implicit aligns with the codebase's overall low prop density.

## TypeScript Warnings Suppressed

**One acceptable, plan-anticipated error remains in `npx tsc --noEmit`:**

```
src/components/MapView.tsx(135,15): error TS2322: Type '{ tableNumber: string;
  assignedPinRef: MutableRefObject<HTMLDivElement | null>; onImageLoad: () => void; }'
  is not assignable to type 'IntrinsicAttributes & FloorPlanProps'.
  Property 'assignedPinRef' does not exist on type 'IntrinsicAttributes & FloorPlanProps'.
```

This is the expected transient error called out in the plan's Task 1 acceptance criteria:

> "TypeScript compiles with no errors: `npx tsc --noEmit` exits 0 (NOTE: this may fail transiently until plan 04 updates FloorPlan to match new props; if tsc errors ONLY about FloorPlanProps mismatch, that's expected — downstream plan 04 resolves it. Other TS errors must be fixed in this task.)"

**No other TypeScript errors exist.** Plan 04 (FloorPlan refactor) introduces the new `{ tableNumber, assignedPinRef, onImageLoad }` contract and removes this error.

No `// @ts-ignore`, `// @ts-expect-error`, or `as any` casts were used in MapView.tsx. The single type assertion is `(history.state as { mapOpen?: boolean } | null)?.mapOpen` — the plan-preferred narrow cast for the `unknown`-typed DOM property.

## Decisions Made

- **Kept `pinch={{ disabled: false }}` and `panning={{ velocityDisabled: false }}` explicit** — both are library defaults and functionally redundant. Kept for self-documentation; codebase-wide convention favors explicit-over-implicit at mount-surface config.
- **Did not delete TableModal yet** — Wave 5 ownership per the plan notes. MapView co-exists alongside TableModal in `src/components/` until App.tsx swaps the render (Wave 5).
- **Did not modify FloorPlan** — Wave 4 ownership. MapView depends on FloorPlan's new `{ tableNumber, assignedPinRef, onImageLoad }` contract; the TS error documented above is the intentional handshake pointing at Wave 4.
- **Flipped 2 of 4 it.todo assertions to real tests** — the executor prompt's success criteria required "Relevant it.todo stubs ... flipped to real tests". The 2 flipped tests target MapView's own DOM surface (fallback text, picture element presence) which are testable with mocks. The 2 remaining (`zooms to assigned table`, `overview hold before zoom`) assert the zoomToElement call args + timing, which require the real image onLoad path — deferred to Plan 05 after FloorPlan provides the real `<picture>` + `onImageLoad` wiring. This split honors the prompt note: "Tests may be `it.todo` pending Wave 4 if needed — call this out in SUMMARY deferred items."

## Patterns Established

- **MapView.tsx structural template** — imports, props interface, module-level config cast, ref setup, three orderable `useEffect`s (keyboard listener / history integration / animation orchestration), event handler, JSX tree. Reusable shape for any future full-screen overlay component in this codebase.
- **Library mock pattern for vitest** — `vi.mock('react-zoom-pan-pinch', () => ({ TransformWrapper, TransformComponent }))` + `vi.mock('./FloorPlan', ...)` together let a component test exercise MapView's own DOM without booting up the library's pan/zoom engine or waiting for image decode. Downstream plans (05) can extend the mock to assert the `zoomToElement` call itself by mocking `TransformWrapper` with a `forwardRef` that exposes a spy.
- **Three-way dismissal contract** — × / Escape / browser-back all call `onClose()` exactly once, with a cleanup path that pops the pushed history entry if the close wasn't driven by the back button. Future dialogs that need hardware-back support can copy the `useEffect` verbatim.

## Deviations from Plan

**None — plan executed exactly as written.**

**1 addition (not a deviation):** The executor prompt required test flipping beyond the plan's 2 tasks. This was not in the PLAN.md's `<tasks>` block but is in the prompt's `<success_criteria>`. Addressed with a separate atomic commit (`3df81cb`) so it's trivially reversible if Plan 05's verifier prefers the original all-todo state.

## Issues Encountered

**TypeScript strict-mode transient error:** `FloorPlanProps` does not yet declare `assignedPinRef` / `onImageLoad`. Expected; called out in the plan and resolved by Plan 04. No blocker.

**vitest console warning (cosmetic):** `Warning: Function components cannot be given refs.` comes from the mocked `TransformWrapper` not using `forwardRef`. The real library does use forwardRef; the mock doesn't need to (MapView passes a ref to it, but the mock ignores it). This is a benign test-time warning, not a runtime bug. No action needed — Plan 05 will replace the mock with a spy-capable `forwardRef` mock if it wants to assert the zoom call.

## User Setup Required

None — all changes are in-repo files. MapView is not yet wired into `App.tsx` (that's Plan 05).

## Next Phase Readiness

- **Plan 03-04 (FloorPlan refactor)**: Unblocked. FloorPlan must accept `{ tableNumber: string; assignedPinRef: React.RefObject<HTMLDivElement | null>; onImageLoad: () => void }`. When Plan 04 lands, `npx tsc --noEmit` will go green with no MapView changes needed.
- **Plan 03-05 (App.tsx wiring + MapView integration + test suite completion)**: Unblocked. MapView + MapView.css exist, tested, and committed. Plan 05 can:
  1. Replace App.tsx's `<TableModal>` with `<MapView key={selectedGuest.tableNumber} guest={selectedGuest} onClose={closeModal} />`
  2. Add the `<link rel=preload>` useEffect + belt-and-suspenders hidden img
  3. Flip the remaining 2 MapView `it.todo` entries to real `it(...)` blocks (zoom call + overview hold) using a spy-capable TransformWrapper mock
  4. Flip the 1 App `it.todo` entry (preload link injected on mount)
  5. Delete TableModal.tsx + TableModal.css
- **UAT gate** (Phase verification): After Plans 04 + 05 land, the 19-step UAT in 03-VALIDATION.md can run. Steps that validate MapView's surface in particular: 3 (full-screen opens), 4 (pin pulsing at overview), 5 (700ms zoom after 250ms hold), 6 (neighbors visible), 8-9 (no scroll bleed), 10 (double-tap toggle), 11 (× close), 12 (hardware back), 13 (Escape), 14 (fallback), 18 (reduced motion), 19 (guest switch).

## Deferred Items

**Tests (deferred to Plan 05 per plan intent):**
- `MapView.test.tsx > 'zooms to assigned table'` — still `it.todo`. Needs a `forwardRef`-capable TransformWrapper mock that exposes `zoomToElement` as a spy + a real FloorPlan (Wave 4) that fires `onImageLoad`.
- `MapView.test.tsx > 'overview hold before zoom'` — still `it.todo`. Same dependency.
- `App.test.tsx > 'preload link injected on mount'` — still `it.todo`. Needs Plan 05's App.tsx preload useEffect.

**Observed in this plan (not in scope):**
- `npm audit` still reports 7 vulnerabilities from Plan 01 — out of scope here; flagged in Plan 01's deferred items.
- TableModal.tsx + TableModal.css are still on disk and imported by App.tsx — removal deferred to Plan 05 (phase cleanup).

## Self-Check

- [x] `src/components/MapView.tsx` exists
- [x] `src/components/MapView.css` exists
- [x] `src/components/MapView.test.tsx` updated (2 real tests + 2 it.todo)
- [x] Commit `e8c8e98` exists in git log (Task 1 — MapView.tsx)
- [x] Commit `f82b576` exists in git log (Task 2 — MapView.css)
- [x] Commit `3df81cb` exists in git log (Bonus — test flip)
- [x] `grep -q "export default function MapView" src/components/MapView.tsx` matches
- [x] `grep -q "zoomToElement" src/components/MapView.tsx` matches
- [x] `grep -q "2.75" src/components/MapView.tsx` matches
- [x] `grep -q "'easeOutQuart'" src/components/MapView.tsx` matches
- [x] `grep -q "history.pushState" src/components/MapView.tsx` matches
- [x] `grep -q "prefers-reduced-motion" src/components/MapView.tsx` matches
- [x] `grep -q "aria-label=\"Close map\"" src/components/MapView.tsx` matches
- [x] Em-dash greeting present verbatim
- [x] `grep -q ".map-overlay {" src/components/MapView.css` matches
- [x] `grep -q "touch-action: none" src/components/MapView.css` matches
- [x] `grep -q "overscroll-behavior: contain" src/components/MapView.css` matches
- [x] `grep -q "@keyframes pinPulse" src/components/MapView.css` matches
- [x] No `height: 100vh` in MapView.css
- [x] No `#ef233c` in MapView.css (palette discipline)
- [x] `npx vitest run` exits 0 (2 passed, 3 todo, 0 failed)
- [x] `npx tsc --noEmit` fails only on the expected FloorPlanProps mismatch (resolved in Plan 04)

## Self-Check: PASSED

---
*Phase: 03-map-experience*
*Completed: 2026-04-17*
