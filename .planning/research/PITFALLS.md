# Domain Pitfalls

**Domain:** Wedding seating finder — React 18 + Vite + TypeScript SPA
**Milestone scope:** Animated zoom-to-table map, image-based table position auto-detection, fuzzy search, offline caching
**Researched:** 2026-04-12

---

## Critical Pitfalls

Mistakes that cause rewrites, broken experiences on wedding day, or features that silently don't work.

---

### Pitfall 1: Google Sheets CSV is a cross-origin opaque response — service worker cannot cache it

**What goes wrong:** The Google Sheets CSV URL (`docs.google.com`) is a different origin from the app. When a service worker intercepts this fetch, the response comes back as an "opaque response" (status 0, body unreadable). Caching an opaque response with a cache-first strategy means:
- You cannot verify the response succeeded before storing it
- Chrome pads each opaque response to ~7 MB against storage quota (the real CSV is a few KB)
- If the first fetch fails (network error, rate limit), the error response gets cached and the app is permanently broken until the cache is manually cleared or a new service worker deploys

**Why it happens:** Service worker CORS rules. Google Sheets "Publish to web" does not send `Access-Control-Allow-Origin` headers permitting the service worker to inspect the response. The existing `fetchGuests()` makes a plain `fetch()` with no explicit `mode`, so the service worker sees an opaque response.

**Consequences:** On wedding day, the first guest to load the app on weak venue WiFi may cache a failed fetch. Every subsequent guest served by the service worker then sees "Failed to load guest list" with no recovery path, because the cached failure is served forever.

**Prevention:**
- Do NOT apply a cache-first or cache-only strategy to the Google Sheets URL in the service worker runtime cache config
- Use network-first or stale-while-revalidate for that specific URL origin
- As a belt-and-suspenders measure: cache the parsed guest data in `localStorage` with a timestamp immediately after a successful fetch in the app code — this is independent of the service worker and always readable
- Even better for this use case: bundle the finalized guest list as a static JSON import at build time (the list is frozen before the event). This eliminates the cross-origin runtime fetch entirely and makes the entire offline strategy trivial

**Detection warning signs:**
- Service worker logs show `status: 0` for the Sheets fetch
- Chrome DevTools Application > Cache Storage shows entries with 0-byte or enormous sizes for the CSV URL

**Phase:** Offline caching phase — must be addressed before service worker is registered

---

### Pitfall 2: The floor plan image coordinate system breaks when the image is replaced or resized

**What goes wrong:** All 54 table positions in `floorPlan.json` are absolute pixel coordinates tied to the exact pixel dimensions of `Reception Seat Diagram.png` (3300x2517). The existing `FloorPlan.tsx` correctly scales these at render time (`scaleFactor = imageWidth / config.canvasWidth`). But if the image is replaced with a new version at different dimensions — common when the couple updates the floor plan in Canva/Figma — every single marker position becomes wrong without any error or warning.

**Why it happens:** Pixel coordinates are not portable. The JSON config stores raw pixel values, not ratios. A new 3000x2280 export of the same floor plan silently moves every marker.

**Consequences:** The entire feature of "see your table on the map" is broken. Staff cannot detect this at setup time because the markers appear — they're just in wrong positions.

**Prevention:**
- Store table positions as percentages (0–1 ratios of canvas width/height), not pixels. Convert once at read time: `x_px = position.x * config.canvasWidth`
- When building the auto-detect feature, output percentages, not pixels
- Add a visual calibration check tool (even a simple dev-only overlay that renders all markers) to verify positions after any image replacement

**Detection warning signs:**
- Markers appear on the map but are clearly off-position
- `config.canvasWidth` in `floorPlan.json` does not match the actual PNG dimensions

**Phase:** Auto-detect phase and animated zoom phase — must standardize coordinate format before building either

---

### Pitfall 3: Auto-detecting table positions from a hand-drawn image is not reliably solvable in the browser

**What goes wrong:** The plan is to detect table positions from user-uploaded floor plan images (Canva/Figma exports). Browser-based approaches (OpenCV.js, Tesseract.js, TensorFlow.js object detection) have hard accuracy limits on hand-drawn or stylized images. Specific failure modes:
- Circle/ellipse detection (Hough transforms via OpenCV.js) fails when tables are rendered as decorative shapes, have thick borders, or are close together
- OCR (Tesseract.js) for reading table numbers is unreliable on stylized fonts, colored backgrounds, or small text — and Tesseract has known poor performance on table/grid layouts
- The floor plan (`Reception Seat Diagram.png`) is a custom-drawn image with 54 tables; a general-purpose detector has no domain knowledge that circles = tables

**Why it happens:** Client-side CV libraries are designed for standard photographic input. A floor plan diagram is a synthetic vector-export image with domain-specific conventions the library has no training on.

