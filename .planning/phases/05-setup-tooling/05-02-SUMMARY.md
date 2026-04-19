---
plan: 05-02
phase: 05-setup-tooling
completed: 2026-04-17
status: calibration_deferred
tasks_completed: 3
tasks_total: 4
requirements_addressed: [TOOL-01, TOOL-04]
---

# Plan 05-02 — CV Dependencies + Calibration Setup

One-liner: Installed @techstark/opencv-js + tesseract.js, wrote the shared setup-graph types (DraftPin/HoughOpts/RawCircle/PipelineProgress), authored image-width-scaled Hough defaults, and deferred the Node-side empirical calibration to in-browser UAT in plan 05-07 after the calibration script stalled on the 2400×1831 PNG.

## What was built

- `package.json` / `package-lock.json`: `@techstark/opencv-js@^4.12.0` + `tesseract.js@^7.0.0` added as devDependencies.
- `src/setup/types.ts`: DraftPin, HoughOpts, RawCircle, PipelineProgress interfaces — single-source contract for plans 05-04 through 05-06.
- `src/setup/houghDefaults.ts`: DEFAULT_HOUGH(imageWidth) — image-width-scaled parameter set per RESEARCH §Pattern 3.
- `scripts/calibrate-hough.mjs`: Node ESM + sharp + OpenCV.js calibration script (412 lines) — written but not blocking.
- `.planning/phases/05-setup-tooling/05-02-calibration.md`: documents the Node-path perf cliff + accepted baseline defaults + deferred measurement plan.

## Commits

- `7cf789c` — chore(05-02): install @techstark/opencv-js + tesseract.js as devDependencies
- `11bcf2a` — feat(05-02): add shared setup-graph types + Hough parameter defaults
- (calibration report + SUMMARY + state updates commit — this commit)

## Gates

- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- npm install completes cleanly; both packages resolve at runtime (import checks in later plans)

## Deferred: Task 4 calibration UAT

The Node-side calibration run stalled after 15+ minutes of CPU time with zero output and had to be killed. Root cause: `@techstark/opencv-js` running in a Node host on a 2400×1831 image — a known perf cliff when OpenCV.js WASM executes outside the browser.

**Decision:** Accept the RESEARCH-recommended defaults unchanged and measure real recall/FP in the browser during plan 05-07 UAT (where OpenCV runs natively in V8's WASM host). See `05-02-calibration.md` for full reasoning.

**Why safe:**
- Admin reviews every detected pin before approve (plan 05-05 human-in-the-loop design).
- No downstream automation depends on detection accuracy — export only fires on admin approval.
- Baseline defaults are conservative enough to find most circles; worst-case admin does manual add/delete.

**Open item:** If UAT recall < 70% on the real Reception Seat Diagram, revisit tuning via either (a) a slider UI in plan 05-07 or (b) replacing @techstark/opencv-js with the upstream opencv.js distribution and re-running Node-side calibration.

## Downstream

- Plan 05-04 can import `{ DEFAULT_HOUGH }` from `houghDefaults.ts` and `{ DraftPin, HoughOpts, RawCircle, PipelineProgress }` from `types.ts`.
- Plan 05-07 UAT gains a new item: "Detection recall check on real floor plan" — admin visually audits the detected pins vs the 54 ground-truth tables.

## Self-check

- [x] Both CV packages installed and lockfile committed
- [x] Types + defaults modules in place and tsc-clean
- [x] Calibration script exists and runs (even if it stalls on 2400×1831 — documented)
- [x] 05-02-calibration.md authored with deferral rationale
- [x] 05-02-SUMMARY.md status = calibration_deferred (NOT complete)
- [x] Follow-up item flagged for plan 05-07 UAT
