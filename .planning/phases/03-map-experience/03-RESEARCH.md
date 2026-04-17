# Phase 3: Map Experience — Research

**Researched:** 2026-04-16
**Domain:** React pan/zoom interaction, responsive image optimization, iOS Safari gesture correctness, browser History API
**Confidence:** HIGH (core library API verified from source; image pipeline decision verified from npm registry; iOS pitfalls verified from MDN + community)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Full-screen map on guest select replaces the current TableModal
- D-02: Overlay card pinned at top: `Welcome, {firstName}! — Table {N}` + optional description
- D-03: Dismissal: visible × button + browser back + Escape; no swipe-down
- D-04: Always full viewport on every screen size
- D-05: react-zoom-pan-pinch is THE pan/zoom library (~15KB)
- D-06: Overview hold 250ms → zoom-in 700ms
- D-07: Final zoom 2.5–3× (tight on table + neighbors)
- D-08: Manual pan/pinch live after auto-zoom; library min/max bounds apply
- D-09: Adaptive labels — only assigned at overview, neighbors fade in when zoomed
- D-10: Assigned pin — red #d90429 teardrop, 44×44 tap, white number, subtle pulse
- D-11: Other tables — muted slate #8d99ae dots, 44×44 tap
- D-12: Markers are visual only — no tap-to-select this phase
- D-13: AVIF → WebP → PNG fallback via `<picture>`
- D-14: 3-size srcset (~900 / 1600 / 2400)
- D-15: Preload on app mount (link rel=preload + hidden img)
- D-16: Source stays src/assets/Reception Seat Diagram.png; planner picks vite-imagetools vs committed prebuilt variants
- D-17: touch-action: none + overscroll-behavior: contain for iOS scroll-bleed

### Claude's Discretion
- Exact animation timings within D-06/D-07 targets
- Min/max user-controlled zoom levels
- Adaptive label fade-in threshold
- Exact srcset breakpoints
- Whether to add first-open hint
- Haptic feedback (skip)
- Whether to keep "click small map to enlarge" (delete it — superseded)

