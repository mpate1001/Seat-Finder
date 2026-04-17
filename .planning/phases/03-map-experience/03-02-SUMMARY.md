---
phase: 03-map-experience
plan: 02
subsystem: image-pipeline
tags: [image-optimization, build-script, sharp, avif, webp, png, MAP-05]

requires:
  - phase: 03-map-experience
    plan: 01
    provides: sharp@^0.34.5 devDep installed; npm script "generate-images" wired; public/ convention (Vite copies verbatim)
provides:
  - scripts/generate-images.mjs — deterministic Node ESM image pipeline (sharp), re-runnable on floor-plan source change
  - public/floor-plan/floor-plan-{900|1600|2400}.{avif|webp|png} — 9 committed static image variants addressable at runtime URL /floor-plan/floor-plan-{w}.{ext}
  - D-13 implementation (AVIF → WebP → PNG fallback assets on disk)
  - D-14 implementation (900 / 1600 / 2400 srcset widths on disk)
  - D-16 implementation (committed prebuilt variants; vite-imagetools rejected)
affects: [03-04-PLAN, 03-05-PLAN]

tech-stack:
  added: []
  patterns:
    - "Node ESM + sharp one-shot script pattern (import.meta.url → __dirname equivalent)"
    - "if/else ladder for sharp format dispatch (instead of pipeline[ext](opts)) — keeps per-format option types statically correct"
    - "existsSync + console.error + process.exit(1) guard before sharp touches the source — clearer failure than a 20-line sharp stack"
    - "mkdirSync({ recursive: true }) to materialize public/floor-plan/ on first run"

key-files:
  created:
    - scripts/generate-images.mjs
    - public/floor-plan/floor-plan-900.avif
    - public/floor-plan/floor-plan-1600.avif
    - public/floor-plan/floor-plan-2400.avif
    - public/floor-plan/floor-plan-900.webp
    - public/floor-plan/floor-plan-1600.webp
    - public/floor-plan/floor-plan-2400.webp
    - public/floor-plan/floor-plan-900.png
    - public/floor-plan/floor-plan-1600.png
    - public/floor-plan/floor-plan-2400.png
  modified: []

key-decisions:
  - "Implementation matched the plan's canonical script content verbatim — no divergence, no extra comments, no shebang, no package.json edits"
  - "Kept quality=50 (AVIF) / quality=80 (WebP) / compressionLevel=9 (PNG) from RESEARCH.md Pattern 4 — observed 900w AVIF of 27.9 KB is comfortably within the 30–80 KB target, no runtime retune needed for plan 03-02 itself (UAT step 17 remains the authoritative quality gate)"
  - "Committed all 9 artifacts to the repo per D-16; did NOT add public/floor-plan/ to .gitignore"

patterns-established:
  - "One-shot Node script lives in scripts/, not in src/ — keeps dev-time asset pipelines out of the app bundle"
  - "Deterministic image outputs enable downstream plans to hard-reference URL strings like /floor-plan/floor-plan-900.avif without a build plugin"

requirements-completed: [MAP-05]

duration: 1min
completed: 2026-04-17
---

# Phase 3 Plan 02: Floor Plan Image Pipeline Summary

**Added scripts/generate-images.mjs (Node ESM + sharp) and committed 9 prebuilt floor-plan variants (3 widths × 3 formats) to public/floor-plan/ so plan 03-04's `<picture>` element can reference /floor-plan/floor-plan-{w}.{ext} as static URLs — implements MAP-05, D-13, D-14, and D-16.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-17T13:51:49Z
- **Completed:** 2026-04-17T13:53:07Z
- **Tasks:** 2 / 2
- **Files created:** 10 (1 script + 9 image variants)
- **Files modified:** 0

## Accomplishments