**Consequences:** You spend significant time on a feature that produces unreliable output. Worse, if the UX implies "positions were detected successfully" but markers are wrong, guests go to wrong tables. This is worse than the manual JSON approach.

**Prevention:**
- Scope the auto-detect feature carefully: frame it as "assisted positioning" not "fully automatic." The most reliable browser-side approach is a click-to-place UI — show the floor plan, let the user click each table, record the click coordinates. This is more reliable than any CV approach and takes ~5 minutes for 54 tables
- If CV is attempted anyway: use a controlled input format (require the image to have a specific background color for table markers, or use QR/ArUco fiducial markers on the diagram), not a general hand-drawn image
- Do not block the milestone on CV accuracy — build the click-to-place tool first, treat auto-detect as an enhancement only if a reliable approach emerges

**Detection warning signs:**
- Detection accuracy below 80% on the actual floor plan during development testing
- Any CV approach requiring preprocessing steps the user must perform manually (adjusting contrast, cropping) — this negates the "ease of setup" benefit

**Phase:** Auto-detect phase — validate feasibility with a prototype before committing to full implementation

---

### Pitfall 4: iOS Safari body scroll leaks through the zoom/pan component

**What goes wrong:** When `react-zoom-pan-pinch` (or any pan/zoom library) wraps the floor plan image, iOS Safari allows the page body to scroll underneath the panning gesture. The `touch-action` CSS property must be applied both to the panning element AND its parent. Without this, a vertical pan gesture on the map scrolls the page instead of panning the image — guests see the page bounce instead of the map moving.

**Why it happens:** iOS Safari handles nested scroll/pan contexts differently from Android Chrome. `preventDefault()` on touch events is insufficient on its own because iOS processes touch-action before JavaScript listeners fire. The library's default config typically sets `touch-action: none` on the inner element but the parent container still has default touch-action, which iOS inherits.

**Consequences:** On iPhone (which will be the dominant device at the venue), the zoom-to-table feature is frustrating or unusable. Guests cannot pan the zoomed map to see their table — the page just scrolls. This is a show-stopper for the feature's core value.

**Prevention:**
- Set `touch-action: none` on the immediate parent wrapper element of the `TransformWrapper`, not just on the library's own element
- Test on a real iPhone Safari before any demo — iOS Simulator does not reproduce this bug accurately
- Use `overscroll-behavior: none` on the body during the enlarged map state (apply via a CSS class toggled when the modal is open)
- Avoid `body { overflow: hidden }` as the sole fix — it works on Android but is unreliable on iOS due to the elastic overscroll bounce

**Detection warning signs:**
- Page bounces or scrolls when attempting to pan the zoomed floor plan on iPhone
- Works fine in Chrome DevTools mobile emulation but breaks on a real device

**Phase:** Animated zoom phase — must test on real iPhone before considering this done

---

### Pitfall 5: Programmatic zoom-to-table lands the marker off-center

**What goes wrong:** The goal is to animate the camera so the guest's table is centered on screen after zoom. The `zoomToElement` API (react-zoom-pan-pinch) or manual `setTransform` calculations must account for:
- The floor plan image's letterboxing offsets (`offsetX`, `offsetY` calculated in `handleEnlargedImageLoad`) — already present in the code but must be carried into the transform math
- The table marker's position after scale, not before
- The container's scroll position if it has any

If the transform math uses the raw pixel coordinates without the letterbox offset, the "center" lands on the wrong point — the image center rather than the table position. With a 3300x2517 image, the error can be several hundred pixels.

**Why it happens:** The existing `FloorPlan.tsx` already computes `enlargedDimensions.offsetX` and `enlargedDimensions.offsetY` to handle letterboxing. The animated zoom feature must use these same values as its origin reference, not just `position.x * scale`.

**Consequences:** The animation zooms to a point near but not on the table, defeating the feature's purpose. Guests see the animation but cannot find the red marker without panning.

**Prevention:**
- The target transform coordinates are: `targetX = -(position.x * scale - viewportWidth/2) + offsetX * scale`, `targetY = -(position.y * scale - viewportHeight/2) + offsetY * scale` (exact formula depends on library API)
- Build the zoom-to-table with a visible debug mode first (log the computed coordinates) and verify the marker lands within 20px of center on multiple table positions including edge tables (table in top-left corner, table in bottom-right corner)
- Edge tables are the hardest — clamping logic must not pull them off screen

**Detection warning signs:**
- Animation completes but the pulsing marker is not visible in the viewport
- Works for center tables but fails for tables near image edges

**Phase:** Animated zoom phase — coordinate math must be validated against all four quadrants of the floor plan

---

## Moderate Pitfalls

---

### Pitfall 6: Fuse.js default threshold (0.6) returns too many false positives for name search

