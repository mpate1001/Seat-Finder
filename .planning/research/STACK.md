# Technology Stack — Milestone Additions

**Project:** Seat-Finder (wedding seating app)
**Researched:** 2026-04-12
**Scope:** New libraries needed for animated map, fuzzy search, offline caching, and table position tooling. Does NOT re-document the existing React 18 / Vite 6 / TypeScript 5.6 base.

---

## Recommended Additions

### Animated Pan + Zoom Map

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-zoom-pan-pinch | ^4.0.3 | Pan, zoom, pinch on the floor plan image + overlay | Only library in the React ecosystem that combines touch-gesture handling, programmatic animation, and a `zoomToElement`-style API in a single package. The v4 `centerView(scale, animationTime, animationType)` and `setTransform(x, y, scale, animationTime)` methods are exactly what the "zoom to highlighted table" interaction needs. Handles both mouse (desktop preview) and touch (mobile guests) without extra wiring. Zero runtime dependencies beyond React. |

**Confidence:** MEDIUM — version 4.0.3 confirmed active (published days before research date). `centerView`/`setTransform` API confirmed via type definitions at unpkg. Exact easing enum values need verification against the live docs before implementation.

**Why not framer-motion:** framer-motion is a general animation library. It can animate CSS transforms but has no concept of constrained pan/zoom bounds, pinch-to-zoom gesture unification, or programmatic "navigate to element" helpers. You would rebuild all of react-zoom-pan-pinch from scratch on top of it. Not worth it.

**Why not a canvas-based approach:** The current FloorPlan component renders an `<img>` with absolutely-positioned DOM markers scaled by a `scaleFactor`. react-zoom-pan-pinch wraps a DOM subtree — the image and the existing marker div slot in directly with no architecture change. A canvas rewrite would require porting the entire rendering pipeline.

**Installation:**
```bash
npm install react-zoom-pan-pinch
```

---

### Fuzzy Name Search

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| uFuzzy | ^1.0.x | Replace the current `.includes()` search with fuzzy matching | uFuzzy is ~4 KB (vs Fuse.js ~15 KB gzipped). Its matching model — exact prefix/infix/suffix order is preserved — produces the right results for names: "Mahek" still ranks above "Meahk". Fuse.js's default scoring is documented to produce "bizarre matches" and poor ordering unless heavily tuned. For a ~200-guest list that never changes, uFuzzy's simple API (no index, just `search(haystack, needle)`) is sufficient and adds no build complexity. |

**Confidence:** MEDIUM — library confirmed active on npm. Size/quality comparison confirmed via multiple community sources (HN thread, npm-compare). Bundle size figures sourced from bundlephobia (Fuse.js 6.6.2) and the uFuzzy README.

**Why not Fuse.js:** Larger bundle, poor default result ordering for name searches (acknowledged by the author — requires `ignoreFieldNorm: true` and tuning). For a small static guest list, the extra features (weighted multi-field scoring, extended search syntax) are unnecessary complexity.

**Why not MiniSearch:** MiniSearch is optimized for full-text document search with indexing. It is heavier than uFuzzy and designed for a different problem (thousands of documents, not a name lookup).

**Why not a server-side search:** No backend. Static hosting. Not an option.

**Installation:**
```bash
npm install @leeoniya/ufuzzy
```

---

### Offline Caching (Google Sheets CSV + App Shell)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vite-plugin-pwa | ^1.2.0 | Service worker generation, app shell precaching, runtime caching for the Google Sheets CSV URL | This is the standard Vite + Workbox integration. It generates a service worker at build time with zero manual SW authoring. The `runtimeCaching` option accepts a `urlPattern` regex — pointing it at the Google Sheets CSV URL with `StaleWhileRevalidate` means: first load fetches live data and caches it; every subsequent load (including offline) serves cached data instantly. The existing `googleSheets.ts` fetch call needs no changes — the service worker intercepts transparently. |
| workbox-window | ^7.x | (peer dep, installed automatically) | Runtime SW registration helpers used by vite-plugin-pwa |

**Confidence:** HIGH — vite-plugin-pwa is the documented standard for Vite PWAs, version 1.2.0 confirmed from official docs site. `runtimeCaching` with external URL regex pattern confirmed working via official GitHub issues and multiple 2025 guides. `StaleWhileRevalidate` for CSV data is the correct strategy: serves stale cache immediately (fast for guests), revalidates in background (data stays fresh if they revisit).

**Why not manual service worker:** Writing a raw SW requires maintaining cache versioning, fetch event routing, and update logic by hand. vite-plugin-pwa + Workbox handles all of this declaratively and integrates with Vite's asset hashing.

**Why not localStorage:** localStorage has a 5 MB limit and is synchronous. The guest CSV is small enough today, but localStorage cannot intercept fetch requests — the existing `fetch()` call in `googleSheets.ts` would need to be rewritten. Service workers intercept transparently.

**Why not IndexedDB directly:** Same problem as localStorage — requires rewriting the fetch layer. SW + Workbox is the right abstraction level.