- `scripts/generate-images.mjs` exists, passes `node --check` syntax validation, and matches the RESEARCH.md Pattern 4 template exactly (same widths, qualities, format dispatch).
- Running `npm run generate-images` exits 0 and emits the expected "Generated floor-plan-{w}.{ext} N.N KB" log × 9 followed by a "Done: 9 variants written to ..." line.
- All 9 image files are present, non-zero, and type-correct per `file(1)`:
  - AVIF files: `ISO Media, AVIF Image`
  - WebP files: `RIFF ... Web/P image, VP8 encoding, {w}×{h}, YUV color`
  - PNG files: `PNG image data, {w} × {h}, 8-bit/color RGB, non-interlaced`
- Format-effectiveness regression guard passes at every width: AVIF < PNG and WebP < PNG.
- Pipeline is re-runnable and deterministic: rerunning `npm run generate-images` regenerates byte-identical outputs from the unchanged source PNG.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write scripts/generate-images.mjs** — `7963d20` (chore)
2. **Task 2: Run the script and produce the 9 image variants** — `70c005c` (chore)

_Plan metadata commit will be recorded after STATE/ROADMAP updates._

## Files Created/Modified

### Created

- `scripts/generate-images.mjs` — 44-line Node ESM script. Resolves source via `fileURLToPath(import.meta.url)` → `__dirname`, aborts with `process.exit(1)` if `src/assets/Reception Seat Diagram.png` is missing, `mkdirSync(out, { recursive: true })` for `public/floor-plan/`, iterates `[900, 1600, 2400] × [avif q50 / webp q80 / png cl9]`, logs size per file, prints a final "Done: ..." line.
- `public/floor-plan/floor-plan-900.avif` — 28,545 bytes (27.9 KB) — primary mobile payload.
- `public/floor-plan/floor-plan-1600.avif` — 60,594 bytes (59.2 KB) — tablet AVIF.
- `public/floor-plan/floor-plan-2400.avif` — 91,859 bytes (89.7 KB) — desktop AVIF.
- `public/floor-plan/floor-plan-900.webp` — 37,236 bytes (36.4 KB) — mobile WebP fallback.
- `public/floor-plan/floor-plan-1600.webp` — 84,198 bytes (82.2 KB) — tablet WebP fallback.
- `public/floor-plan/floor-plan-2400.webp` — 140,214 bytes (136.9 KB) — desktop WebP fallback.
- `public/floor-plan/floor-plan-900.png` — 180,864 bytes (176.6 KB) — mobile PNG final fallback.
- `public/floor-plan/floor-plan-1600.png` — 456,351 bytes (445.7 KB) — tablet PNG final fallback.
- `public/floor-plan/floor-plan-2400.png` — 916,579 bytes (895.1 KB) — desktop PNG final fallback.

### Modified

None — plan 01 had already added the `"generate-images": "node scripts/generate-images.mjs"` npm script, so no `package.json` change was needed in this plan.

## Observed Byte Sizes (for future quality-tuning reference)

Source: `src/assets/Reception Seat Diagram.png` (1,526,658 bytes / 1.5 MB, 3300×2517).

| Width | AVIF (q=50) | WebP (q=80) | PNG (cl=9) | AVIF/PNG ratio |
|-------|-------------|-------------|------------|----------------|
| 900   | 28,545 B (27.9 KB)  | 37,236 B (36.4 KB)  | 180,864 B (176.6 KB) | 15.8% |
| 1600  | 60,594 B (59.2 KB)  | 84,198 B (82.2 KB)  | 456,351 B (445.7 KB) | 13.3% |
| 2400  | 91,859 B (89.7 KB)  | 140,214 B (136.9 KB)| 916,579 B (895.1 KB) | 10.0% |

**Notes:**
- 900w AVIF at 27.9 KB lands near the low end of the RESEARCH.md A2 prediction (30–80 KB) and well under the 150 KB "may be too conservative" threshold. No quality-tuning flag raised.
- AVIF achieves 84–90% byte reduction vs PNG — consistent with the 50–70% reduction typical for photographic content and exceeds it here because the floor plan has large flat-color regions.
- WebP achieves 79–85% byte reduction vs PNG — healthy middle tier for browsers that lack AVIF decode.
- Total `public/floor-plan/` footprint: 1,996,440 bytes ≈ 1.9 MB on disk / in repo.
- The `<picture>` element in plan 04 will serve phones the 900w AVIF (27.9 KB), an ~98% bandwidth reduction versus shipping the 1.5 MB source PNG directly.