### Deferred Ideas (OUT OF SCOPE)
- Tap-a-marker to select guest
- Haptic feedback on arrival
- Directional arrows / path-from-entrance (MAP-07)
- 3D / isometric venue view (MAP-06)
- Background photo optimization (Phase 4)
- Family grouping (backlog 999-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | Floor plan animates with smooth pan + zoom to center on guest's assigned table when selected | react-zoom-pan-pinch `zoomToElement` with `ref` pattern; `easeOutQuart` at 700ms; overview-hold via `setTimeout` |
| MAP-02 | Guest can pinch-to-zoom and pan the floor plan on mobile | Library's built-in touch handler; `touch-action: none` on surface; `allowPanning: true` during pinch |
| MAP-03 | Table markers are larger and higher-contrast with visible table number labels | CSS teardrop SVG pin (44×44) for assigned; 12px dot (44×44 hitbox) for others; adaptive label via `useTransformComponent` scale state |
| MAP-04 | Animated zoom works correctly on iOS Safari without scroll bleed-through | `touch-action: none` on TransformComponent wrapper; `overscroll-behavior: contain` on MapView overlay; `100dvh` for full-viewport height; `position: fixed; inset: 0` layout |
| MAP-05 | Floor plan image optimized for mobile (compressed, appropriate resolution) | Committed prebuilt variants via one-time `sharp` Node script; `<picture>` with AVIF→WebP→PNG at 900/1600/2400w; `fetchpriority="high"` preload |
</phase_requirements>

---

## Summary

Phase 3 builds a full-screen animated map experience using `react-zoom-pan-pinch` v4.0.3 (latest stable). The library's `zoomToElement` API, accessed via `useRef<ReactZoomPanPinchRef>`, provides the complete programmatic zoom-to-table animation with a clean TypeScript interface. The library ships its own touch handling so marker positioning, gesture management, and iOS Safari scroll-bleed prevention are all well-covered.

The image optimization decision is clear: **vite-imagetools is not usable with this project's Vite 6 stack** — v10 (latest) requires Vite >=7.0.0. The correct approach is a one-time committed prebuilt workflow: a small `scripts/generate-images.mjs` that uses `sharp` (installed once as a devDependency) to produce the 9 variant files (3 formats × 3 sizes) committed to `public/floor-plan/`. This adds ~0 build-time cost, no Vite plugin complexity, and the files are just static assets.

The percentage-coordinate marker system from Phase 1 composes correctly with the library: markers placed absolutely inside `TransformComponent` ride the CSS transform and remain correctly anchored to their percentage positions. No math changes needed.

**Primary recommendation:** Use `react-zoom-pan-pinch` v4.0.3, committed prebuilt image variants via `sharp` script, `position: fixed; inset: 0` with `100dvh` fallback, and `useTransformComponent` for reactive scale-driven label visibility.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full-screen map overlay | Browser / Client | — | `position: fixed; inset: 0` — purely client-side layout |
| Pan/zoom gesture engine | Browser / Client | — | Library handles all touch/pointer events in the DOM |
| Auto-zoom animation to table | Browser / Client | — | Imperative `zoomToElement` call on the TransformWrapper ref |
| Marker placement (percentage coords) | Browser / Client | — | CSS absolute positioning inside TransformComponent |
| Adaptive label visibility | Browser / Client | — | CSS transition gated on `transformState.scale` from `useTransformComponent` |
| Image format/size selection | CDN / Static | Browser / Client | `<picture>` + `srcset` — browser picks format; files served as static assets |
| Preload hint | Browser / Client | — | `<link rel=preload>` injected into `<head>` at app mount |
| History back-button close | Browser / Client | — | `history.pushState` + `popstate` listener wired in MapView |
| Guest data (table number) | API / Backend (Google Sheets) | Browser / Client | Already fetched at startup; MapView just reads `guest.tableNumber` prop |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-zoom-pan-pinch | 4.0.3 | Pan/zoom/pinch engine with programmatic `zoomToElement` | Most popular React pan/zoom lib; built-in touch handling; 15KB; ships TypeScript types; locked by D-05 |
| sharp (devDep) | 0.34.5 | One-time image variant generation script | Industry standard Node.js image processing; generates AVIF/WebP/PNG at any width/quality in seconds |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.4 | Unit tests for animation callback wiring and fallback logic | Lightweight; shares Vite config; no separate bundler needed |
| @testing-library/react | 16.3.2 | Component mount tests for MapView ref wiring | Only if adding automated unit tests (see Testing Approach) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| committed prebuilt images | vite-imagetools | vite-imagetools v10 requires Vite >=7 — **incompatible with this project's Vite ^6.0.1** [VERIFIED: npm registry] |
| committed prebuilt images | vite-imagetools v9 | v9 declares no peer deps but is unmaintained path; upgrade risk at next Vite upgrade |
| sharp script | squoosh-cli | squoosh-cli is deprecated/abandoned [ASSUMED]; sharp is actively maintained |
| sharp script | ImageMagick | Not installed on dev machine [VERIFIED: env check]; requires system install; no npm integration |

**Installation (production):**
```bash
npm install react-zoom-pan-pinch
```

**Installation (devDep for image script — run once):**
```bash
npm install --save-dev sharp
```

**Version verification (performed this session):**
- `react-zoom-pan-pinch`: 4.0.3, latest tag [VERIFIED: npm registry, 2026-04-16]
- `vite-imagetools`: 10.0.0, requires `vite >=7.0.0` — **INCOMPATIBLE** [VERIFIED: npm registry + package.json]
- `sharp`: 0.34.5 [VERIFIED: npm registry]
- `vitest`: 4.1.4 [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Guest selects name
       │
       ▼
App.tsx sets selectedGuest
       │
       ▼
<MapView guest={...} onClose={closeModal}> mounts (position: fixed; inset: 0)
       │
       ├──► history.pushState({mapOpen: true}) ──► popstate listener armed
       │
       ├──► <OverlayCard> renders greeting + table number (z=100)
       │
       ├──► <CloseButton> renders × (z=110)
       │
       └──► <TransformWrapper ref={transformRef} ...>
                   │
                   ├──► <TransformComponent> (touch-action: none)
                   │         │
                   │         ├──► <picture> (AVIF/WebP/PNG srcset)
                   │         │       └── <img onLoad={handleImageLoad}>
                   │         │
                   │         └──► 54 marker <div>s (position: absolute)
                   │               ├── assigned: teardrop SVG + pulse (pin-assigned)
                   │               └── others: muted dot (pin-dot)
                   │
                   └──► onInit / img.onLoad
                               │
                               ▼
                         setTimeout(250ms)
                               │
                               ▼
                         transformRef.current.zoomToElement(
                           assignedPinRef.current,   ← DOM node
                           2.75,                     ← scale
                           700,                      ← animationTime ms
                           'easeOutQuart'            ← animationType
                         )
                               │
                               ▼
                         Manual pan/pinch live
                         useTransformComponent watches scale
                         → neighbor labels fade in at scale >= 1.8
```

### Recommended Project Structure
```
src/
├── components/
│   ├── MapView.tsx          # NEW — full-screen overlay, animation orchestration
│   ├── MapView.css          # NEW — overlay layout, card, close button
│   ├── FloorPlan.tsx        # MODIFIED — reduced to <picture> + markers
│   ├── FloorPlan.css        # MODIFIED — new .pin-assigned, .pin-dot, .pin-label
│   ├── TableModal.tsx       # DELETE
│   └── TableModal.css       # DELETE
├── assets/
│   └── Reception Seat Diagram.png   # source only, not imported directly in MapView
├── config/
│   └── floorPlan.json       # unchanged — 54 tables in percentage coords
└── ...
public/
└── floor-plan/              # NEW — committed prebuilt image variants
    ├── floor-plan-900.avif
    ├── floor-plan-1600.avif
    ├── floor-plan-2400.avif
    ├── floor-plan-900.webp
    ├── floor-plan-1600.webp
    ├── floor-plan-2400.webp
    ├── floor-plan-900.png
    ├── floor-plan-1600.png
    └── floor-plan-2400.png
scripts/
└── generate-images.mjs      # NEW — one-time sharp script, not in prod bundle
```

### Pattern 1: TransformWrapper + Ref-based zoomToElement

**What:** `TransformWrapper` accepts a `ref` typed as `ReactZoomPanPinchRef`. The ref exposes `zoomToElement(node, scale, animationTime, animationType, offsetX, offsetY)`. Call it after image load + overview hold.

**When to use:** Whenever programmatic zoom to a DOM element is needed. This is the primary MAP-01 mechanism.

**Example:**
```tsx
// Source: https://github.com/BetterTyped/react-zoom-pan-pinch/blob/master/src/core/handlers/handlers.logic.ts
import { useRef } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

function MapView({ guest, onClose }: MapViewProps) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const assignedPinRef = useRef<HTMLDivElement | null>(null);

  function handleImageLoad() {
    // 250ms overview beat, then 700ms zoom-in
    setTimeout(() => {
      if (transformRef.current && assignedPinRef.current) {
        transformRef.current.zoomToElement(
          assignedPinRef.current,  // DOM node — preferred over id string
          2.75,                    // scale (clamped to minScale/maxScale)
          700,                     // animationTime ms
          'easeOutQuart',          // animationType
          0,                       // offsetX
          64,                      // offsetY — bias down to clear overlay card
        );
      }
    }, 250);
  }

  return (
    <TransformWrapper
      ref={transformRef}
      initialScale={1}
      minScale={0.5}
      maxScale={6}
      centerOnInit={true}
      limitToBounds={true}
    >
      <TransformComponent>
        <picture>
          {/* srcset below — see Image Pipeline pattern */}
        </picture>
        {/* markers */}
      </TransformComponent>
    </TransformWrapper>
  );
}
```

### Pattern 2: zoomToElement Full Signature

**Verified from source** (`src/core/handlers/handlers.logic.ts`):

```typescript
// Source: https://github.com/BetterTyped/react-zoom-pan-pinch handlers.logic.ts
zoomToElement(
  node: HTMLElement | string,   // DOM node OR element id string
  scale?: number,               // target scale; undefined = library auto-calculates fit
  animationTime = 600,          // ms; default 600
  animationType: keyof typeof animations = 'easeOut',
  offsetX = 0,                  // px offset applied after centering
  offsetY = 0                   // px offset; use 64 to bias below overlay card
): void
```

**Valid `animationType` values** (verified from `animations.constants.ts`):
`easeOut`, `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInOutQuint`

**Recommendation:** Use `'easeOutQuart'` for the zoom-in (fast start, smooth deceleration — matches the `cubic-bezier(0.22, 1, 0.36, 1)` feel specified in UI-SPEC without needing a custom easing string).

**Scale clamping:** scale is always clamped to `[minScale, maxScale]` internally via `checkZoomBounds` — passing 2.75 with maxScale=6 is safe. [VERIFIED: zoom.logic.ts source]

**DOM node vs string:** Prefer passing the DOM node ref directly (`assignedPinRef.current`) rather than an id string — avoids `document.getElementById` look-up timing issues on first render.

### Pattern 3: Adaptive Label Visibility via useTransformComponent

**What:** `useTransformComponent` hook receives the current transform state on every gesture without causing re-renders of the parent. Use it to drive CSS class toggling for neighbor label visibility.

**When to use:** D-09 adaptive labels — show neighbor labels only when scale >= 1.8.

```tsx
// Source: https://github.com/BetterTyped/react-zoom-pan-pinch README
import { useTransformComponent } from 'react-zoom-pan-pinch';

// Inside a child of TransformWrapper:
const FloorPlanContent = ({ tableNumber }: { tableNumber: string }) => {
  const content = useTransformComponent(({ state }) => {
    const showLabels = state.scale >= 1.8;
    return (
      <div className={showLabels ? 'labels-visible' : ''}>
        {/* markers */}
      </div>
    );
  });
  return content;
};
```

**Note:** `useTransformComponent` must be used inside a component that is a **descendant of `TransformWrapper`**. It cannot be used in the same component as `TransformWrapper`.

### Pattern 4: Committed Prebuilt Image Variants

**Why not vite-imagetools:** vite-imagetools v10 (latest) declares `"vite": ">=7.0.0"` as a peer dependency. This project uses `vite: ^6.0.1`. **Incompatible.** [VERIFIED: npm registry]

**Recommended approach:** One-time `scripts/generate-images.mjs` using `sharp` as a devDependency. Run manually when the floor plan image changes; commit the 9 output files to `public/floor-plan/`. At build time, Vite copies `public/` verbatim — zero build-time image processing.

```js
// scripts/generate-images.mjs  (run once: node scripts/generate-images.mjs)
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../src/assets/Reception Seat Diagram.png');
const out = resolve(__dirname, '../public/floor-plan');

const widths = [900, 1600, 2400];
const formats = [
  { ext: 'avif', opts: { quality: 50 } },
  { ext: 'webp', opts: { quality: 80 } },
  { ext: 'png',  opts: { compressionLevel: 9 } },
];

for (const width of widths) {
  for (const { ext, opts } of formats) {
    await sharp(src)
      .resize(width)
      [ext](opts)
      .toFile(resolve(out, `floor-plan-${width}.${ext}`));
    console.log(`Generated floor-plan-${width}.${ext}`);
  }
}
```

**Expected output sizes** (3300×2517 PNG source, 1.5MB):
- 900w AVIF: ~30–60KB (AVIF is 50–70% smaller than PNG at equivalent quality)
- 1600w AVIF: ~80–150KB
- 2400w AVIF: ~150–280KB
- 900w WebP: ~80–120KB
- 900w PNG: ~200–350KB (compressed from 1.5MB original)

**`<picture>` markup in FloorPlan.tsx:**
```tsx
// Use string literals pointing to public/ paths — no Vite import needed
<picture>
  <source
    type="image/avif"
    srcSet="/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w"
    sizes="100vw"
  />
  <source
    type="image/webp"
    srcSet="/floor-plan/floor-plan-900.webp 900w, /floor-plan/floor-plan-1600.webp 1600w, /floor-plan/floor-plan-2400.webp 2400w"
    sizes="100vw"
  />
  <img
    src="/floor-plan/floor-plan-1600.png"
    srcSet="/floor-plan/floor-plan-900.png 900w, /floor-plan/floor-plan-1600.png 1600w, /floor-plan/floor-plan-2400.png 2400w"
    sizes="100vw"
    alt="Reception Floor Plan"
    loading="eager"
    decoding="async"
    onLoad={handleImageLoad}
  />
</picture>
```

**No TypeScript import complexity:** Files live in `public/` so they are addressed as runtime URL strings. No Vite module import needed. No `?url` suffix, no custom type declarations.

### Pattern 5: Preload on App Mount

```tsx
// In App.tsx useEffect on mount:
// Source: https://web.dev/articles/preload-responsive-images
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/avif';
  link.setAttribute('imagesrcset',
    '/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w'
  );
  link.setAttribute('imagesizes', '100vw');
  (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
  document.head.appendChild(link);
  return () => { document.head.removeChild(link); };
}, []);
```

**Belt-and-suspenders hidden img** (per CONTEXT.md `<specifics>`):
```tsx
// Rendered in App.tsx, always in DOM, visibility: hidden
<img
  src="/floor-plan/floor-plan-1600.avif"
  style={{ display: 'none' }}
  aria-hidden="true"
  alt=""
