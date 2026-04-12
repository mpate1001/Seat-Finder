# Architecture Patterns

**Domain:** Wedding guest seating finder — React 18 SPA (Vite + TypeScript)
**Researched:** 2026-04-12
**Milestone scope:** Animated zoom-to-table, auto-detect table positions from image, fuzzy search, offline caching

---

## Current Architecture Snapshot

The app has five logical layers with all state in `App.tsx`:

```
Browser
  └── App.tsx (all state: guests[], searchResults[], selectedGuest)
        ├── SearchForm.tsx (local: inputValue, debounceRef)
        ├── GuestDropdown.tsx (pure display)
        └── TableModal.tsx (owns FloorPlan)
              └── FloorPlan.tsx (local: imageLoaded, imageWidth, isEnlarged)
                    └── floorPlan.json (static table pixel coordinates)

googleSheets.ts ──► fetch CSV ──► App.tsx on mount (no cache)
```

Key constraints that shape every integration decision:
- No router, no state library, no backend
- `App.tsx` is the single source of truth for all cross-component state
- `FloorPlan.tsx` does raw pixel math (scaleFactor = imageWidth / canvasWidth) — this is the hook point for both animation and auto-detection
- Guest data is loaded once on mount, then filtered in memory — this is the hook point for fuzzy search and caching

---

## Recommended Architecture for New Features

### Overview

Four features map to three distinct integration zones:

| Feature | Integration Zone | Where Code Lives |
|---------|-----------------|-----------------|
| Fuzzy search | App.tsx filter logic + new utility | `src/utils/fuzzySearch.ts` |
| Offline caching | Service layer wrapping googleSheets.ts | `src/services/guestCache.ts` + SW config |
| Animated zoom-to-table | FloorPlan.tsx internal behavior | `FloorPlan.tsx` (replace enlarge with zoom) |
| Auto-detect table positions | One-time setup tool, outside main app flow | `src/tools/TableDetector.tsx` (dev-only page) |

---

## Component Boundaries After This Milestone

```
Browser
  └── App.tsx
        ├── [state] guests[], loading, error, searchResults[], selectedGuest
        ├── [NEW] fuzzySearch(term, guests[]) → Guest[]  (replaces handleSearch filter)
        │
        ├── SearchForm.tsx (unchanged)
        ├── GuestDropdown.tsx (unchanged)
        └── TableModal.tsx (unchanged shell)
              └── FloorPlan.tsx  ← PRIMARY CHANGE SURFACE
                    ├── [NEW] react-zoom-pan-pinch TransformWrapper wrapping the image
                    ├── [NEW] programmatic zoomToElement / setTransform on table marker mount
                    └── floorPlan.json (static, bug-fixed: table 46 ≠ 47)

src/services/
  ├── googleSheets.ts (unchanged fetch + parse logic)
  └── [NEW] guestCache.ts  ← wraps googleSheets.ts, adds localStorage layer

src/utils/
  └── [NEW] fuzzySearch.ts  ← thin wrapper around Fuse.js, returns Guest[]

src/tools/   (dev-only, not imported by main app)
  └── [NEW] TableDetector.tsx  ← image upload → canvas → circle detection → JSON output

vite.config.ts
  └── [NEW] vite-plugin-pwa config  ← Workbox SW, precache static assets, runtime cache CSV
```

### Component Responsibilities (Clear Boundaries)

**`App.tsx` changes:**
- Replace `handleSearch` substring filter with a call to `fuzzySearch(term, guests)`
- Replace direct `fetchGuests()` call with `loadGuestsWithCache()` from `guestCache.ts`
- No other changes — all new features are encapsulated below this layer

**`FloorPlan.tsx` changes:**
- Wrap `<img>` and marker `<div>` in `TransformWrapper` + `TransformComponent` from react-zoom-pan-pinch
- On image load + position known: call `setTransform(x, y, scale, animationMs)` to pan/zoom to the table marker
- The enlarged fullscreen overlay becomes redundant (the zoom IS the enlarged view) — collapse the two render paths into one
- Keep the `scaleFactor` pixel math; the transform wrapper handles the visual zoom layer on top

**`guestCache.ts` (new):**
- Owns the decision: "fetch from network or serve from localStorage"
- Strategy: try network first (Google Sheets CSV), on success write to `localStorage` with a timestamp; on failure serve from `localStorage` if present
- Expiry: timestamp-based, 24-hour TTL (guest list does not change minute-to-minute, but organizer may update it day-of)
- Exposes a single async function: `loadGuests(): Promise<Guest[]>` — same signature as `fetchGuests()`, so `App.tsx` swap is one line

**`fuzzySearch.ts` (new):**
- Wraps Fuse.js configured for `firstName`, `lastName`, and a synthesized `fullName` key
- Threshold: `0.35` (permissive enough for mobile typos, tight enough to avoid noise)
- Returns `Guest[]` sorted by Fuse relevance score
- Instance is created once (memoized via `useMemo` or module-level singleton) against the full guest list — not reconstructed on every keystroke
- Exposes: `fuzzySearch(term: string, guests: Guest[]): Guest[]`

