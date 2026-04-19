# Feature Landscape

**Domain:** Event guest seating finder / wedding wayfinding app
**Researched:** 2026-04-12
**Confidence:** HIGH (stack/search/caching) | MEDIUM (image detection feasibility)

---

## Table Stakes

Features users expect at a wedding check-in app. Missing = guests are confused, staff gets swamped.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Name search with results list | Core interaction; every comparable app (SeatYourself, DigiSeats, TableTailor) leads with this | Low | Already exists — upgrading to fuzzy |
| Table number displayed prominently | Primary answer guests need; must be visible without interaction | Low | Already exists in TableModal |
| Floor plan with highlighted table | Guests at a real venue need spatial orientation, not just a number | Medium | Already exists — upgrading animation |
| Mobile-friendly touch interaction | Most guests arrive via phone; pinch/zoom is muscle memory from Google Maps | Medium | Currently limited — no pan/pinch |
| Fast load on cellular/venue WiFi | Guests are queued up; >3s load causes staff bottleneck | Medium | Currently re-fetches every load |
| Graceful "table not found" message | Floor plan has ~50 tables; edge cases happen; guests need to know to ask staff | Low | Already exists in legend |
| Legible table markers | The pulsing red dot must be visible at full map scale on a 375px phone screen | Low | Currently a small CSS circle — needs size/contrast review |
| Works after first load if network drops | Venue WiFi is unreliable; guests should not see a blank screen if connection dies mid-event | Medium | Currently no caching at all |

---

## Differentiators

Features that make the experience noticeably better. Not expected by guests, but create a "wow" moment that reduces confusion.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated zoom-to-table (pan + zoom) | Guest is taken directly to their table on the map instead of hunting for a tiny dot — reduces "where is it?" moment | Medium | react-zoom-pan-pinch v4 (activelyh maintained, Apr 2026) has `setTransform()` and `zoomToElement()` for programmatic animation; CSS `transition` on transform works as fallback |
| Fuzzy name matching | Handles "Mahek" typed as "Maahek", nicknames, middle-name-first entries, autocorrect damage on mobile | Medium | Fuse.js is the standard choice: zero-dep, client-side, ~10KB. Threshold 0.35–0.4 is right for names (low = strict, high = noisy). Keys: `firstName`, `lastName`, full-name concatenation. useMemo the Fuse instance. |
| Stale-while-revalidate guest data cache | Guests who return to the app (rescanned QR) get instant results from localStorage, then silently refresh | Low | localStorage with a timestamp key; invalidate after 24h or on error. Guest CSV is ~50 rows — well within 5MB limit. No library needed — 20 lines of code. |
| "Your table is highlighted" label below map | Removes ambiguity about which marker is theirs when the map is small | Low | One line of copy already exists; make it more prominent |
| Auto-detect table positions from floor plan image | Eliminates manual pixel-coordinate mapping — the #1 setup pain point identified by the project | High | See detailed assessment below |

---

## Auto-Detect Table Positions: Feasibility Assessment

**Verdict: MAYBE — with significant constraints.**

This is the highest-complexity item and deserves its own section.

### What "Auto-Detect" Means Here

The user uploads a floor plan image (PNG/JPG from Canva, Figma, etc.), and the app detects where table circles/rectangles are and generates the `floorPlan.json` `tablePositions` automatically.

### Technical Approaches (ranked by feasibility for this stack)

**Option A: Canvas-based circle detection (browser-native)**
- Use HTML Canvas + pixel analysis to find circular shapes
- Works well if tables are rendered as filled circles of consistent radius
- No external API, no cost, fully offline
- Fragile: breaks if image has decorative elements, varying table shapes, or low contrast
- Complexity: High. Requires implementing a simplified Hough circle transform or contour detection in JS
- Confidence: MEDIUM — this works for clean, programmatically-generated images (Canva exports) but fails on hand-drawn or photo-scanned plans

**Option B: OpenCV.js (browser)**
- OpenCV compiled to WebAssembly runs in the browser
- Supports Hough circle transform (`HoughCircles`) natively
- ~8MB WASM bundle — acceptable for a one-time setup tool, unacceptable in the guest-facing app
- Must be a separate "admin" setup page that is never loaded by guests
- Complexity: High. OpenCV.js API is poorly documented; requires understanding dp, minDist, param1/param2 tuning for each image
- Confidence: MEDIUM

**Option C: Server-side vision API (Claude Vision, Google Vision, OpenAI)**
- Upload image to an AI vision API, prompt it to return table positions as JSON
- Very high accuracy on clean floor plan images
- Requires a backend endpoint — violates the static-site constraint, OR requires the user to supply their own API key in a setup tool
- One-time use (setup only, not at event time) — so a serverless function is acceptable
- Complexity: Medium (the API call is simple; the UX around it is the work)
- Confidence: HIGH for accuracy if image is a clean vector export

**Option D: Manual calibration UI (interactive fallback)**
- User clicks on each table in the image; the app records the coordinates
- Not "auto", but dramatically better than editing JSON by hand
- Zero fragility — works with any image style
- Complexity: Medium
- Confidence: HIGH

### Recommended Approach

Build Option D (click-to-place UI) as the primary solution because it is robust to all image styles and has no dependencies. Layer Option C (AI vision API) as an optional "auto-detect and then correct" step if an API key is available. Do NOT build Option A or B in the guest-facing bundle.

This means the "auto-detect" feature is properly scoped as an **admin setup tool** (separate route or standalone page), not part of the guest experience.

---

## Anti-Features

Features to explicitly NOT build. Each one has a plausible rationale that makes it tempting — that is why they need to be named.

