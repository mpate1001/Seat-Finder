import type { HoughOpts } from './types';

/**
 * Hough Circle Transform defaults for the Seat-Finder setup tool.
 *
 * Values were chosen from Research Pattern 3 and measured against the real
 * Reception Seat Diagram PNG in plan 05-02 (see
 * `.planning/phases/05-setup-tooling/05-02-calibration.md` for the accepted
 * numbers and the recall/FP tuning trail).
 *
 * `minDist`, `minRadius`, and `maxRadius` are PIXELS — they scale with the
 * source image width so the same defaults work for a 900px preview and the
 * 2400px master. Callers pass the actual image width (in pixels) and get a
 * ready-to-use `HoughOpts`.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 3
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pitfall 6
 */

/** Canny upper threshold — default for clean black-on-white line art. */
export const HOUGH_PARAM1 = 100;

/** Accumulator threshold — lower = more circles + more false positives.
 *  Reset to 30 (the 05-02 calibrated value) now that Hough runs in a worker
 *  at ~12-50 ms regardless. The main-thread-motivated tightening rounds
 *  (30 → 50 → 80) were compensating for a thenable-absorption bug in
 *  detect.core's getCv(), not for an actual CPU constraint. */
export const HOUGH_PARAM2 = 30;

/** `dp` (accumulator resolution) — `1` = same as image, correct for line art. */
export const HOUGH_DP = 1;

/** Fraction of image width used as `minDist` (centers closer than this merge).
 *  Reset to 0.03 — the 05-02 calibrated value. The earlier 0.03 → 0.06 bump
 *  was main-thread tuning, not a detection-quality ask. */
export const MIN_DIST_FRACTION = 0.03;

/** Fraction of image width used as `minRadius` (smallest plausible table).
 *  Reset to 0.012 — on a 1200px working canvas that's ~14 px, which matches
 *  the actual smallest table circles on a typical wedding floor plan image. */
export const MIN_RADIUS_FRACTION = 0.012;

/** Fraction of image width used as `maxRadius` (largest plausible table).
 *  Reset to 0.035 — ~42 px on a 1200px canvas, matches the largest tables. */
export const MAX_RADIUS_FRACTION = 0.035;

/**
 * Build the default Hough parameter set scaled to the supplied image width.
 *
 * Call this per-detection with `image.cols` (or `image.naturalWidth`) so the
 * pixel radii match the actual input. Downstream code converts detected
 * pixel coordinates back into DraftPin fractions (D-07).
 */
export function DEFAULT_HOUGH(imageWidth: number): HoughOpts {
  return {
    dp: HOUGH_DP,
    minDist: Math.max(1, Math.round(imageWidth * MIN_DIST_FRACTION)),
    param1: HOUGH_PARAM1,
    param2: HOUGH_PARAM2,
    minRadius: Math.max(1, Math.round(imageWidth * MIN_RADIUS_FRACTION)),
    maxRadius: Math.max(2, Math.round(imageWidth * MAX_RADIUS_FRACTION)),
  };
}
