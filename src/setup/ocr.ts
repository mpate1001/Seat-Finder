/**
 * src/setup/ocr.ts — Tesseract one-shot worker for digit OCR.
 *
 * Recognizes digit-only strings from cropped circle images (D-08). Each
 * detection-pipeline run spins up a fresh Tesseract worker, restricts its
 * output alphabet to `0-9`, recognizes every crop sequentially, then
 * terminates the worker — even when a recognition throws (§Pattern 4 lifecycle).
 *
 * One-shot (not long-lived) is intentional: worker warmup is ~2-3 s on first
 * click but the admin runs detection once per upload; keeping a worker alive
 * across an entire review session is a ~100 MB idle cost for zero benefit
 * (RESEARCH §Pattern 4 "Recommendation: ONE-SHOT").
 *
 * Imported only from src/setup/pipeline.ts; no direct UI consumers.
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 4
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-08 (digit whitelist), D-09 (confidence)
 */

import { createWorker, type Worker } from 'tesseract.js';

/**
 * Upscale factor applied to every crop before Tesseract sees it. Tesseract's
 * LSTM was trained on glyphs ~150-300 px tall; table-number crops off a
 * 1200px working canvas arrive at 60-90 px total, which is too small. 3× is
 * the sweet spot — below that the LSTM misreads / returns empty, above that
 * we burn CPU for no quality gain and a 200 px crop starts to pixelate.
 */
const UPSCALE_FACTOR = 3;

/**
 * Pixel luminance threshold used by `binarize()`. Values below this become
 * pure black (ink), above become pure white (background). 160 is deliberately
 * above 128 so "dark grey" chair outlines around the table circle still pass
 * into the ink channel if they're part of the digit stroke, but get
 * suppressed if they're just faint surrounding geometry. Tune if a specific
 * floor-plan style loses readability.
 */
const BINARIZE_THRESHOLD = 160;

/**
 * Tesseract v7's ImageLike union does not include raw ImageData — it accepts
 * Blob, HTMLCanvasElement, OffscreenCanvas, HTMLImageElement, etc. We paint
 * the ImageData onto a fresh OffscreenCanvas per crop AND apply two
 * pre-processing steps that materially improve digit recognition on line-art
 * floor plans:
 *
 *   1. Upscale UPSCALE_FACTOR× via the canvas's built-in high-quality
 *      resampling. This is the single highest-ROI change vs raw
 *      `putImageData`-only; 60 px crops → 180 px crops land the digit
 *      squarely in Tesseract's trained glyph-size range.
 *   2. Grayscale + threshold binarize. Tesseract is much less distracted by
 *      the chair-fan icons around each table circle once everything is
 *      either pure black or pure white.
 */
function imageDataToCanvas(src: ImageData): OffscreenCanvas {
  const upW = src.width * UPSCALE_FACTOR;
  const upH = src.height * UPSCALE_FACTOR;

  // Intermediate canvas at source size — needed because putImageData cannot
  // be combined with a scale transform. drawImage(source, ...) on the final
  // canvas performs the actual resampling.
  const raw = new OffscreenCanvas(src.width, src.height);
  const rawCtx = raw.getContext('2d');
  if (!rawCtx) {
    throw new Error('ocr: failed to acquire 2D context for raw OffscreenCanvas');
  }
  rawCtx.putImageData(src, 0, 0);

  const canvas = new OffscreenCanvas(upW, upH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ocr: failed to acquire 2D context for OffscreenCanvas');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(raw, 0, 0, upW, upH);

  binarize(ctx, upW, upH);
  return canvas;
}

/**
 * Convert the upscaled canvas to pure black/white by luminance threshold.
 * Modifies the canvas in place. Luminance formula matches Rec. 601 —
 * accurate enough for line art and faster than Rec. 709 on tight loops.
 */
function binarize(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const v = lum < BINARIZE_THRESHOLD ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    // alpha untouched
  }
  ctx.putImageData(frame, 0, 0);
}

/**
 * One recognition result per input crop. `confidence` is the overall 0-100
 * score tesseract.js returns on `data.confidence`; for single-word digit
 * crops it's effectively the per-number score needed for the D-09 threshold.
 */
export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Recognize every entry in `imageData` sequentially and return one OcrResult
 * per input in the same order. Emits an optional progress callback after
 * each recognition so the pipeline's status line can tick forward.
 *
 * Sequential (not Promise.all): a single Tesseract worker can only process
 * one recognize() at a time, and spawning a worker-per-image balloons memory.
 * At ~50 ms per crop × 54 crops, sequential is ~3 s — acceptable for an
 * admin-triggered one-shot pipeline (RESEARCH §Pattern 4 "sequential loop").
 *
 * The worker is ALWAYS terminated in a `finally` so a thrown recognize()
 * cannot leak the WASM heap. `terminate()` is awaited so the cleanup is
 * observable (important for the no-leak test spec).
 */
export async function recognizeCircles(
  imageData: ImageData[],
  onProgress?: (done: number, total: number) => void,
): Promise<OcrResult[]> {
  // v7 createWorker signature: (langs, oem, options). We pass a no-op logger;
  // plan 05-05 will optionally surface Tesseract's status strings upstream by
  // threading a real logger here. Keeping it a no-op for plan 05-04 keeps the
  // pipeline's single onProgress(done, total) channel simple.
  const worker: Worker = await createWorker('eng', 1, {
    logger: () => {
      /* no-op; pipeline surfaces progress via the onProgress arg below */
    },
  });

  try {
    // D-08: whitelist digits so the LSTM can't hallucinate letters/punct.
    // Must fire BEFORE the first recognize() or it silently does nothing.
    //
    // PSM 8 = "treat the image as a single word". Table-number crops are
    // 1-2 digit standalones, not paragraphs — the default PSM 3 wastes time
    // running layout analysis and occasionally re-segments a crisp "42" into
    // two separate "word" hypotheses. PSM 8 short-circuits that.
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '8' as unknown as never,
    });

    const total = imageData.length;
    const results: OcrResult[] = [];
    for (let i = 0; i < total; i++) {
      const { data } = await worker.recognize(imageDataToCanvas(imageData[i]));
      results.push({
        text: (data.text ?? '').trim(),
        confidence:
          typeof data.confidence === 'number' ? data.confidence : 0,
      });
      onProgress?.(i + 1, total);
    }
    return results;
  } finally {
    // Terminate on BOTH success and error. Without this, a thrown
    // recognize() leaves the Tesseract worker alive until page unload.
    await worker.terminate();
  }
}
