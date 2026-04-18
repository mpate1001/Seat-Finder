/**
 * src/setup/pipeline.ts — end-to-end detection orchestration.
 *
 * Stitches together the setup-tooling primitives:
 *   ImageBitmap → (optional downscale) → canvas → detectCircles (Hough) →
 *   crop each circle to ImageData → recognizeCircles (Tesseract) →
 *   DraftPin[] with D-07 fractions + D-09 status derivation.
 *
 * This module is the single entry point plan 05-05 will wire behind the
 * "Detect circles" button inside SetupApp. No UI is imported here — the
 * pipeline is pure logic so it can be unit-tested without jsdom paint.
 *
 * Downscale cap: admin uploads can occasionally exceed 3000px on the long
 * edge (wedding-planner exports are sometimes 4K). HoughCircles + Tesseract
 * both scale O(N²) in pixels — 3000px is the memory/latency sweet spot
 * from §Pitfall 4 calibration. Images already ≤3000px are passed through
 * untouched.
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-RESEARCH.md §Code Examples "Orchestration"
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-06 (detection), D-07 (fractions), D-09 (status)
 *  - §Pitfall 4 (memory cap on large bitmaps)
 */

import { detectCircles } from './detect';
import { recognizeCircles } from './ocr';
import type { DraftPin, PipelineProgress } from './types';

/** Largest dimension (long edge, pixels) the pipeline will process. Above this
 *  the source bitmap is downscaled via createImageBitmap before detection.
 *  Raised back to 1200 now that Hough runs in a worker — at 1200×915 a single
 *  HoughCircles call takes ~50 ms in the worker and recall is much better
 *  (small tables on the source image stay detectable after downscale).
 *  Pre-worker rounds 1-3 reduced this 3000 → 1200 → 800 → 600 purely to keep
 *  main-thread Hough under Chrome's 15 s watchdog; that constraint is gone.
 *  Downstream crops are scaled back to the source bitmap's fractions at
 *  export time (D-07), so the working canvas size doesn't affect export
 *  precision. Keeping it well below the original 3000 bounds keeps peak
 *  WASM-heap usage manageable on low-end admin devices. */
const MAX_DIMENSION = 1200;

/** Yield to the browser's event loop so "Detecting..." / progress paints and
 *  the "page unresponsive" watchdog resets. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Status cutoff — OCR confidence below this flags the pin for review (D-09).
 *  Set to 40 (was 60) after UAT showed ~70% of correctly-read pins scored
 *  in the 40-60 band with the 3× upscale + binarize preprocessing pipeline.
 *  Tesseract's confidence metric runs systematically lower on binarized
 *  line-art than on natural photography, so the original 60 cutoff —
 *  reasonable for raw photographic crops — buried most correct reads in
 *  the low-confidence bucket. 40 keeps the clearly-uncertain reads
 *  (confidence < 40, typically genuinely ambiguous glyphs) flagged for
 *  human review while promoting the confident-enough reads to OK. Raise
 *  this if false-OK rate becomes a problem; lower if good reads still
 *  land in low-confidence. */
const LOW_CONFIDENCE_THRESHOLD = 40;

/**
 * Runs the complete detection pipeline on an uploaded bitmap and returns a
 * DraftPin list ready for the review UI (plan 05-05).
 *
 * Progress is emitted at every stage transition so the review UI's status
 * line can reflect "not frozen" state during the ~3s OCR phase (D-10).
 * The OCR stage additionally emits per-circle `done`/`total` ticks while
 * recognizeCircles iterates.
 *
 * Intentionally does NOT close `bitmap` — the caller (SetupApp) retains
 * ownership so it can render the source image behind the pin overlay after
 * detection completes.
 */
export async function runDetectionPipeline(
  bitmap: ImageBitmap,
  _imageFileName: string,
  onProgress: (p: PipelineProgress) => void,
): Promise<DraftPin[]> {
  onProgress({ stage: 'preparing', message: 'Preparing image...' });

  // Pitfall 4 downscale. `createImageBitmap` with resizeWidth keeps aspect
  // ratio automatically (the height is picked so the long edge becomes
  // resizeWidth). We pass the ORIGINAL bitmap as source — browsers accept
  // an ImageBitmap as a CanvasImageSource for createImageBitmap.
  let work = bitmap;
  if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
    work = await createImageBitmap(bitmap, {
      resizeWidth: MAX_DIMENSION,
      resizeQuality: 'high',
    });
  }

  // Paint onto a fresh 2D canvas so detectCircles + getImageData (for crops)
  // share the same pixel buffer.
  const canvas = document.createElement('canvas');
  canvas.width = work.width;
  canvas.height = work.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('pipeline: failed to acquire 2D canvas context');
  }
  ctx.drawImage(work, 0, 0);

  onProgress({ stage: 'scanning', message: 'Scanning for circles...' });
  // Yield before Hough so the "Scanning..." message actually paints before
  // the CV call blocks the main thread. Without this the first frame the
  // admin sees after clicking Detect is whatever was on screen pre-click.
  await yieldToUi();
  const circles = await detectCircles(canvas);

  onProgress({ stage: 'cropping', message: 'Cropping circles...' });
  await yieldToUi();
  const crops: ImageData[] = circles.map((c) => {
    // Clamp the crop rect inside the canvas so a circle near the edge does
    // not cause getImageData to throw (x/y < 0 or x+side > width).
    const x = Math.max(0, Math.floor(c.cx - c.r));
    const y = Math.max(0, Math.floor(c.cy - c.r));
    const rawSide = Math.ceil(c.r * 2);
    const side = Math.max(
      1,
      Math.min(rawSide, work.width - x, work.height - y),
    );
    return ctx.getImageData(x, y, side, side);
  });

  onProgress({
    stage: 'ocr',
    message: 'Reading circle numbers...',
    done: 0,
    total: crops.length,
  });

  const ocr = await recognizeCircles(crops, (done, total) => {
    onProgress({
      stage: 'ocr',
      message: 'Reading circle numbers...',
      done,
      total,
    });
  });

  // Map raw-pixel circles + OCR readouts to DraftPin[] in a single pass.
  // D-07: x / y / detectedRadius stored as fractions of the working bitmap,
  // NOT pixels. D-09: status is derived from (digits present, confidence).
  const pins: DraftPin[] = circles.map((c, i) => {
    // Belt + suspenders vs a Tesseract whitelist leak — strip any stray
    // non-digit characters. If nothing remains, mark as needs-number.
    const digits = (ocr[i]?.text ?? '').replace(/[^0-9]/g, '');
    const tableNumber = digits.length > 0 ? digits : null;
    const confidence = ocr[i]?.confidence ?? 0;
    const status: DraftPin['status'] =
      tableNumber === null
        ? 'needs-number'
        : confidence < LOW_CONFIDENCE_THRESHOLD
          ? 'low-confidence'
          : 'ok';
    return {
      id: crypto.randomUUID(),
      x: c.cx / work.width,
      y: c.cy / work.height,
      detectedRadius: c.r / work.width,
      tableNumber,
      confidence,
      status,
    };
  });

  onProgress({ stage: 'done', message: 'Done' });
  return pins;
}
