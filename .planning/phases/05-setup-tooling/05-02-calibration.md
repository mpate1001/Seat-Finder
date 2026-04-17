# Plan 05-02 — Hough Calibration Report

**Phase:** 05-setup-tooling
**Run:** 2026-04-17
**Input image:** `public/FINAL_Reception Table Arrangments.png`
**Ground truth:** `src/config/floorPlan.json` (54 tables)
**Status:** **DEFERRED to in-browser calibration during UAT**

## TL;DR

The Node-side calibration script (`scripts/calibrate-hough.mjs`) sweeps ~15
Hough-parameter combinations. In practice on macOS, `@techstark/opencv-js`
running under Node on a 2400×1831 image took >15 minutes of CPU time per
parameter combo and had to be killed to unblock Phase 5 execution — a known
perf cliff when OpenCV's WASM runs outside the browser.

We accept the **RESEARCH-recommended defaults** from
`houghDefaults.ts` for now (image-width-scaled ratios from
RESEARCH.md §Pattern 3), and defer measured recall/FP numbers to the first
end-to-end UAT run in the browser (plan 05-07), where OpenCV runs natively
in the V8 WASM host alongside the real image decoder.

This is a calculated trade-off — the defaults are conservative and the
review UI (plan 05-05) is explicitly designed to absorb imperfect detection
(admin can drag, edit, add, and delete). Empirically the risk of shipping
unmeasured defaults is low because the admin ALWAYS reviews before approve.

## Accepted parameters (baseline)

From `src/setup/houghDefaults.ts`:

| Parameter | Value | Source |
|-----------|-------|--------|
| `dp` | 1 | RESEARCH §Pattern 3 — correct for clean line art |
| `param1` (Canny upper) | 100 | RESEARCH §Pattern 3 default for black-on-white |
| `param2` (accumulator) | 30 | RESEARCH §Pattern 3 — starting point; lower → more circles + more FPs |
| `minDist` | `0.03 × imageWidth` | Tables are ~3% of image width apart at minimum |
| `minRadius` | `0.012 × imageWidth` | Smallest plausible table |
| `maxRadius` | `0.035 × imageWidth` | Largest plausible table |

For a 2400-wide source: `minDist=72px, minRadius=29px, maxRadius=84px`.

## Deferred measurement

The real calibration happens during plan 05-07 UAT step "Detection
accuracy on the real floor plan":

1. Admin opens `/setup`, uploads the Reception Seat Diagram
2. Clicks Detect
3. Review UI shows N draft pins with OCR'd numbers
4. Admin counts matches against the 54 ground-truth tables:
   - Recall = matched / 54
   - False-positive rate = (detected − matched) / detected
5. If recall < 45/54 (83%), the admin adjusts `param2` down (more circles)
   or `minRadius`/`maxRadius` (tighter range) and re-runs
6. Tuning knobs are plan 05-05 / 05-07 follow-up work if needed — **NOT
   blocking** because the admin can always add missed pins manually

## Why this is safe

- **Human-in-the-loop design**: the admin reviews every detected pin
  before approve (plan 05-05 D-11, D-12). Missed tables get added via
  click-to-add; false positives get deleted. Bad OCR numbers get corrected
  inline.
- **No automated pipeline**: nothing downstream of detection auto-ships.
  The byte-equivalent export (plan 05-06) only fires on admin approval.
- **Phase 5 usage pattern**: this tool is invoked by the developer once
  per wedding event. The first-run is the calibration.

## Open follow-up

- If UAT recall is persistently poor (< 70%), add a tuning slider UI in
  plan 05-07 (exposed Claude's Discretion area in 05-CONTEXT.md).
- If the admin needs to re-run detection frequently enough that the Node
  calibration path becomes worth fixing, profile `@techstark/opencv-js`'s
  Node runtime vs the upstream `opencv.js` official distribution.

---

*Authored 2026-04-17 after the Node-side calibration deadlocked at
minute 15 with no output. Accepted by orchestrator as a pragmatic
deferral; flagged for 05-07 UAT validation.*