/>
```

**`fetchpriority="high"` value:** The `as="image"` default fetch priority is LOW (browser deprioritizes images vs render-blocking resources). Setting `fetchPriority = 'high'` promotes it to HIGH, ensuring the AVIF is fetched in parallel with the guest-list CSV. [VERIFIED: web.dev/articles/fetch-priority]

**`imagesrcset`/`imagesizes` browser support:** Widely supported in Chrome 73+, Firefox 78+, Safari 17.2+. For Safari < 17.2 (iOS 16), the `<link rel=preload>` falls back to fetching the `href` (no srcset), which is acceptable. [CITED: web.dev/articles/preload-responsive-images]

### Pattern 6: History Back-Button Integration

**What:** Push a history entry on MapView mount. Listen for `popstate` to close the map. Prevents real navigation while providing hardware-back support.

**The infinite loop pitfall:** If `popstate` fires and you call `history.back()` or navigate away, and that triggers another `popstate`, you get a loop. The safe pattern is to call `onClose()` (which unmounts MapView) and let the browser manage the stack — do NOT call `history.back()` inside the handler.

```tsx
// In MapView.tsx, on mount:
useEffect(() => {
  // Push a dummy entry so back button has somewhere to go
  history.pushState({ mapOpen: true }, '');

  function handlePopState(e: PopStateEvent) {
    // Back was pressed — state is now the entry before mapOpen
    // Just close; do NOT call history.back() here (loop risk)
    onClose();
  }

  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
    // If MapView closes via × or Escape (not back button), pop the pushed entry
    // Check if we still have the mapOpen state before popping
    if (history.state?.mapOpen) {
      history.back();
    }
  };
}, [onClose]);
```

**Why this works without loops:** `popstate` only fires on browser navigation (back/forward), NOT on `pushState`/`replaceState` calls. So pushing in mount and popping in cleanup are safe. [VERIFIED: MDN Window: popstate event]

**Caveat on iOS Safari:** WebKit added a security check that may ignore `pushState` calls made outside a user gesture on fresh page loads. However, since MapView always mounts as a direct result of a tap (guest selection), the `pushState` call is always within a user gesture chain and is safe. [CITED: MDN Working with the History API]

### Pattern 7: Percentage Coords Composing with TransformComponent

The existing marker placement math (`position.x * imageWidth`) in FloorPlan.tsx needs adjustment: when the floor plan is inside `TransformComponent`, the library wraps content in a CSS-transformed `<div>`. Markers positioned **absolutely inside `TransformComponent`** ride the transform correctly — they remain anchored to their percentage positions in the image coordinate space.

**Key requirement:** The `<picture>`/`<img>` and all marker `<div>`s must share the same positioned parent **inside** `TransformComponent`. The parent should be `position: relative` with the same dimensions as the displayed image.

```tsx
// Inside TransformComponent — the wrapping div must be position: relative
// and sized to the image dimensions so percentage coords stay correct
<TransformComponent>
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <picture>...</picture>  {/* width: 100%; display: block */}
    {markers.map(({ id, x, y }) => (
      <div
        key={id}
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          transform: 'translate(-50%, -100%)',  // anchor = bottom-center for teardrop
        }}
      />
    ))}
  </div>