| Anti-Feature | Why It Is Tempting | Why To Avoid | What To Do Instead |
|---|---|---|---|
| Real-time seat change sync | "What if the couple updates the sheet during the event?" | Guest list is finalized before the event; polling adds complexity and the 24h cache TTL is fine | Set cache TTL to 24h with manual override (hold Shift + reload) |
| Voice search ("find my seat") | Modern; reduces typing | Keyboard on mobile is fast enough; voice adds mic permissions friction and confuses guests in a noisy venue | Good fuzzy search eliminates the typing problem |
| Guest check-in tracking | "Let's know who arrived" | Requires a backend; violates static-site constraint; creates privacy concerns for guests | Use Google Sheets directly if the couple wants to track attendance |
| 3D / isometric floor plan | Looks impressive | Out of scope per PROJECT.md; adds weeks of work; the couple drew a 2D image and that is the floor plan | Pan/zoom on the existing 2D image achieves the same orientation goal |
| Multi-language support | Diverse guest list | No evidence this is needed; adds complexity | English-only is fine |
| Accessibility RSVP status in app | "Guests could confirm attendance" | Scope creep; RSVPs are done; this is a day-of tool | Keep it read-only |
| Animations on every interaction | "Polish" | Jank on low-end phones; animations on search dropdown feel slow | Animate only the map zoom (the highest-value moment); keep everything else instant |
| Push notifications | "Alert guests if table changes" | Requires service worker registration consent, a notification server, and assumes guests install the PWA | The event is one day; communicate changes via the couple |

---

## Feature Dependencies

```
Fuzzy search (Fuse.js)
  └── depends on: Guest data loaded in memory (already exists)
  └── no dependency on: Map, caching, or animation

Guest data cache (localStorage + SWR pattern)
  └── depends on: fetchGuests() service (already exists)
  └── enables: Faster repeat loads, offline resilience
  └── no dependency on: Search algorithm or map

Animated zoom-to-table
  └── depends on: react-zoom-pan-pinch installed AND floor plan image rendered
  └── depends on: Table position known (floorPlan.json)
  └── no dependency on: Fuzzy search or caching
  └── enhanced by: Larger/higher-contrast table markers

Auto-detect table positions (admin tool)
  └── depends on: A separate setup UI (new route or page)
  └── produces: Updated floorPlan.json (downloaded or copy-pasted)
  └── no dependency on: Any guest-facing feature

Floor plan readability improvements (labels, color coding)
  └── depends on: Nothing — pure CSS/rendering changes
  └── enables: Animated zoom being useful (if marker is invisible, animation doesn't help)
  └── should be done BEFORE animated zoom work

Fix table 46/47 coordinate bug
  └── depends on: Nothing — direct JSON edit
  └── blocks: Correct marker placement for those guests
  └── must be done FIRST before any map work
```

---

## MVP Recommendation for This Milestone

The milestone has four stated goals. Here is the recommended build order based on dependencies and return-on-investment:

**Build in this order:**

1. **Fix table 46/47 bug** — Zero complexity, unblocks all map work. Edit `floorPlan.json`.

2. **Fuzzy search (Fuse.js)** — Highest guest impact per hour of work. Replaces `String.includes()` with a `useMemo`'d Fuse instance. Threshold `0.4`, keys `firstName` + `lastName` + computed full name. 1–2 hours.

3. **Guest data caching (localStorage SWR)** — Second highest impact; solves both repeat-load performance and venue offline risk. 20–30 lines of code in `googleSheets.ts` + `App.tsx`. No library needed. 1–2 hours.

4. **Floor plan marker readability** — Make the marker larger and higher contrast before animating. A zoom animation that reveals a tiny dot is worse than no animation. 30 minutes.

5. **Animated zoom-to-table** — Install `react-zoom-pan-pinch`. Wrap `FloorPlan`'s image in `TransformWrapper`/`TransformComponent`. Call `setTransform()` or `zoomToElement()` when `tableNumber` prop arrives. 4–6 hours (library integration + animation tuning).

6. **Auto-detect table positions (admin tool)** — Highest complexity, lowest guest-day impact (the JSON is already complete). Build as a separate page. Start with click-to-place UI; add AI detection optionally. Defer if timeline is tight.

**Defer:**
- Auto-detect table positions if the floor plan JSON is already correct — the couple only needs to set it up once
- Environment-based config (sheet URL) — low guest impact; can be done in 15 minutes anytime

---

## Sources

- SeatYourself product (https://seatyourself.io/) — competitor UX reference (MEDIUM confidence, live product)
- DigiSeats product (https://digiseats.com/) — competitor UX reference (MEDIUM confidence, live product)
- react-zoom-pan-pinch GitHub (https://github.com/BetterTyped/react-zoom-pan-pinch) — v4.0.3, published April 2026, actively maintained (HIGH confidence)
- Fuse.js (https://www.fusejs.io/) — standard client-side fuzzy search, zero dependencies (HIGH confidence)
- Perficient blog on Fuse.js in React (https://blogs.perficient.com/2025/03/17/implementing-a-fuzzy-search-in-react-js-using-fuse-js/) — implementation pattern (MEDIUM confidence)
- vite-plugin-pwa docs (https://vite-pwa-org.netlify.app/) — Workbox integration, runtime caching for external URLs (HIGH confidence)
- Meilisearch fuzzy search guide (https://www.meilisearch.com/blog/fuzzy-search) — Levenshtein distance thresholds (MEDIUM confidence)
- Algolia search UX guide (https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design) — search UX patterns (MEDIUM confidence)
