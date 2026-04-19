---
phase: 3
slug: map-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `.planning/phases/03-map-experience/03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x + @testing-library/react + jsdom |
| **Config file** | `vitest.config.ts` (path — Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (single test file, jsdom env) |

Rationale from research: most Phase 3 correctness (pinch gestures on iOS, animation feel, browser `<picture>` format negotiation) is inherently manual-only because it requires a real iOS device or a real browser's image decoder. Automated tests cover only the two pure-logic branches that deserve them: `zoomToElement` callback wiring and the missing-table fallback.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green AND the 16-step UAT checklist must be executed on an iPhone
- **Max feedback latency:** 10 seconds (vitest full run on a small test surface)

**Sampling continuity rule:** No 3 consecutive tasks without either an automated verify command OR a Wave 0 dependency that will cover it. Manual-only tasks still have a scripted UAT step in `manual_uat` section of this file.

---

## Per-Task Verification Map

Plans do not yet exist when this file is written; the planner fills actual Task IDs during `/gsd-plan-phase`. The rows below are the expected slots — the planner maps each row to a concrete `<Phase>-<Plan>-<Task>` ID. Any new tasks the planner adds MUST extend this table.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | Wave 0 | 0 | — | — | N/A | infra | `npx vitest --version` | ❌ W0 | ⬜ pending |
| 3-W0-02 | Wave 0 | 0 | MAP-05 | — | N/A | infra | `node scripts/generate-images.mjs && ls public/floor-plan/*.avif \| wc -l` (expect ≥ 3) | ❌ W0 | ⬜ pending |
| 3-W0-03 | Wave 0 | 0 | MAP-01, fallback | — | N/A | infra | `test -f src/components/MapView.test.tsx` | ❌ W0 | ⬜ pending |
| 3-XX-XX | MapView impl | 1+ | MAP-01 | — | N/A | unit | `npx vitest run src/components/MapView.test.tsx -t "zooms to assigned table"` | ✅ W0 | ⬜ pending |
| 3-XX-XX | MapView impl | 1+ | MAP-01 | — | N/A | unit | `npx vitest run src/components/MapView.test.tsx -t "overview hold before zoom"` | ✅ W0 | ⬜ pending |
| 3-XX-XX | MapView fallback | 1+ | MAP-01 (edge) | — | N/A | unit | `npx vitest run src/components/MapView.test.tsx -t "missing tableNumber shows fallback"` | ✅ W0 | ⬜ pending |
| 3-XX-XX | MapView gestures | 1+ | MAP-02 | — | N/A | manual UAT | — (see `## Manual-Only Verifications`) | N/A | ⬜ pending |
| 3-XX-XX | Markers | 1+ | MAP-03 | — | N/A | manual UAT | — (visual: red pin vs gray dots) | N/A | ⬜ pending |
| 3-XX-XX | Markers | 1+ | MAP-03 | — | N/A | manual UAT | — (adaptive labels at ≥1.8×) | N/A | ⬜ pending |
| 3-XX-XX | iOS gesture correctness | 1+ | MAP-04 | — | N/A | manual UAT | — (no scroll bleed on iPhone Safari) | N/A | ⬜ pending |
| 3-XX-XX | `<picture>` markup | 1+ | MAP-05 | — | N/A | automated DOM check | `npx vitest run src/components/MapView.test.tsx -t "picture element has avif + webp + png sources"` | ✅ W0 | ⬜ pending |
| 3-XX-XX | Image preload | 1+ | MAP-05 | — | N/A | automated DOM check | `npx vitest run src/App.test.tsx -t "preload link injected on mount"` | ✅ W0 | ⬜ pending |
| 3-XX-XX | Image delivery | 1+ | MAP-05 | — | N/A | manual UAT | — (DevTools Network → filter `image/avif` on modern browser) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is mandatory before any implementation plan runs. Tasks:

- [ ] **Install vitest stack** — `npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom` (pins vitest 4.x, jsdom 25+)
- [ ] **Install sharp** — `npm install --save-dev sharp` (needed by `scripts/generate-images.mjs`)
- [ ] **Install react-zoom-pan-pinch** — `npm install react-zoom-pan-pinch@4.0.3` (runtime dep — pinned from research)
- [ ] **Create `vitest.config.ts`** — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`
- [ ] **Create `src/test/setup.ts`** — imports `@testing-library/jest-dom` matchers
- [ ] **Add npm scripts** — `"test": "vitest run"`, `"test:watch": "vitest"`, `"generate-images": "node scripts/generate-images.mjs"`
- [ ] **Create `scripts/generate-images.mjs`** — uses `sharp` to produce 9 variants (AVIF/WebP/PNG × 900/1600/2400 widths) from `src/assets/Reception Seat Diagram.png` into `public/floor-plan/`
- [ ] **Run `npm run generate-images`** — commits the 9 resulting files into `public/floor-plan/` so deploys don't need the script at build time
- [ ] **Create `src/components/MapView.test.tsx` stubs** — empty-describe blocks for: "zooms to assigned table", "overview hold before zoom", "missing tableNumber shows fallback", "picture element has avif + webp + png sources". Each stub uses `it.todo(...)` so CI passes until implementation lands
- [ ] **Create `src/App.test.tsx` stub** — `it.todo("preload link injected on mount")`

Wave 0 is complete when `npx vitest run` exits 0 with all `it.todo` entries showing as pending (not failures), AND `ls public/floor-plan/*.avif` prints 3 files.

---

## Manual-Only Verifications

Behaviors that cannot be automated without real iOS devices or real browser image decoders. Each one maps to a step in the UAT script at the end of this document.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pinch-to-zoom + drag-to-pan on iPhone Safari | MAP-02 | Requires real touch hardware + iOS Safari gesture engine; Appium out of scope for a wedding-scale project | UAT step 8–9: pinch in / pinch out / drag — verify no background scroll and smooth gesture |
| Assigned pin visually distinct from dots | MAP-03 | Visual judgment | UAT step 4: red teardrop pulsing on correct table; 53 others are muted slate dots |
| Neighbor labels fade in at ≥1.8× zoom | MAP-03 | CSS animation + threshold — needs real render pipeline | UAT step 7: at final zoom, neighbor table numbers become visible |
| No iOS Safari scroll-bleed during pan/pinch | MAP-04 | iOS rubber-band behavior — only reproduces on device | UAT steps 8–9: drag the map aggressively — page behind must NOT scroll; pinch-out past min scale — page must NOT rubber-band |
| No layout jump on map open/close | MAP-04 | Visual observation | UAT steps 3, 11: watch for layout shifts at open/close |
| Animated zoom smooth (not janky) on iOS | MAP-01 + MAP-04 | Subjective frame-rate judgment | UAT step 5: zoom feels smooth, not stuttery |
| Browser serves AVIF to modern devices | MAP-05 | Browser `<picture>` negotiation — can't be mocked meaningfully | UAT step 15: DevTools → Network → filter `image/avif` — confirm served |
| Smaller srcset variant loads on mobile viewport | MAP-05 | Browser `sizes`+`srcset` picker | UAT step 16: at 600px viewport, 900w variant is fetched, not 2400w |
| Floor plan text legible after AVIF compression | MAP-05 | Visual quality judgment after `sharp` quality=50 | UAT step 17: on an iPhone, zoom in on floor plan — all table numbers readable |
| Hardware back button closes map | MAP-01 (UX) | Browser history + real hardware button | UAT step 12: press back on Android/hardware or swipe-back on iOS — map closes, search returns |
| Reduced-motion path (no animation) | accessibility (UI-SPEC) | OS setting | UAT step 18: Settings → Accessibility → Reduce Motion ON → open map → verify zoom is instant, pulse disabled |

---

## UAT Scripted Flow

Primary gate before `/gsd-verify-work`. Executed on an actual iPhone running current iOS Safari. Tester reads each step and marks ✓ or ✗.

```
 1. Open app on iPhone (Safari, current iOS) — QR or direct URL
 2. Type a name → select a guest from the search dropdown
 3. ✓ Full-screen map opens with the floor plan image visible edge-to-edge
 4. ✓ Red teardrop pin is pulsing on the correct table; overlay card shows
       "Welcome, {firstName}! — Table {N}" at the top
 5. ✓ After ~250ms hold, map smoothly zooms in (~700ms) to center on the pin
 6. ✓ Final zoom shows the assigned table prominently; immediate neighbors
       are still visible for orientation
 7. ✓ At the final zoom level, the table-number labels on neighbor tables
       have faded in
 8. ACTION: Pinch to zoom in further →
    ✓ Map zooms; page behind does NOT scroll
 9. ACTION: Drag the map in any direction →
    ✓ Map pans; page behind does NOT scroll; no rubber-band bleed
10. ACTION: Double-tap a point →
    ✓ Zoom toggles between current and ~2.75×
11. ACTION: Tap the × close button →
    ✓ Map closes; search view returns with dropdown state intact
12. REPEAT steps 2–4, then press hardware/Android-back (or swipe-back on iOS) →
    ✓ Same result as tapping ×
13. REPEAT steps 2–4 on desktop, then press Escape key →
    ✓ Same result as tapping ×
14. SEARCH a guest whose tableNumber is not in floorPlan.json
       (temporary: edit JSON or use a test fixture) →
    ✓ Map opens, overview stays visible, overlay reads
       "Table {N} — please ask staff for directions"
15. OPEN DevTools → Network → filter `image/avif` → reload with cache off →
    ✓ Floor plan is served as AVIF (one of 900/1600/2400)
16. RESIZE browser to 600px wide OR use iPhone's native viewport →
    ✓ The 900w AVIF variant is the one loaded (Network panel)
17. ON AN IPHONE, open map and zoom in on the floor plan →
    ✓ All table number text remains legible (no AVIF compression
       artifacts destroying the text)
18. Settings → Accessibility → Reduce Motion ON →
       open app, select a guest →
    ✓ Zoom jumps instantly to final state with no 700ms animation
       ✓ Assigned pin pulse is disabled
19. Select a guest → WHILE map is open, search and select a DIFFERENT guest →
    ✓ Map re-runs the overview-hold-zoom-in sequence for the new pin
       (clean transition, no stuck half-zoomed state)
```

**UAT acceptance:** all 19 rows marked ✓, on at least one iPhone (current iOS Safari) and one desktop browser (Chrome or Safari). Failures trigger a new plan via `/gsd-plan-phase 3 --gaps`.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify OR an entry in `## Manual-Only Verifications` with a UAT step reference
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify or Wave 0 dependency
- [ ] Wave 0 covers all MISSING references (vitest, sharp, react-zoom-pan-pinch, image variants, test stubs)
- [ ] No watch-mode flags in any automated command (all use `vitest run`, not `vitest` alone)
- [ ] Feedback latency < 10s for the automated quick-run command
- [ ] `nyquist_compliant: true` set in frontmatter once all of the above are satisfied

**Approval:** pending
