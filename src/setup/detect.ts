/**
 * src/setup/detect.ts — Hough detection dispatcher (Phase 5 Web-Worker hotfix).
 *
 * Thin main-thread layer that posts pixel data to `detect.worker.ts` and
 * resolves with the resulting `RawCircle[]`. All WASM-bound Hough logic lives
 * in `./detect.core` so the worker can reuse it without pulling in DOM types
 * and so vitest can cover the algorithm path without constructing a real
 * Worker.
 *
 * Why this layering: `cv.HoughCircles` is a synchronous WASM call. Running it
 * on the main thread blocks paint + input for the full detection duration —
 * on a 3300×2517 admin upload this tripped Chrome's "page unresponsive"
 * watchdog even after 5.5× pixel reduction + stricter params (commit trail
 * bc23627 → a4e0844 → 3f96916). Moving the call into a worker restores UI
 * responsiveness regardless of compute time. Parameters and MAX_DIMENSION in
 * pipeline.ts are unchanged in this hotfix — the fix is purely transport.
 *
 * CRITICAL: this module must NEVER import `@techstark/opencv-js` — directly
 * OR transitively through `./detect.core`. `@techstark/opencv-js` is ~10 MB
 * of compiled JS whose top-level code sets up the Emscripten runtime. If the
 * main-thread bundle evaluates it, the browser freezes for 10+ seconds at
 * SetupApp mount time. Round 1 of this hotfix (commit history TBD) left a
 * `export { getCv } from './detect.core'` re-export here for a convenience
 * that no production code ever consumed; Vite pulled OpenCV into the
 * SetupApp chunk anyway and the UI still froze. Removing the re-export made
 * detect.core a worker-only module. Do NOT reintroduce any value import
 * from './detect.core' — type-only imports are fine because TypeScript
 * strips them at build time, but Vite's graph analysis still inspects token
 * strings, so keep detect.core entirely out of this file when possible.
 *
 * Public surface:
 *   - `detectCircles(canvas, opts?)` — unchanged signature so pipeline.ts
 *     needs no edits. Internally reads the canvas's pixels into an ImageData,
 *     transfers the backing ArrayBuffer to the worker, and returns a Promise
 *     that resolves when the worker posts back.
 *
 * Message protocol: see `./detect.worker.ts`.
 */

import type { HoughOpts, RawCircle } from './types';

/* ------------------------------------------------------------------------- */
/* Worker lifecycle                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Worker-response union. Discriminated by `type` so the dispatcher can map
 * success/failure into a Promise.resolve / reject without stringly-typed
 * branching.
 */
type DetectResponse =
  | { id: number; type: 'result'; circles: RawCircle[] }
  | { id: number; type: 'error'; message: string };

/**
 * Memoized worker singleton. The Hough worker loads the OpenCV WASM runtime
 * on first message (~300 ms cold-start); reusing the same worker across
 * detection runs keeps every subsequent Detect click cheap. React StrictMode
 * double-mount and rapid admin clicks all resolve to the same worker.
 *
 * Exported `__resetWorkerForTests` below clears the cache for vitest isolation.
 */
let workerInstance: Worker | null = null;

/**
 * Monotonic request counter. Each detectCircles call gets a unique id that
 * threads through main → worker → main so concurrent calls cannot cross
 * their responses. We never wrap — detection throughput tops out at maybe a
 * handful of calls per admin session, so `number` is abundant.
 */
let nextRequestId = 0;

function getWorker(): Worker {
  if (workerInstance !== null) return workerInstance;
  workerInstance = new Worker(
    new URL('./detect.worker.ts', import.meta.url),
    { type: 'module' },
  );
  return workerInstance;
}

/**
 * Test-only hook: drops the memoized worker so a fresh stub can be installed
 * between specs. Not exported from `./index.ts` and not reachable from any
 * production caller — intentionally underscore-prefixed to advertise intent.
 */
export function __resetWorkerForTests(): void {
  workerInstance = null;
  nextRequestId = 0;
}

/* ------------------------------------------------------------------------- */
/* detectCircles — canvas → ImageData → worker → RawCircle[]                 */
/* ------------------------------------------------------------------------- */

/**
 * Runs Hough Circle Transform on the pixels of `canvas` and returns the
 * detected circles. Heavy lifting happens inside the detect worker; this
 * function just marshals ImageData across the worker boundary.
 *
 * The canvas itself is NOT transferred — only the ImageData's underlying
 * `Uint8ClampedArray.buffer` is listed in the transfer list. The caller's
 * canvas remains paintable; the ImageData object we pulled from it becomes
 * detached after postMessage, which is fine because we don't touch it again.
 */
export async function detectCircles(
  canvas: HTMLCanvasElement,
  opts?: HoughOpts,
): Promise<RawCircle[]> {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('detect: failed to acquire 2D canvas context');
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const worker = getWorker();
  const id = ++nextRequestId;

  return new Promise<RawCircle[]>((resolve, reject) => {
    function handleMessage(event: MessageEvent<DetectResponse>): void {
      const data = event.data;
      // Messages for other in-flight requests share the same worker —
      // ignore anything with a mismatched id. The listener is only removed
      // after we see our own id, so other listeners still get their copy.
      if (data.id !== id) return;
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.removeEventListener('messageerror', handleMessageError);
      if (data.type === 'result') {
        resolve(data.circles);
      } else {
        reject(new Error(data.message));
      }
    }

    function handleError(event: ErrorEvent): void {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.removeEventListener('messageerror', handleMessageError);
      reject(new Error(event.message || 'detect worker crashed'));
    }

    function handleMessageError(): void {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.removeEventListener('messageerror', handleMessageError);
      reject(new Error('detect worker: failed to deserialize message'));
    }

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.addEventListener('messageerror', handleMessageError);

    worker.postMessage(
      { id, imageData, opts },
      [imageData.data.buffer],
    );
  });
}