**`TableDetector.tsx` (new, dev-only):**
- Accessible at a separate route or as a standalone HTML page (`/detect`)
- Not imported by `App.tsx` — it must not inflate the production bundle
- User uploads their floor plan image → drawn to `<canvas>` → pixel analysis finds dark circular blobs → overlays numbered click targets → user confirms/adjusts → exports `floorPlan.json`
- This removes the manual pixel coordinate mapping pain entirely
- Implementation: OpenCV.js (WASM, loaded lazily) running HoughCircles in-browser, OR a simpler fallback: user clicks each table center on the canvas and the tool records coordinates

---

## Data Flow

### Guest Loading With Cache (New Flow)

```
App.tsx mount
  └── loadGuestsWithCache()  [guestCache.ts]
        ├── check localStorage["guestData"] + localStorage["guestDataTimestamp"]
        │     ├── cache HIT + fresh (< 24h)  →  parse + return Guest[]  (fast path, works offline)
        │     └── cache MISS or stale
        │           └── fetchGuests()  [googleSheets.ts]
        │                 ├── SUCCESS  →  write to localStorage + return Guest[]
        │                 └── FAILURE  →  cache HIT (stale)?  →  return stale Guest[]
        │                                  └── cache MISS?  →  throw (show error card)
        └── App.tsx sets guests[] state
```

### Fuzzy Search Flow (New Flow)

```
User types in SearchForm.tsx
  └── debounce 150ms → onSearch(term) → App.tsx handleSearch(term)
        └── fuzzySearch(term, guests)  [fuzzySearch.ts]
              └── fuseInstance.search(term)  [Fuse.js]
                    └── returns Guest[] sorted by match score
                          └── App.tsx sets searchResults[]
                                └── GuestDropdown renders
```

Fuse.js instance lifecycle:
- Created once when `guests[]` is populated (via `useMemo(() => new Fuse(guests, opts), [guests])` in `App.tsx`)
- Recreated only if `guests[]` reference changes (which only happens on retry)
- For ~200-500 wedding guests, Fuse.js index build is < 5ms — no performance concern

### Animated Zoom-to-Table Flow (New Flow)

```
User selects guest → TableModal opens → FloorPlan mounts
  └── FloorPlan reads tableNumber → looks up position in floorPlan.json
        └── <TransformWrapper> renders (react-zoom-pan-pinch)
              └── <TransformComponent>
                    └── <img> floor plan + <div class="point-marker" data-table-id={tableNumber}>
                          └── img onLoad fires
                                └── imageLoaded = true
                                      └── useEffect([imageLoaded, position])
                                            └── ref.current.setTransform(
                                                  targetX,   // center marker in viewport
                                                  targetY,   // center marker in viewport
                                                  2.5,       // zoom scale
                                                  600,       // animation ms
                                                  "easeOut"
                                                )
```

Target coordinate calculation (same math as today, applied to transform):
```typescript
const targetX = -(position.x * scaleFactor) + viewportWidth / 2;
const targetY = -(position.y * scaleFactor) + viewportHeight / 2;
```

The `useTransformContext` hook (or `useControls`) from react-zoom-pan-pinch exposes `setTransform`. The ref from `TransformWrapper` (`ref={transformRef}`) gives access to `transformRef.current.setTransform(...)`.

### Auto-Detect Table Positions Flow (Offline Tool)

```
Organizer uploads floor plan image (PNG/JPG)
  └── TableDetector.tsx draws image to <canvas>
        └── [Path A — OpenCV.js available]
        │     cv.HoughCircles(src, circles, HOUGH_GRADIENT, dp, minDist, param1, param2, minR, maxR)
        │       └── circles overlay rendered on canvas
        │             └── organizer confirms/rejects each detected circle
        │                   └── exports corrected positions as floorPlan.json
        │
        └── [Path B — fallback]
              User clicks on each table center on the canvas
                └── tool records {tableNumber: N, x, y} for each click
                      └── exports floorPlan.json
```

Path B is the reliable fallback. Path A (OpenCV.js) is a progressive enhancement — OpenCV.js WASM is ~8MB and loads asynchronously; if it fails to load, fall back to Path B silently.

---

## Service Worker / Offline Caching (vite-plugin-pwa)

The SW handles two separate caching concerns:

| Asset Type | Strategy | Rationale |
|-----------|----------|-----------|
| JS/CSS/images (static) | Cache First (precache) | Never changes between deploys; always fast |
| Floor plan PNG | Cache First (precache) | Large, static, must work offline |
| Google Sheets CSV URL | Network First with localStorage fallback | Must show fresh data; `guestCache.ts` owns this, NOT the SW |

The Google Sheets CSV should NOT be in the SW's `runtimeCaching` because:
1. The URL is a Google-owned cross-origin endpoint; CORS and opaque responses make SW caching unreliable
2. `guestCache.ts` already handles the offline fallback via `localStorage` with explicit staleness control
3. Duplicating the cache in two places (SW cache + localStorage) creates invalidation ambiguity