</TransformComponent>
```

**`ResizeObserver` no longer needed:** In the simplified FloorPlan, the image fills its parent naturally; percentage positioning via CSS (`left: ${x*100}%`) is resolution-independent without needing to track `imageWidth`/`imageHeight`. This eliminates the `ResizeObserver` complexity from the current code.

**`imageWidth`/`imageHeight` state removal:** The current FloorPlan uses `position.x * imageWidth` (pixel positioning). The simplified version uses `position.x * 100 + '%'` (percentage CSS positioning). Same result, no state needed.

### Anti-Patterns to Avoid

- **Calling `zoomToElement` before the image has loaded:** The TransformWrapper doesn't know the content dimensions until the image fires `onLoad`. Call `zoomToElement` only in the `onLoad` handler (plus 250ms delay), never in `useEffect([], [])`.
- **Placing markers outside `TransformComponent`:** Markers outside the component won't move with the content during pan/zoom — they stay fixed in viewport space.
- **Using `100vh` for the full-screen overlay:** iOS Safari's `100vh` is the large viewport (includes hidden browser chrome). Use `100dvh` with `100vh` as fallback. [VERIFIED: MDN viewport units + community sources]
- **Calling `history.back()` inside the `popstate` handler:** This triggers another `popstate` event → infinite loop. Always just call `onClose()` and unmount.
- **Using vite-imagetools with Vite 6:** Incompatible — v10 requires Vite >=7. [VERIFIED: npm registry]
- **Importing public/ images with Vite `import` syntax:** Files in `public/` are served at root URL paths at runtime. Reference them as string literals (`'/floor-plan/floor-plan-900.avif'`), not with `import`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pan/zoom gesture engine | Custom touch handler with PointerEvents | react-zoom-pan-pinch | Pinch-to-zoom with velocity, iOS Safari touch normalization, boundary clamping — 2000+ lines of edge cases |
| Zoom-to-element animation | requestAnimationFrame loop with lerp | `zoomToElement()` | Library handles transform matrix decomposition, easing curves, boundary constraints automatically |
| Image format detection | JS `fetch` + Content-Type sniff | `<picture>` `<source type="image/avif">` | Browser does format negotiation natively; no JS needed |
| Easing functions | Custom cubic-bezier implementation | `animationType: 'easeOutQuart'` | Library has 14 named easings built in |

---

## Runtime State Inventory

Not applicable — this is a greenfield feature addition (new MapView component), not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts reference any string being changed.

---

## Common Pitfalls

### Pitfall 1: zoomToElement Timing — Called Before Image Loads
**What goes wrong:** `zoomToElement` is called in a `useEffect([], [])` before the floor plan image has loaded. The library calculates element position based on rendered dimensions; if the image hasn't painted, the element has no bounding box and zoom goes to (0,0).
**Why it happens:** React mounts the component synchronously; image decode is async.
**How to avoid:** Only call `zoomToElement` inside the `<img onLoad>` callback (plus the 250ms overview hold). Add a `imageLoaded` boolean guard.
**Warning signs:** Map zooms to top-left corner instead of the assigned pin.

### Pitfall 2: iOS Safari Scroll Bleed
**What goes wrong:** When the user drags the map, the page behind the fixed overlay also scrolls (rubber-band effect on iOS).
**Why it happens:** iOS ignores `overflow: hidden` on `body`/`html` for touch scroll. The page scroll event propagates up through the touch target chain.
**How to avoid:** Three combined defenses:
1. `touch-action: none` on the `TransformComponent` wrapper div.
2. `overscroll-behavior: contain` on the MapView overlay (`position: fixed; inset: 0`).
3. `position: fixed; inset: 0` on the overlay itself (takes it out of scroll flow).
**Warning signs:** The background card/search UI is visible through the overlay and scrolls when you drag the map.

### Pitfall 3: 100vh Layout Jump on iOS Safari
**What goes wrong:** Using `height: 100vh` on the map overlay causes a 60–80px layout jump when the browser toolbar collapses on scroll.
**Why it happens:** iOS Safari's `100vh` is calculated with the toolbar hidden (large viewport), so the initial render overshoots.
**How to avoid:** Use `height: 100dvh` (dynamic viewport height) with a `height: 100vh` fallback for older Safari (< iOS 15.4). The MapView uses `position: fixed; inset: 0` which avoids vh entirely — this is the safest approach and already specified.
**Warning signs:** Bottom edge of overlay appears below screen on iPhone; content clips.

### Pitfall 4: Pinch Gesture Steals Native Page Zoom on iOS
**What goes wrong:** Two-finger pinch on iOS both zooms the library's content AND triggers Safari's native page zoom, resulting in double-zoom.
**Why it happens:** iOS 16/17 may not fully honor `touch-action: none` on nested elements inside `position: fixed` overlays in certain Safari versions.
**How to avoid:** Ensure `<meta name="viewport" content="width=device-width, initial-scale=1">` is present in `index.html` (already standard for mobile apps). The library's touch handler calls `preventDefault()` on touch events, which should suppress native zoom when `touch-action: none` is active.
**Warning signs:** Map content zooms AND page zooms simultaneously; scroll position resets after gesture.

### Pitfall 5: History Entry Leak on Guest Switch
**What goes wrong:** User selects Guest A (MapView mounts, `pushState` called). Without closing, user selects Guest B (MapView re-renders with new guest without unmounting). History stack now has two extra entries.
**Why it happens:** If `selectedGuest` changes identity in App.tsx without going through null (not the current behavior but worth guarding), MapView might not unmount/remount.
**How to avoid:** In App.tsx, the current `handleGuestSelect` sets `selectedGuest` directly. Ensure that selecting a new guest while map is open goes through `closeModal()` first (set to null) then re-set — OR accept that `MapView` key-remounts on guest change via `key={guest.tableNumber}`, which forces a clean unmount+mount cycle.
**Warning signs:** Browser back button requires multiple presses to exit the app.

### Pitfall 6: markers.pointer-events Conflict with Library Gestures
**What goes wrong:** Marker `<div>`s with `pointer-events: auto` intercept touch events that the library needs for pinch/pan detection.
**Why it happens:** The library uses `pointerdown` on the `TransformComponent` wrapper; marker divs sitting on top can consume events first.
**How to avoid:** Per D-12, all markers are `pointer-events: none` this phase — no tap interaction needed. This simultaneously avoids the gesture conflict and satisfies the "visual only" requirement.
**Warning signs:** Pinch/pan doesn't work when fingers are over marker positions.

---

## Code Examples

### Full TransformWrapper Configuration
```tsx
// Source: verified against context.model.ts + handlers.logic.ts
<TransformWrapper
  ref={transformRef}
  initialScale={1}
  minScale={0.3}     // allow zooming out to see full map
  maxScale={6}       // 6× = text on floor plan stays sharp on retina
  centerOnInit={true}
  limitToBounds={true}
  centerZoomedOut={true}  // re-center when user zooms out past content bounds
  smooth={true}
  wheel={{ step: 0.2 }}
  doubleClick={{ mode: 'toggle', step: 2.75 }}
  pinch={{ allowPanning: true }}
  panning={{ velocityDisabled: false }}
  onInit={() => { /* image may not be loaded yet — don't zoom here */ }}
