/**
 * src/setup/detect.worker.ts — Hough detection worker (Phase 5 hotfix).
 *
 * Offloads the synchronous-blocking `cv.HoughCircles` call to a dedicated
 * worker thread so the main thread stays responsive for paint + input during
 * detection. Prior to this worker, Hough on a 3300×2517 admin upload froze
 * the browser's UI thread long enough to trigger Chrome's "page unresponsive"
 * watchdog even after 5.5× pixel reduction + 2.6× stricter `param2`
 * (see commit 3f96916 trail). The compute is fundamentally expensive — the
 * fix is to keep it off the thread that paints the UI.
 *
 * Message protocol (both directions carry a matching `id` so the dispatcher
 * in detect.ts can correlate responses to requests and serve concurrent
 * calls correctly):
 *
 *   main → worker: { id: number, imageData: ImageData, opts?: HoughOpts }
 *   worker → main: { id: number, type: 'result', circles: RawCircle[] }
 *                | { id: number, type: 'error',  message: string }
 *
 * ImageData is transferred with `imageData.data.buffer` in the transfer list
 * so the main thread hands off the pixel buffer without a structured-clone
 * copy. The caller must treat the ImageData as consumed after postMessage.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 2
 * Reference: `memory/phase5_detection_hang.md` — diagnosis that motivated
 * this worker.
 */

import { detectCirclesFromImageData } from './detect.core';
import type { HoughOpts } from './types';

interface DetectRequest {
  id: number;
  imageData: ImageData;
  opts?: HoughOpts;
}

/**
 * Structural type for the worker's `self` global. We deliberately avoid
 * `DedicatedWorkerGlobalScope` (from the "WebWorker" TS lib) so we don't have
 * to widen tsconfig.json's `lib` array project-wide — the main app code
 * shouldn't see worker-only globals either.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<DetectRequest>) => void) | null;
  postMessage: (message: unknown) => void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = async (event: MessageEvent<DetectRequest>) => {
  const { id, imageData, opts } = event.data;
  try {
    const circles = await detectCirclesFromImageData(imageData, opts);
    ctx.postMessage({ id, type: 'result' as const, circles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Keep the error log on — admin console is the only diagnostic channel
    // for detection failures and the cost is zero on the happy path.
    console.error(`[detect.worker] error id=${id}: ${message}`, err);
    ctx.postMessage({ id, type: 'error' as const, message });
  }
};
