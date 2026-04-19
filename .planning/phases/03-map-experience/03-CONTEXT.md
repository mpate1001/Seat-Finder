# Phase 3: Map Experience - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** Interactive discuss-phase

<domain>
## Phase Boundary

When a guest is selected, the floor plan animates (pan + zoom) to center on their
assigned table. The map is pinch-zoom / drag-pan usable on mobile, markers are
readable and tappable, iOS Safari does not scroll-bleed, and the floor plan image
is mobile-optimized for fast loading on cellular.

**In scope:**
- Full-screen animated zoom-to-table on guest selection (replaces current TableModal)
- Pinch-to-zoom and drag-to-pan gestures on mobile
- Upgraded marker system with table-number labels and strong visual hierarchy
  between the assigned table and all others
- iOS Safari gesture correctness (no page scroll bleed during pan/pinch)
- Floor plan image format + size optimization
- Preload strategy for the floor plan image so the reveal is instant

**Out of scope (deferred / other phases):**
- 3D / isometric venue view — REQUIREMENTS v2 MAP-06
- Directional arrows / path from entrance to table — REQUIREMENTS v2 MAP-07
- localStorage caching of guest list — Phase 4 (PERF-01)
- PWA / service worker — Phase 4 (PERF-02, PERF-03)
- Environment variable for Sheets URL — Phase 4 (PERF-04)
- Click-to-place editor — Phase 5 (TOOL-01..03)

**Requirement IDs:** MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Carry-forward from Phase 1 UAT:** Enlarged floor plan modal was constrained to
phone-width card — resolved by the "always full viewport" decision below.

</domain>

<decisions>
## Implementation Decisions

### Interaction surface
- **D-01:** Full-screen map on guest select *replaces* the current `TableModal`. Selecting a
  name no longer opens a bounded card — it opens a full-viewport animated map as the
  primary payoff. `TableModal` as a separate component may be deleted or refactored into
  a `MapView` that owns the full-screen experience.
- **D-02:** An **overlay card** is pinned at the top of the full-screen map with:
  `Welcome, {firstName}! — Table {N}` and, on a second line, `{description}` if present.
  Non-intrusive (does not cover the table marker). The map is the hero; the personal
  touch survives.
- **D-03:** Dismissal affordances: visible **close `×` button** in a top corner **plus**
  browser / hardware back button closes the map and returns to search. No swipe-down
  gesture (avoids conflict with pinch/pan gestures on the map itself).
- **D-04:** **Always full viewport** on every screen size — mobile and desktop. This
  also resolves the Phase 1 UAT carry-forward item (enlarged modal constrained to
  phone-width). No breakpoint-based bounding.

### Pan/zoom library + animation behavior
- **D-05:** Use **`react-zoom-pan-pinch`** as the pan/zoom engine. Rationale: most
  popular React option, built-in `zoomToElement` / `zoomToPoint` solves MAP-01
  declaratively, handles iOS Safari pinch + pan correctly (MAP-04), ~15KB, actively
  maintained.
- **D-06:** Animation **starts at overview** (full floor plan visible, fit-to-viewport)
  with the assigned table's red pin already pulsing, then after a short beat
  (~250ms) **animates a zoom-in** to center on the assigned table over **~700ms**.
  Rationale: gives spatial context first, then focuses — matches the "see where the
  table is, walk there" value prop. Exact timings are Claude's Discretion within
  these targets.
- **D-07:** **Final zoom level lands tight on the table + immediate neighbors**
  (~2.5–3× zoom). The assigned marker is prominent but neighbor tables remain
  visible for orientation.
- **D-08:** After the auto-zoom completes, the user can **manually pan and pinch-zoom**
  from that state (gestures stay live). Library's built-in min/max zoom bounds apply —
  planner picks exact values.

### Markers & labels (MAP-03)
- **D-09:** **All tables display number labels adaptively**. At overview zoom, only the
  assigned table's label is visible (avoids 54-label clutter on a phone). As the user
  zooms in, neighboring labels fade in. Planner decides the zoom threshold.
- **D-10:** Assigned (you-are-here) marker: **red pin / teardrop in `#d90429`** with the
  table number centered in white bold inside the pin. Subtle pulse. Minimum 44×44 tap
  target. Iconic, unambiguous.
- **D-11:** All other tables: **muted slate dots** (`#8d99ae` from the palette), same
  44×44 footprint, labels follow D-09 adaptive rule. Creates strong visual hierarchy
  — one red pin pops, 53 gray dots recede.
- **D-12:** "Tap a table marker to select that guest" is **out of scope** for this phase
  — markers are purely visual. Name-search remains the only way to pick a guest.