**Key config pattern for this project:**
```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        // Match the Google Sheets CSV publish URL
        urlPattern: /^https:\/\/docs\.google\.com\/spreadsheets\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'guest-data-cache',
          expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})
```

**Installation:**
```bash
npm install -D vite-plugin-pwa
```

---

### Table Position Auto-Detection from Floor Plan Image

This is the most complex feature. Research reveals a meaningful feasibility split between two approaches.

#### Approach A (Recommended): In-App Click-to-Map Calibration Tool

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native HTML Canvas API | browser built-in | Render uploaded image, capture click coordinates, export JSON | No new dependencies. User uploads their floor plan image, clicks each table circle, app records pixel coordinates and table number, exports `floorPlan.json`. This directly replaces the current manual pixel-hunting workflow (opening DevTools, guessing coordinates) with a guided UI. |

**Confidence:** HIGH — this approach uses zero new dependencies and the Canvas API is fully stable. The feasibility is not in question; only implementation effort.

**Why this beats computer vision for this project:**

1. **OpenCV.js is 7 MB** — a 7 MB WASM payload on a mobile wedding check-in app is a non-starter. Load time alone would break the under-10-second guest experience.

2. **The floor plan is user-drawn (Canva, Figma, etc.)** — table circles vary in color, size, stroke width, and rendering style between designs. HoughCircles (OpenCV's circle detector) requires tuning `dp`, `minDist`, `param1`, `param2`, `minRadius`, `maxRadius` per image. Getting reliable results across arbitrary floor plan styles without manual tuning is not achievable in-browser with current lightweight alternatives.

3. **The data is set once** — the couple maps tables once before the wedding. A 2-minute click-to-calibrate tool is faster than debugging a finicky CV detection pipeline and produces perfect results.

4. **Lightweight alternatives (JSFeat at 23 KB, GammaCV at 32 KB) do not include HoughCircles** — they provide edge detection and filtering primitives, not circle detection. Building circle detection from scratch on them is equivalent to or harder than the calibration tool approach.

#### Approach B (Avoid for now): TensorFlow.js / ONNX floor plan ML model

Not viable within the project timeline and constraints. Pre-trained floor plan models (DeepFloorplan, etc.) are Python-only. Running inference in-browser via TF.js adds 1–4 MB of runtime and requires either a pre-trained model (none exist for round-table wedding floor plans) or fine-tuning. Out of scope for a ~1-2 month timeline.

**No new npm install needed for Approach A.**

---

## Full Additions Summary

| Library | Version | Install as | Purpose |
|---------|---------|-----------|---------|
| react-zoom-pan-pinch | ^4.0.3 | dependency | Animated pan/zoom floor map |
| @leeoniya/ufuzzy | ^1.0.x | dependency | Fuzzy name search |
| vite-plugin-pwa | ^1.2.0 | devDependency | SW generation + offline caching |

Canvas API for calibration tool: no install, browser built-in.

**Existing stack: unchanged.** React 18, Vite 6, TypeScript 5.6, zero-backend, Google Sheets CSV, static hosting — all stay as-is.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Pan/zoom | react-zoom-pan-pinch | framer-motion | General animation lib, no pan/zoom primitives, would require full rebuild |
| Pan/zoom | react-zoom-pan-pinch | react-responsive-pinch-zoom-pan | Abandoned (last release 2019), no TypeScript types |
| Fuzzy search | uFuzzy | Fuse.js | 3x larger bundle, poor default name ordering |
| Fuzzy search | uFuzzy | MiniSearch | Overkill full-text engine, wrong problem class |
| Caching | vite-plugin-pwa | Manual service worker | Unnecessary complexity, no advantage for this use case |
| Caching | vite-plugin-pwa | localStorage | Cannot intercept fetch, size limits, requires rewriting fetch layer |
| Table detection | Click-calibration tool | OpenCV.js | 7 MB WASM, kills mobile load time, unreliable on varied floor plan styles |
| Table detection | Click-calibration tool | TensorFlow.js | No suitable pre-trained model, 1–4 MB runtime, timeline doesn't support training |

---

## Sources

- react-zoom-pan-pinch GitHub (BetterTyped/react-zoom-pan-pinch) — version 4.0.3, API shape from unpkg type definitions
- uFuzzy GitHub (leeoniya/uFuzzy) — size, quality rationale from README and HN discussion (https://news.ycombinator.com/item?id=33035580)
- Fuse.js bundlephobia entry — 15 KB gzipped figure (https://bundlephobia.com/package/fuse.js@6.6.2)
- vite-plugin-pwa official docs (https://vite-pwa-org.netlify.app/) — version 1.2.0, runtimeCaching config pattern
- OpenCV.js size: ~7 MB confirmed via Theodo blog and DigitalOcean tutorial
- JSFeat (23 KB) / GammaCV (32 KB) — sizes from DEV Community JS CV library survey
- npm-compare: https://npm-compare.com/@leeoniya/ufuzzy,fuse.js,fuzzy,fuzzysearch,fuzzyset.js,string-similarity