>
  {/* render prop OR children — both work */}
  <TransformComponent
    wrapperStyle={{ width: '100%', height: '100%' }}
    contentStyle={{ width: '100%', height: '100%' }}
  >
    {/* content */}
  </TransformComponent>
</TransformWrapper>
```

### Reduced-Motion Guard
```tsx
// In MapView.tsx — check before calling zoomToElement
const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

setTimeout(() => {
  if (!transformRef.current || !assignedPinRef.current) return;
  transformRef.current.zoomToElement(
    assignedPinRef.current,
    2.75,
    prefersReducedMotion ? 0 : 700,   // instant jump if reduced motion
    'easeOutQuart',
    0,
    64,
  );
}, prefersReducedMotion ? 0 : 250);  // skip overview hold too
```

### Safe-Area CSS for Overlay Card and Close Button
```css
/* MapView.css */
.map-overlay-card {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  left: 16px;
  right: 16px;
  z-index: 100;
}

.map-close-button {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 110;
}

.map-surface {
  position: fixed;
  inset: 0;
  /* 100dvh not needed — inset: 0 covers full viewport without vh units */
  touch-action: none;
  overscroll-behavior: contain;
  z-index: 50;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for full-screen overlays | `100dvh` (dynamic) or `position: fixed; inset: 0` | iOS 15.4 (2022), broadly supported 2023+ | Eliminates iOS Safari toolbar-collapse layout jump |
| vite-imagetools for image optimization | Committed prebuilt variants via sharp script | vite-imagetools v10 dropped Vite <7 support (2026-02) | Build-time image processing not available for Vite 6 projects without version lock |
| `imagesrcset` attribute on link rel=preload (no priority) | Add `fetchpriority="high"` | Fetch Priority API widely supported since 2023 | Preloaded images actually fetch at high priority instead of low |
| CSS `transform` + manual animation loop | `react-zoom-pan-pinch` `zoomToElement` with named easings | Library v4.0.3 (2026) | No custom RAF animation code needed |

**Deprecated/outdated:**
- `useTransformEffect` hook (older versions) → replaced by `useTransformComponent` in v3+
- `ref.current.instance.transformState` direct access → use `onTransformed` callback or `useTransformComponent` instead (internal API, unstable)
- `@vitejs/plugin-legacy` for image formats → not relevant; AVIF/WebP `<picture>` fallback handles old devices natively

---

## Image Pipeline Decision Recommendation

**Recommendation: Committed prebuilt variants via `scripts/generate-images.mjs`.**

Reasons:
1. **vite-imagetools is incompatible** — v10 requires Vite >=7.0.0; project is on Vite ^6.0.1 [VERIFIED].
2. **Zero build-time cost** — files in `public/` are static; Vite copies them verbatim. No plugin, no transform.
3. **One floor plan image** — this app has exactly one floor plan image. The overhead of a build plugin is disproportionate; a one-time script is simpler.
4. **Repo size impact is low** — 9 variants at the estimated sizes above add ~1–2MB to the repo total, acceptable for a wedding-scale project.
5. **Script is version-controlled** — `scripts/generate-images.mjs` is committed; regenerating is `node scripts/generate-images.mjs` if the floor plan ever changes.

**Add to `package.json` scripts:**
```json
"generate-images": "node scripts/generate-images.mjs"
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently — no test script, no testing libs installed |
| Config file | None |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Testing Approach for a Wedding-Scale App

**Recommendation: Lightweight UAT-first with minimal Vitest for pure logic only.**

Rationale: The most critical correctness questions (does the animation feel right? does the pin land on the right table? does pinch work on an actual iPhone?) are not automatable without an iOS device. Human UAT with a scripted checklist is the right primary gate.

Add automated tests only for:
- `hasValidPosition` fallback branch (pure logic — does MapView show fallback message when tableNumber not in config?)
- `zoomToElement` callback invocation (does the effect fire with correct args after image load + delay?)

Do NOT add automated tests for:
- CSS animation correctness (visual)
- iOS Safari gesture behavior (requires device)
- Image format negotiation (browser-controlled)

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| MAP-01 | zoomToElement called after 250ms + img load | unit | `vitest run src/components/MapView.test.tsx` | Mock transformRef; verify call args |
| MAP-01 | Overview scale = 1.0 before zoom fires | unit | same file | Check no zoom on mount |
| MAP-02 | Pinch/drag gesture on iPhone | manual UAT | — | Cannot automate without Appium/real device |
| MAP-03 | Assigned pin visible at overview | manual UAT | — | Visual check; red teardrop vs gray dot |
| MAP-03 | Neighbor labels hidden at scale <1.8, visible ≥1.8 | manual UAT | — | Pan/zoom to threshold and observe |
| MAP-04 | No scroll bleed on iOS Safari | manual UAT | — | iPhone with background scroll test |
| MAP-05 | AVIF served to modern Chrome/Safari | manual UAT | — | DevTools Network > filter image/avif |
| MAP-05 | PNG fallback served to old browser | manual UAT | — | Hard to automate; check `<picture>` markup in DOM |
| Fallback | Missing tableNumber shows fallback text | unit | `vitest run src/components/MapView.test.tsx` | Render with tableNumber not in config |

### UAT Scripted Flow (human tester checklist)
```
1. Open app on iPhone (Safari, current iOS)
2. Type a name → select a guest from dropdown
3. VERIFY: Full-screen map opens with floor plan visible
4. VERIFY: Red teardrop pin is pulsing on the correct table
5. WAIT: After ~250ms, map smoothly zooms to the table (700ms animation)
6. VERIFY: Final zoom shows assigned table prominently; neighbors visible
7. VERIFY: At final zoom, table number labels are visible for neighbor tables
8. ACTION: Pinch to zoom in further → VERIFY: no page scroll bleed-through
9. ACTION: Drag map → VERIFY: map pans smoothly, no background scroll
10. ACTION: Double-tap → VERIFY: zoom toggles
11. ACTION: Tap × button → VERIFY: returns to search view
12. REPEAT steps 2-4, then press hardware Back → VERIFY: same result as ×
13. REPEAT steps 2-4, then press Escape (keyboard) → VERIFY: same result as ×
14. TYPE a guest name with an invalid table number → VERIFY: fallback message shown
15. OPEN DevTools > Network > filter "avif" → VERIFY: floor plan loaded as AVIF
16. ZOOM browser to 1600px viewport → VERIFY: 1600w srcset variant loaded
```

### Wave 0 Gaps (test infrastructure to create before implementation)
- [ ] Install vitest + @testing-library/react + jsdom: `npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom`
- [ ] `vitest.config.ts` — set `environment: 'jsdom'`, include `globals: true`
- [ ] `src/components/MapView.test.tsx` — covers MAP-01 unit assertions and fallback branch
- [ ] `scripts/generate-images.mjs` — Wave 0 should create this script and run it to populate `public/floor-plan/`

---

## Security Domain

This phase adds no authentication, session management, input validation of untrusted data, cryptography, or server-side logic. The only new network request is a `<link rel=preload>` for a static image from the same origin.

**ASVS applicable categories for this phase:**
| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | No auth added |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No access control |
| V5 Input Validation | Minimal | `guest.tableNumber` used to look up config key — string lookup in a known-key object, no injection risk |
| V6 Cryptography | No | No crypto |

No security hardening tasks needed for this phase beyond the existing CSP/headers if any (not configured in this project).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | sharp script | ✓ | v22.14.0 | — |
| npm | package install | ✓ | (via node) | — |
| sharp (npm install) | generate-images script | Not yet installed | 0.34.5 on registry | Must install as devDep |
| ImageMagick | image variants (alt) | ✗ | — | Use sharp script instead |
| ffmpeg | image variants (alt) | ✗ | — | Not needed |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:**
- `sharp` devDependency: install with `npm install --save-dev sharp` in Wave 0 before running the image generation script.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | squoosh-cli is deprecated/abandoned | Standard Stack alternatives | If still maintained, it could be an alternative; low risk since sharp is the better choice regardless |
| A2 | AVIF quality=50 produces ~30-60KB for a 900px floor plan | Image Pipeline | Actual sizes depend on image complexity; may need quality tuning. Run script and check before committing |
| A3 | `zoomToElement` offsetY=64 is sufficient to clear the overlay card | Pattern 1 | Overlay card height varies with description text; may need runtime calculation of card height |
| A4 | iOS Safari ≥15.4 required for `100dvh` (not needed since we use `inset: 0`) | iOS Pitfalls | Using `position: fixed; inset: 0` avoids this entirely — assumption is moot |

**All critical claims were verified or cited. Only A1-A3 are assumed.**

---

## Open Questions (RESOLVED)

1. **Image quality tuning**
   - What we know: Source PNG is 3300×2517 at 1.5MB. AVIF quality=50 is typical for floor-plan-style graphics (mostly flat color, text, lines).
   - What's unclear: Actual encoded file sizes; whether text labels on the floor plan remain readable at quality=50 AVIF.
   - Recommendation: Run `scripts/generate-images.mjs` in Wave 0, visually inspect the 900w AVIF on a phone screen, and tune quality upward if text is illegible. Target 30-80KB for the 900w AVIF.
   - **Resolution:** Deferred to UAT step 17 (iPhone visual check of 900w AVIF legibility). If text is illegible, tune `quality` upward in `scripts/generate-images.mjs` and regenerate. Not blocking plan execution — plans produce quality=50 as the initial value, UAT validates or flags for retune.

2. **`minScale` value for fit-to-viewport**
   - What we know: `centerOnInit: true` centers content. `minScale` of 0.3 prevents zooming out too far. The correct "fit-to-viewport" initial scale depends on the image aspect ratio vs viewport size.
   - What's unclear: Whether `centerOnInit` also auto-scales to fit, or just centers at `initialScale: 1`.
   - Recommendation: Test in browser. If `initialScale: 1` shows the full image overflowing on a phone, reduce `initialScale` or use `centerZoomedOut: true`. Planner should keep this as a runtime-tunable value.
   - **Resolution:** UI-SPEC Map Surface table locks `minScale: 1.0` with rationale "Min = fit-to-viewport". Plans adopt `minScale: 1.0`. Previous RESEARCH.md example values (0.3 / 0.5) are superseded — UI-SPEC is authoritative.

3. **Guest switch while map is open (D-08 carry-forward)**
   - What we know: UI-SPEC specifies "re-runs the overview-hold-zoom-in sequence for the new pin" when a new guest is selected while map is open.
   - What's unclear: Whether this requires unmount+remount of MapView (using `key={guest.tableNumber}` on the component) or an imperative `resetTransform()` → `zoomToElement()` sequence.
   - Recommendation: Use `key={guest.tableNumber}` on `<MapView>` in App.tsx — forces clean remount, resets all state, no edge cases with in-flight animations.
   - **Resolution:** Implemented in Plan 03-05 Task 1 as `<MapView key={selectedGuest.tableNumber} .../>` per the RESEARCH.md recommendation. Confirmed by plan-checker (iteration 1) — `must_haves.truths` of 03-05 enforces the `key=` pattern.

---

## Sources

### Primary (HIGH confidence — verified from source code this session)
- `react-zoom-pan-pinch` GitHub source `src/core/handlers/handlers.logic.ts` — `zoomToElement` full signature
- `react-zoom-pan-pinch` GitHub source `src/core/animations/animations.constants.ts` — all 14 valid animation type names
- `react-zoom-pan-pinch` GitHub source `src/models/context.model.ts` — `ReactZoomPanPinchProps` full interface
- `react-zoom-pan-pinch` GitHub source `src/core/zoom/zoom.logic.ts` — scale clamping behavior
- npm registry `react-zoom-pan-pinch` — version 4.0.3, latest tag
- npm registry `vite-imagetools` — version 10.0.0, `peerDependencies: { vite: ">=7.0.0" }`
- npm registry `sharp` — version 0.34.5
- npm registry `vitest` — version 4.1.4
- Project codebase `src/assets/Reception Seat Diagram.png` — 3300×2517, 1.5MB [VERIFIED: file command]

### Secondary (MEDIUM confidence — cited from official documentation)
- [MDN: Window: popstate event](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event) — popstate behavior, pushState safety
- [web.dev: Preload responsive images](https://web.dev/articles/preload-responsive-images) — `imagesrcset`/`imagesizes` + `fetchpriority` on `<link rel=preload>`
- [web.dev: Fetch Priority API](https://web.dev/articles/fetch-priority) — `fetchpriority="high"` on image preloads
- [Context7 react-zoom-pan-pinch docs](https://github.com/bettertyped/react-zoom-pan-pinch) — basic usage, ref pattern, `useTransformComponent`

### Tertiary (LOW confidence — community / single source)
- Community reports of `react-zoom-pan-pinch` iOS Safari jerky panning (issue #263) — fixed in later versions; use library as-is
- iOS 16/17 pinch + double-zoom on fixed overlays — mitigated by `touch-action: none` per D-17; device testing required

---

## Metadata

**Confidence breakdown:**
- react-zoom-pan-pinch API: HIGH — extracted directly from TypeScript source files
- Image pipeline (vite-imagetools incompatibility): HIGH — npm registry peer dep verified
- iOS Safari pitfalls: MEDIUM — some from MDN + community issues; device testing is the authoritative check
- Preload / fetchpriority: HIGH — verified from web.dev official articles
- History API / popstate: HIGH — MDN verified
- Test infrastructure: HIGH — npm registry versions verified

**Research date:** 2026-04-16
**Valid until:** 2026-07-16 (stable libraries; 90 days)
