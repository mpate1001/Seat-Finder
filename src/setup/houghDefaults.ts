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

/** Accumulator threshold — lower = more circles + more false positives AND
 *  exponentially more main-thread CPU. Raised from 30 → 50 after UAT showed
 *  param2=30 at 1200px working-width kept the browser unresponsive for 30+
 *  seconds. At 50 the detector is stricter (may miss a few tables; admin
 *  can add them manually in the review UI — D-12) but finishes in ~1s on
 *  an 800px working canvas. */
export const HOUGH_PARAM2 = 50;

/** `dp` (accumulator resolution) — `1` = same as image, correct for line art. */
export const HOUGH_DP = 1;

/** Fraction of image width used as `minDist` (centers closer than this merge). */
export const MIN_DIST_FRACTION = 0.03;

/** Fraction of image width used as `minRadius` (smallest plausible table). */
export const MIN_RADIUS_FRACTION = 0.012;

/** Fraction of image width used as `maxRadius` (largest plausible table). */
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