**What goes wrong:** The default Fuse.js threshold is 0.6, which is quite loose. For a guest list of ~100-200 people, a search for "Patel" with threshold 0.6 will match names like "Papel", "Hotel", and other unrelated strings. In a high-stress check-in scenario, a list of 15 results when the guest expected 2-3 creates more confusion than the current `includes()` approach.

**Why it happens:** Fuse.js is designed as a general-purpose library. Its defaults favor recall over precision. Name matching at a wedding needs the opposite: high precision, moderate recall.

**Consequences:** Guests see a long list of wrong names and give up or ask staff anyway — the fuzzy search makes things worse, not better, unless tuned.

**Prevention:**
- Start with threshold `0.3` for this use case (recommended starting point from community evidence)
- Weight fields: `{ name: 'firstName', weight: 0.7 }`, `{ name: 'lastName', weight: 0.5 }` — first name typos are more common on mobile keyboards than last name typos
- Do not enable `includeScore` in production UI — showing match percentages to guests is confusing
- Nicknames (Mike/Michael, Katie/Katherine, Ted/Edward) are NOT solved by Fuse.js threshold tuning — they require a separate nickname lookup table. This is a known hard limitation; set expectations accordingly
- Test with the actual guest list before the event, specifically searching common Indian and English name variants present in the list

**Detection warning signs:**
- Searching a 3-letter common substring returns more than 10 results
- A guest's name searched exactly returns no result (threshold too tight)

**Phase:** Fuzzy search phase — tuning requires the real guest list

---

### Pitfall 7: The service worker caches a stale guest list version guests can never escape

**What goes wrong:** If `vite-plugin-pwa` is configured with `generateSW` strategy and the guest list is cached, a guest who opens the app before the wedding and then opens it on wedding day may see an older version of the guest list. Table assignments sometimes change in the final week. The service worker serves the cached version and the guest finds they're at the wrong table.

**Why it happens:** Service worker updates only activate when the old worker has no open clients. In practice, the phone keeps the old worker for the entire browser session. The default `vite-plugin-pwa` behavior is "prompt user to update" — but most guests will not understand or dismiss the prompt.

**Consequences:** Guest is directed to the wrong table. This is a real-world failure, not just a UX annoyance.

**Prevention:**
- Use `skipWaiting: true` + `clientsClaim: true` in the service worker config for this app — it's a read-only, single-session tool used by non-technical guests. Aggressive auto-update is correct here
- Set a short TTL on the cached guest data (1-2 hours) if using `localStorage` as the cache layer — force re-fetch on the event day
- Consider the build-time JSON import approach: if the guest list is bundled at build time, the service worker update (which happens on every new deploy) automatically delivers the updated list. This is the most reliable approach for a one-day event

**Detection warning signs:**
- Old cached guest list appears after a known re-deploy
- `vite-plugin-pwa` update prompt appears but guest count matches old data

**Phase:** Offline caching phase

---

### Pitfall 8: `will-change: transform` on the floor plan overlay causes memory pressure on low-end phones

**What goes wrong:** Adding `will-change: transform` to the floor plan overlay or the zoom container promotes those elements to GPU compositing layers. This is correct for 60fps animation. However, the floor plan image is 3300x2517 — the GPU texture for this element at full resolution is very large (~30MB for RGBA). On low-end Android phones with shared GPU/CPU memory, this can cause the browser to drop frames or crash the tab.

**Why it happens:** `will-change: transform` must be applied only to the element actively being animated and only for the duration of the animation. Applying it persistently to a large image container wastes GPU memory even when no animation is running.

**Prevention:**
- Apply `will-change: transform` dynamically in JavaScript only during the animation, then remove it (`element.style.willChange = 'auto'`) after animation completes
- Or: set `will-change` on the point marker element only (small), not the full image container
- Serve an appropriately sized floor plan image — the full 3300x2517 PNG is oversized for mobile. A 1200px-wide WebP version reduces the texture by ~85% with no perceptible quality loss on a phone screen

**Detection warning signs:**
- Tab crashes or reloads spontaneously on mid-range Android devices during zoom animation
- Chrome DevTools Layers panel shows a very large composited layer

**Phase:** Animated zoom phase — image optimization is a prerequisite

---

## Minor Pitfalls

---

### Pitfall 9: No "not found" state causes silent search failures that guests interpret as the app being broken

**What goes wrong:** This already exists in the codebase (CONCERNS.md flags it). When fuzzy search replaces `includes()`, the failure mode changes: instead of returning zero results for a misspelling, Fuse.js returns zero results when the threshold filters everything out. Without a "no results" message, the guest sees a blank area and refreshes the page (losing their typed name) or asks staff.

**Prevention:** Show a "No matching guests found — try a shorter name or ask staff" message when `searchResults.length === 0` and search term is non-empty. This is a one-line change but is blocked by fuzzy search implementation.

**Phase:** Fuzzy search phase — add alongside Fuse.js integration