The SW's job is: precache all Vite-built static assets (hashed filenames) so the app shell loads without network. `guestCache.ts` handles the data layer.

---

## Build Order (Phase Dependencies)

Build in this order — each phase unlocks the next:

1. **Fix floorPlan.json bug (table 46/47)** — zero-dependency fix, do it first so all subsequent testing uses correct data

2. **Fuzzy search** — self-contained, no dependencies on other new features. Adds `fuse.js` dep and `src/utils/fuzzySearch.ts`. Touch points: `App.tsx` (swap one function), `package.json`. Can be tested independently before any other change.

3. **Offline caching (localStorage layer)** — self-contained service layer addition. Adds `src/services/guestCache.ts`. One-line change in `App.tsx`. Does NOT require PWA/SW yet. Delivers offline resilience immediately.

4. **Animated zoom-to-table** — requires understanding the existing FloorPlan pixel math before modifying it. Adds `react-zoom-pan-pinch`. Replaces the two-path render (normal + enlarged) with single TransformWrapper path. This is the highest-risk change to `FloorPlan.tsx` — tackle after the simpler items are done and tested.

5. **vite-plugin-pwa / service worker** — add last. It wraps the entire build pipeline. Adding it earlier creates noise in dev (SW caching makes hot reload unreliable without explicit `devOptions: { enabled: false }`). After static assets are stable, add PWA config in one commit.

6. **Auto-detect table positions tool** — independent of all above. Can be built in parallel or deferred. No production bundle impact because it lives in `src/tools/` and is excluded from the main Vite entry point.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: SW caching the Google Sheets CSV URL
**What goes wrong:** Google Sheets CSV is served from `docs.google.com` with CORS headers that vary. SW caching opaque cross-origin responses stores a 0-byte response status, which will make the app serve empty data offline instead of the localStorage fallback.
**Instead:** Let `guestCache.ts` own the data caching exclusively via localStorage. The SW should only precache same-origin static assets.

### Anti-Pattern 2: Reconstructing Fuse.js instance on every search keystroke
**What goes wrong:** `new Fuse(guests, opts)` inside `handleSearch` means rebuilding the index 150ms-debounced but still on every call — wasted work and GC pressure on mobile.
**Instead:** Create the Fuse instance once via `useMemo(() => new Fuse(guests, fuseOptions), [guests])` in `App.tsx` and pass the instance (or the search function) down.

### Anti-Pattern 3: Calling setTransform before the image has layout dimensions
**What goes wrong:** `setTransform` called in a `useEffect` that fires before the browser has painted the image will use `imageWidth = 0`, producing NaN coordinates and no animation.
**Instead:** Gate the `setTransform` call on both `imageLoaded === true` AND `imageWidth > 0`. The `onLoad` handler on `<img>` sets both — the effect dependency array must include both.

### Anti-Pattern 4: Importing TableDetector.tsx into the main app
**What goes wrong:** OpenCV.js WASM (~8MB) gets bundled into the production app, destroying mobile load time.
**Instead:** TableDetector is a dev tool only. Either: (a) keep it in `src/tools/` and add a Vite `build.rollupOptions.input` that excludes it from the default entry, or (b) build it as a completely separate HTML page (`tools/detect.html`) that Vite builds independently.

### Anti-Pattern 5: Allowing stale localStorage to silently persist bad data forever
**What goes wrong:** If a guest's table assignment changes day-of (it happens), the app serves cached wrong data to guests whose phones already loaded the app.
**Instead:** 24-hour TTL in `guestCache.ts` ensures same-day refreshes. Additionally, consider a version key in localStorage (e.g., `guestData_v2`) so a code deploy can intentionally bust the cache by changing the key name.

---

## Scalability Considerations

This is a single-event app for ~200-500 guests used for ~2 hours. Scalability is not a concern. The architecture is intentionally minimal — no state management library, no backend, no real-time updates. The risk profile is entirely about reliability (offline capability, fast load on mobile cellular) not scale.

---

## Sources

- react-zoom-pan-pinch v4.0.3 (April 2026): https://github.com/BetterTyped/react-zoom-pan-pinch
- react-zoom-pan-pinch programmatic API (setTransform, zoomToElement, centerView): https://blog.nashtechglobal.com/react-zoom-pan-pinch/
- Fuse.js fuzzy search: https://www.fusejs.io/
- Fuse.js + React integration: https://blogs.perficient.com/2025/03/17/implementing-a-fuzzy-search-in-react-js-using-fuse-js/
- vite-plugin-pwa Workbox integration: https://vite-pwa-org.netlify.app/guide/service-worker-precache
- vite-plugin-pwa runtime caching strategies: https://vite-pwa-org.netlify.app/workbox/
- PWA offline React guide: https://adueck.github.io/blog/caching-everything-for-totally-offline-pwa-vite-react/
- Hough Circle Detection in JavaScript: https://github.com/alxcnwy/Hough-Circle-Detection
- OpenCV.js HoughCircles browser: https://www.digitalocean.com/community/tutorials/introduction-to-computer-vision-in-javascript-using-opencvjs