### Image optimization (MAP-05)
- **D-13:** Floor plan image ships as **AVIF → WebP → PNG fallback** via a `<picture>`
  element. AVIF is the primary format (50–70% smaller than PNG on typical content),
  WebP is the mid-tier fallback, original PNG is final fallback for old devices.
- **D-14:** **Responsive `srcset` with 3 sizes** (approx. 900px / 1600px / 2400px wide)
  so phones download the 900px asset. Biggest real-world mobile bandwidth win.
- **D-15:** **Preload on app mount** — the image fetch is kicked off during the initial
  guest-list load so the full-screen map reveal has zero network delay when a guest
  is selected. Acceptable upfront cost since the app is already making network calls
  at that point.
- **D-16:** Source asset stays `src/assets/Reception Seat Diagram.png`. Build pipeline
  (or a committed prebuilt set) produces the AVIF/WebP/PNG variants at the three
  sizes. Planner picks the exact tooling (`vite-imagetools` vs committed prebuilt
  assets). The current background photo (`mahsompw-6074Z70_6074.jpeg`, ~3.9MB) is
  **not** in Phase 3 scope, but is flagged as a Phase 4 perf item.

### iOS Safari correctness (MAP-04)
- **D-17:** Use `touch-action: none` on the pan/zoom surface and `overscroll-behavior:
  contain` on the full-screen overlay to prevent scroll bleed-through. The
  `react-zoom-pan-pinch` gesture engine is expected to handle most of this; planner
  verifies on iOS Safari during UAT.

### Claude's Discretion
- Exact animation timings (overview beat duration, zoom-in duration, easing curve)
  within the ~250ms / ~700ms targets in D-06. Planner picks an easing function
  (`ease-out` vs custom cubic-bezier) that feels right in testing.
- Minimum and maximum user-controlled zoom levels in D-08.
- Adaptive label fade-in threshold in D-09 (e.g. show neighbor labels when zoom ≥
  1.8×).
- Exact `srcset` breakpoints (900/1600/2400 is a recommendation, not a lock).
- Whether to add a one-time "pinch to zoom, tap × to close" hint on first open
  (nice-to-have; Claude picks).
- Haptic feedback on arrival (iOS `navigator.vibrate` is limited; probably skip).
- Whether to keep the current "click small map to enlarge" pattern anywhere — likely
  deleted since the full-screen map IS the experience now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, MAP-01..05 mapping
- `.planning/REQUIREMENTS.md` — MAP-01 through MAP-05 definitions and v2 deferred
  items (MAP-06, MAP-07)
- `.planning/PROJECT.md` — Core value (10-second lookup), mobile-first, tech stack
  constraints, carry-forward UAT note

### Prior phase context (percentage coords, fuzzy search integration)
- `.planning/phases/01-data-integrity/01-CONTEXT.md` — Percentage-based coordinates
  (D-02/D-05 Phase 1); Phase 3 pan/zoom math MUST operate on the same 0–1 percentage
  values scaled against displayed image dimensions
- `.planning/phases/02-fuzzy-search/02-CONTEXT.md` — Search flow that leads into
  Phase 3's map reveal (`searchResults` → selection → map)
- `.planning/phases/02-fuzzy-search/02-02-SUMMARY.md` — Current `GuestDropdown` →
  `onSelect` contract that will feed into the new `MapView`

### Existing code (must integrate, not replace wholesale)
- `src/App.tsx` — `selectedGuest` state + `handleGuestSelect` + current
  `TableModal` render block. Phase 3 swaps `TableModal` for the full-screen
  `MapView`.
- `src/components/TableModal.tsx` — Current welcome card; likely replaced. Greeting
  copy + escape-to-close pattern should survive in the overlay card.
- `src/components/FloorPlan.tsx` — Current rendering, `ResizeObserver` scaling,
  enlarged modal. The zoom math and `<img>` rendering are mostly replaced by
  `react-zoom-pan-pinch` + `<picture>`. The percentage-coord marker-placement
  pattern stays.
- `src/components/FloorPlan.css` — Existing `.point-marker` / `.point-pulse` styles;
  will be extended / replaced for the new pin and muted-dot variants.
- `src/config/floorPlan.json` — 54 tables in percentage coords, unchanged by this
  phase.
- `src/types.ts` — `Guest.tableNumber` is the link to the marker.

### Conventions to follow
- `./CLAUDE.md` — Component naming (PascalCase), `handle*` event handlers,
  `{ComponentName}Props` interfaces, 2-space indent + single quotes + semicolons,
  kebab-case CSS classes, palette (`#2b2d42`, `#d90429`, `#ef233c`, `#8d99ae`,
  `#edf2f4`), `@media (max-width: 600px)` breakpoint.