---

### Pitfall 10: The existing marker z-index and position are calculated once on image load — resize events break it

**What goes wrong:** `scaleFactor` is computed from `imageWidth` set in `handleImageLoad`. If the user rotates their phone (portrait to landscape) after the modal is open, `imageWidth` is stale and the marker appears in the wrong position.

**Prevention:** Listen for `window.resize` (debounced) and re-measure the image element. Or use a `ResizeObserver` on the image element directly — more reliable than the window resize event on mobile where browser chrome appearing/disappearing also triggers resize.

**Phase:** Animated zoom phase — re-measurement logic is needed anyway for the zoom feature

---

### Pitfall 11: CSV parser column-index assumption silently corrupts data when Google Sheet columns are reordered

**What goes wrong:** Already flagged in CONCERNS.md. The CSV parser in `googleSheets.ts` uses positional column indices. If the couple reorders columns in Google Sheets (common during guest list editing), names appear in description fields and table numbers are wrong — with no error thrown.

**Prevention:** Parse the header row first and map column names to indices. Validate that expected headers (`table`, `firstName`, `lastName`) are present. This prevents silent corruption.

**Phase:** Should be fixed before any caching is added — caching will preserve corrupted data across sessions if this breaks after data is cached

---

## Phase-Specific Warning Summary

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Animated zoom | iOS Safari body scroll leak (Pitfall 4) | `touch-action: none` on parent + test on real iPhone |
| Animated zoom | Zoom-to-table lands off-center due to letterbox offset (Pitfall 5) | Use `enlargedDimensions.offsetX/Y` in transform math |
| Animated zoom | GPU memory pressure from large image + will-change (Pitfall 8) | Serve WebP at mobile resolution; apply will-change transiently |
| Animated zoom | Marker position breaks on device rotation (Pitfall 10) | ResizeObserver on image element |
| Fuzzy search | Default threshold returns too many false positives (Pitfall 6) | Start at 0.3, tune against real guest list |
| Fuzzy search | No "not found" state silently fails (Pitfall 9) | Add empty-state message in same PR |
| Auto-detect | CV approach is unreliable on hand-drawn images (Pitfall 3) | Build click-to-place UI first; treat CV as enhancement |
| Auto-detect | Coordinate format (pixels vs %) breaks on image replacement (Pitfall 2) | Migrate to percentage-based coordinates before this phase |
| Offline caching | Opaque response caches broken Google Sheets fetch (Pitfall 1) | Network-first for Sheets URL or bundle guest list at build time |
| Offline caching | Stale guest list served from SW cache on event day (Pitfall 7) | skipWaiting + clientsClaim; short TTL on localStorage cache |
| Pre-caching | CSV column reorder corrupts cached data (Pitfall 11) | Fix header parsing before adding any caching layer |

---

## Sources

- MDN: [touch-action CSS property](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- MDN: [Pinch zoom gestures with Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures)
- react-zoom-pan-pinch: [GitHub issues — mobile scroll](https://github.com/BetterTyped/react-zoom-pan-pinch/issues/434)
- MDN: [Animation performance and frame rate](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)
- Workbox: [Caching resources during runtime — opaque responses](https://developer.chrome.com/docs/workbox/caching-resources-during-runtime)
- Cloud Four: [When 7 KB Equals 7 MB — opaque response storage quota](https://cloudfour.com/thinks/when-7-kb-equals-7-mb/)
- Filip Bech-Larsen: [Service worker and caching from other origins](https://filipbech.github.io/2017/02/service-worker-and-caching-from-other-origins)
- Matteo Mazzarolo: [Handling CORS and opaque responses in Service Workers](https://mmazzarolo.com/blog/2024-11-06-service-workers-and-cors/)
- Fuse.js: [Options — threshold](https://www.fusejs.io/api/options.html)
- Medium (CodeStax.Ai): [Mastering Fuzzy Search with Fuse.js](https://codestax.medium.com/mastering-fuzzy-search-with-fuse-js-a-comprehensive-guide-7c711cace162)
- Babel Street: [Fuzzy name matching — nickname limitations](https://www.babelstreet.com/blog/fuzzy-name-matching-techniques)
- vite-plugin-pwa: [Service Worker Precache Guide](https://vite-pwa-org.netlify.app/guide/service-worker-precache)
- Medium (Anton Leybov): [Handling PWA updates in React + Vite](https://medium.com/@leybov.anton/how-to-control-and-handle-last-app-updates-in-pwa-with-react-and-vite-cfb98499b500)
- GitHub Gist (Rich Harris): [Stuff I wish I'd known about service workers](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9)
- Medium (Analytics Vidhya): [Table Detection and Text Extraction — OpenCV + Tesseract](https://medium.com/analytics-vidhya/table-detection-and-text-extraction-5a2934f61caa)
