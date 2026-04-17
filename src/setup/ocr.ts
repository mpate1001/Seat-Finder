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
 * Tesseract v7's ImageLike union does not include raw ImageData — it accepts
 * Blob, HTMLCanvasElement, OffscreenCanvas, HTMLImageElement, etc. Paint the
 * ImageData onto a fresh OffscreenCanvas (1 per crop) so Tesseract has a
 * shape it can decode. Cheap: canvas is the exact crop size.
 */
function imageDataToCanvas(src: ImageData): OffscreenCanvas {
  const canvas = new OffscreenCanvas(src.width, src.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ocr: failed to acquire 2D context for OffscreenCanvas');
  }
  ctx.putImageData(src, 0, 0);
  return canvas;
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
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
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