### External docs
- react-zoom-pan-pinch: https://github.com/BetterTyped/react-zoom-pan-pinch —
  `TransformWrapper` / `TransformComponent` API, `zoomToElement`, bounds,
  `wheel.disabled`, `doubleClick` config
- MDN `<picture>` element — AVIF/WebP/PNG fallback chain and `srcset` / `sizes`
- MDN `touch-action` and `overscroll-behavior` — scroll-bleed prevention on iOS
- Vite imagetools (if adopted): https://github.com/JonasKruckenberg/imagetools —
  build-time format/size generation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Percentage-coordinate math** in `FloorPlan.tsx` (`position.x * imageWidth`) —
  the same math composes with `react-zoom-pan-pinch`'s internal transform; markers
  remain positioned by percentage inside the transformed content.
- **`ResizeObserver` pattern** — already proven in `FloorPlan.tsx`; can be reused
  for the full-screen viewport sizing.
- **Escape-to-close `useEffect`** in `TableModal.tsx` and `FloorPlan.tsx` — pattern
  to reuse for the new full-screen map close handler.
- **Duplicate-position dev warning** in `FloorPlan.tsx` — keep it as a cheap
  regression guard.

### Established Patterns
- State lifted to `App.tsx`; `selectedGuest` + `handleGuestSelect` + `closeModal`
  is the existing contract. Phase 3 renames / relocates `closeModal` but keeps the
  single-source-of-truth pattern.
- CSS files co-located with components, `@keyframes` for animations (`pulse`,
  `fadeIn`). The new pin's pulse can reuse the existing keyframe.
- Image assets imported as default exports (`import floorPlanImageSrc from
  '../assets/...'`). If `vite-imagetools` is used, it intercepts the import.

### Integration Points
- `App.tsx` render: replace `<TableModal guest={selectedGuest} ... />` block with
  the new full-screen `<MapView guest={selectedGuest} onClose={closeModal} />`.
- `FloorPlan` becomes the renderer *inside* `MapView`'s `TransformComponent` — its
  responsibility shrinks to "draw the picture element + markers at percentage
  coords". Pan/zoom moves up into `MapView`.
- `floorPlan.json` has **no table 47/46 overlap** (see `src/config/floorPlan.json`
  lines 49–50 — tables 46 and 47 now have distinct x values), so Phase 3 can trust
  that the marker-per-table invariant holds.

</code_context>

<specifics>
## Specific Ideas

- The "pulse" on the assigned red pin should be **subtle** — the overview → zoom-in
  animation is the primary attention-getter. A slow, low-opacity pulse (1.2s cycle,
  ~20% alpha swing) complements the zoom without competing with it.
- Preloading on app mount should use a `<link rel="preload" as="image" ...>` hint
  (matching the current primary-format AVIF) **plus** a hidden `<img>` with the
  same `src` to force the fetch — both paths work and are cheap belts-and-suspenders.
- If the table marker would fall *outside* the visible viewport at the final zoom
  level (edge tables on a wide phone), `zoomToElement` should re-center to keep the
  pin fully on-screen (library already does this).
- If `guest.tableNumber` is not mapped in `floorPlan.json`, the full-screen map should
  still open but show the overview with a friendly fallback message:
  `Table {N} — please ask staff for directions`. The existing `hasValidPosition`
  warning pattern in `FloorPlan.tsx` is the seed for this.

</specifics>

<deferred>
## Deferred Ideas

- **Tap-a-marker to select that guest** — explicitly out of this phase's scope.
  Name-search remains the only selection path. Could be a micro-feature later if
  the wedding party asks.
- **Haptic feedback on arrival** (iOS vibrate) — skipped; iOS Safari support for
  `navigator.vibrate` is inconsistent and the visual reveal is already strong.
- **Directional arrows / path-from-entrance** — deferred to v2 MAP-07.
- **3D / isometric venue view** — deferred to v2 MAP-06.
- **Background photo (`mahsompw-6074Z70_6074.jpeg`, ~3.9MB)** optimization — not a
  Phase 3 item; flagged for Phase 4 perf work.
- **"Pinch to zoom, tap × to close" first-time hint toast** — Claude's Discretion;
  may ship or defer based on perceived need in UAT.
- **Family grouping** (backlog 999-01, captured during Phase 2 UAT) — unrelated
  to Phase 3 surface work; stays parked.

</deferred>

---

*Phase: 03-map-experience*
*Context gathered: 2026-04-16 via /gsd-discuss-phase*
