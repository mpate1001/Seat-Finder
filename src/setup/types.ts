/**
 * Shared setup-graph types (Phase 5 Plan 05-02).
 *
 * Plans 05-04 (detection pipeline) and 05-05 (review UI) import from this
 * module. Keep it pure — no runtime imports of `@techstark/opencv-js` or
 * `tesseract.js`. This file is referenced by both the browser setup chunk
 * and the Node calibration script, so any runtime dependency here would
 * leak into the guest bundle or break Node execution.
 *
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md (D-06..D-11)
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 3
 */

/**
 * A single draft pin rendered in the review UI (D-06, D-07, D-09).
 *
 * Coordinates are stored as fractions of the source image's width/height —
 * NOT pixels. This matches the existing `src/config/floorPlan.json` shape
 * and keeps detection output resolution-independent (D-07).
 */
export interface DraftPin {
  /** Stable identity for React keys + edit operations — `crypto.randomUUID()` at creation. */
  id: string;
  /** 0..1 fraction of image width (D-07). */
  x: number;
  /** 0..1 fraction of image height (D-07). */
  y: number;
  /** 0..1 fraction of image width — kept for review-UI pin sizing and debug overlays (D-06). */
  detectedRadius: number;
  /** The digit-string read by OCR, or `null` when OCR returned no digits (D-09 placeholder case). */
  tableNumber: string | null;
  /** Tesseract overall confidence 0..100 (D-09). */
  confidence: number;
  /**
   * Review-UI state (D-11):
   * - `'ok'`              → OCR confidence ≥ 60 and a numeric tableNumber was read.
   * - `'low-confidence'`  → OCR returned a number but confidence < 60 (warning badge).
   * - `'needs-number'`    → OCR returned no digits; admin must assign the number.
   */
  status: 'ok' | 'low-confidence' | 'needs-number';
}

/**
 * Hough Circle Transform parameters passed to `cv.HoughCircles`.
 *
 * Values are PIXELS (not fractions) because they feed the OpenCV API
 * directly. Plans that build a DraftPin convert back to fractions at the
 * call site (D-07). Defaults live in `./houghDefaults.ts`.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 3
 */
export interface HoughOpts {
  /** Accumulator resolution relative to image size. `1` for clean line art. */
  dp: number;
  /** Minimum distance between detected centers, in PIXELS. Tables closer than this get merged. */
  minDist: number;
  /** Canny edge detector's upper threshold. `100` is the documented default for line-art. */
  param1: number;
  /** Accumulator threshold. Lower = more circles (and more false positives). */
  param2: number;
  /** Minimum circle radius, in PIXELS. Below this = decorative dots / noise. */
  minRadius: number;
  /** Maximum circle radius, in PIXELS. Above this = room outlines / dance floor. */
  maxRadius: number;
}

/**
 * Raw Hough output before OCR or post-processing.
 *
 * One entry per detected circle, in PIXEL coordinates. Detection code
 * normalises these to DraftPin fractions at the module boundary.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 3
 */
export interface RawCircle {
  cx: number;
  cy: number;
  r: number;
}

/**
 * The stages the detection pipeline progresses through. Consumed by the
 * review UI's status line (D-10 — "not frozen" feedback during long runs).
 */
export type PipelineStage =
  | 'preparing'
  | 'scanning'
  | 'cropping'
  | 'ocr'
  | 'done'
  | 'error';

/**
 * Progress event emitted from the detection pipeline to the UI.
 *
 * `done` / `total` are optional because early stages (preparing, scanning)
 * don't have meaningful counts; the OCR stage fills them in once the circle
 * list is known.
 */
export interface PipelineProgress {
  stage: PipelineStage;
  message: string;
  done?: number;
  total?: number;
}