## Decisions Made

- **Kept the quality settings from RESEARCH.md Pattern 4 as-is** (AVIF q=50 / WebP q=80 / PNG cl=9). The observed 900w AVIF of 27.9 KB is well within the A2-predicted 30–80 KB range; no need to pre-emptively retune before UAT step 17 (iPhone visual legibility check).
- **Did not add `#!/usr/bin/env node` shebang**, per plan action's explicit prohibition. The script is only ever invoked via `node scripts/generate-images.mjs` or `npm run generate-images`.
- **Did not edit `package.json`** — plan 01 already added the `generate-images` script entry; this plan is strictly scripts + artifact commits.

## Patterns Established

- **One-shot image pipeline script in `scripts/`** — kept out of the app bundle and out of the Vite build graph; Vite's `public/` directory copies the emitted variants verbatim at build time with zero transform cost.
- **Committed build artifacts for a known-static source** — one floor plan image exists for the life of the wedding; materializing its 9 variants to disk and committing them is simpler than a plugin-integrated build-time transform (and sidesteps the Vite 6 ↔ vite-imagetools v10 incompatibility entirely).
- **Static-asset URL pattern**: `/floor-plan/floor-plan-{900|1600|2400}.{avif|webp|png}` — plans 03-04 and 03-05 can reference these as string literals in `<picture>`/`<link rel=preload>` markup without a Vite module import.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Script ran cleanly on first invocation; all 9 outputs present and type-correct.

## User Setup Required

None — pipeline is entirely local and re-runnable via `npm run generate-images`.

## Next Phase Readiness

- **Plan 03-04 (FloorPlan + `<picture>` element)**: Unblocked. Three `type="image/avif"` / `type="image/webp"` / `<img>` srcset groups can hard-code the 9 URL strings; the "picture element has avif + webp + png sources" test stub from plan 03-01 is ready for a real DOM assertion against `document.querySelectorAll('picture source')`.
- **Plan 03-05 (preload hint)**: Unblocked. `<link rel=preload as=image type=image/avif imagesrcset="/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w" imagesizes="100vw">` resolves to real assets on mount.
- **Re-runnability**: If the floor plan PNG is replaced, rerunning `npm run generate-images` regenerates all 9 variants deterministically. No manual steps.

## Self-Check

- [x] `scripts/generate-images.mjs` exists (`test -f` passes)
- [x] `node --check scripts/generate-images.mjs` exits 0 (syntax valid)
- [x] `public/floor-plan/floor-plan-900.avif` exists (28,545 B)
- [x] `public/floor-plan/floor-plan-1600.avif` exists (60,594 B)
- [x] `public/floor-plan/floor-plan-2400.avif` exists (91,859 B)
- [x] `public/floor-plan/floor-plan-900.webp` exists (37,236 B)
- [x] `public/floor-plan/floor-plan-1600.webp` exists (84,198 B)
- [x] `public/floor-plan/floor-plan-2400.webp` exists (140,214 B)
- [x] `public/floor-plan/floor-plan-900.png` exists (180,864 B)
- [x] `public/floor-plan/floor-plan-1600.png` exists (456,351 B)
- [x] `public/floor-plan/floor-plan-2400.png` exists (916,579 B)
- [x] AVIF count = 3, WebP count = 3, PNG count = 3
- [x] AVIF < PNG at every width (900 / 1600 / 2400) — format-effectiveness guard passes
- [x] `file(1)` identifies each file as its claimed format (AVIF / Web/P / PNG)
- [x] All 9 artifact min_bytes thresholds satisfied per plan frontmatter
- [x] Commit `7963d20` exists in git log (Task 1)
- [x] Commit `70c005c` exists in git log (Task 2)
- [x] No unexpected deletions between Task 1 and Task 2 commits

## Self-Check: PASSED

---
*Phase: 03-map-experience*
*Completed: 2026-04-17*
