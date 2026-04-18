/**
 * src/setup/detect.core.ts — OpenCV.js Hough logic, worker-agnostic.
 *
 * Extracted from detect.ts in the Phase 5 Web-Worker-offload hotfix. All
 * WASM-bound work — OpenCV runtime init and the HoughCircles pipeline — lives
 * here so it can run inside a worker (src/setup/detect.worker.ts) OR directly
 * under vitest (no Worker construction required).
 *
 * Responsibilities:
 *  1. Lazy, memoized initialization of the `@techstark/opencv-js` WASM runtime
 *     (§Pattern 2). Module-level promise dedupes across StrictMode double-
 *     invoke, rapid admin clicks, and concurrent worker messages.
 *  2. Hough Circle detection from an ImageData input with a try/finally that
 *     delete()s every Mat on both success and error paths (§Pitfall 1 — heap
 *     leak prevention).
 *
 * The ImageData-first signature (vs the previous canvas-first one) is
 * deliberate: ImageData's underlying ArrayBuffer is transferable across the
 * worker boundary via `postMessage(..., [imageData.data.buffer])`, so the
 * main thread can hand off the pixel buffer without a structured-clone copy.
 *
 * Consumed by src/setup/detect.worker.ts (production worker path) and
 * src/setup/detect.core.test.ts (unit tests with a mocked cv namespace).
 * Must NOT be imported outside `src/setup/` — TOOL-03 bundle isolation is
 * enforced by scripts/verify-setup-split.mjs.
 */

import cvModule from '@techstark/opencv-js';
import type { HoughOpts, RawCircle } from './types';
import { DEFAULT_HOUGH } from './houghDefaults';

type CvNamespace = typeof cvModule;

/* ------------------------------------------------------------------------- */
/* getCv — memoized runtime init (§Pattern 2)                                */
/* ------------------------------------------------------------------------- */

let cvPromise: Promise<CvNamespace> | null = null;

/**
 * Returns the initialized OpenCV.js namespace, blocking on WASM runtime
 * readiness the first time it's called.
 *
 * Handles the three shapes the @techstark/opencv-js default export has been
 * observed to return across versions and build tools (§Pattern 2):
 *   (a) the default export IS a Promise that resolves to the `cv` namespace;
 *   (b) the default export is already initialized — `cv.Mat` and
 *       `cv.getBuildInformation` both exist as functions;
 *   (c) the default export is an Emscripten Module waiting for its
 *       `onRuntimeInitialized` hook to fire.
 *
 * Three races covered on the (c) path:
 *   - Race A: onRuntimeInitialized fires normally after we attach.
 *   - Race B: the runtime was ALREADY initialized when we imported the module
 *     (Emscripten can fire the callback synchronously during module load
 *     under some build configs). We poll for readiness as a backstop.
 *   - Race C: neither fires within RUNTIME_TIMEOUT_MS — surface a real error
 *     rather than hanging the UI forever.
 *
 * CRITICAL — thenable absorption: the Emscripten Module object that
 * `@techstark/opencv-js` exposes as its default export has a `.then` method
 * (MODULARIZE convention). Returning such a thenable from an async function
 * triggers Promise.resolve's thenable-absorption protocol, which re-awaits
 * `mod.then` — and once runtime init has fired, Module.then never calls its
 * callback again, so the caller's `await getCv()` hangs indefinitely. Before
 * returning we `Object.defineProperty(mod, 'then', { value: undefined })` so
 * the Promise resolution sees a plain object. This is the single reason
 * Phase 5 detection hung under UAT even after the Web-Worker offload; do NOT
 * remove the strip without understanding thenable-absorption semantics.
 */
export function getCv(): Promise<CvNamespace> {
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    const mod = cvModule as unknown;

    if (mod instanceof Promise) {
      return (await mod) as CvNamespace;
    }

    const ready = (m: unknown): boolean => {
      const cv = m as { Mat?: unknown; getBuildInformation?: unknown };
      return typeof cv.Mat === 'function' && typeof cv.getBuildInformation === 'function';
    };

    if (ready(mod)) {
      stripThenable(mod);
      return mod as CvNamespace;
    }

    const RUNTIME_TIMEOUT_MS = 20000;
    const POLL_INTERVAL_MS = 50;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (): void => {
        if (settled) return;
        settled = true;
        clearInterval(pollHandle);
        clearTimeout(timeoutHandle);
        resolve();
      };

      (mod as { onRuntimeInitialized: () => void }).onRuntimeInitialized = settle;

      const pollHandle = setInterval(() => {
        if (ready(mod)) settle();
      }, POLL_INTERVAL_MS);

      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        settled = true;
        clearInterval(pollHandle);
        reject(
          new Error(
            `OpenCV runtime init timed out after ${RUNTIME_TIMEOUT_MS}ms inside the detection worker. ` +
              'This usually means @techstark/opencv-js failed to load its WASM payload in the worker context.',
          ),
        );
      }, RUNTIME_TIMEOUT_MS);
    });

    stripThenable(mod);
    return mod as CvNamespace;
  })();

  return cvPromise;
}

/**
 * Strip the `.then` from an Emscripten Module so the Promise resolution
 * protocol doesn't re-await it as a thenable. Safe to call when `.then`
 * is already absent — the defineProperty is idempotent.
 *
 * Uses Object.defineProperty (not `delete mod.then`) because Emscripten's
 * `.then` is sometimes installed as a non-configurable property; assigning
 * `undefined` via a configurable descriptor wins on property lookup without
 * needing the original property to be configurable.
 */
function stripThenable(mod: unknown): void {
  const obj = mod as { then?: unknown };
  if (typeof obj.then === 'function') {
    Object.defineProperty(mod, 'then', { value: undefined, configurable: true });
  }
}

/* ------------------------------------------------------------------------- */
/* detectCirclesFromImageData — Hough with Mat lifecycle discipline          */
/* ------------------------------------------------------------------------- */

/**
 * Runs the Hough Circle Transform on an ImageData and returns raw circles in
 * pixel coordinates. The caller (pipeline.ts) is responsible for translating
 * these into DraftPin fractions (D-07).
 *
 * Every `cv.Mat` allocated inside this function is `.delete()`'d in a
 * `finally` block — both on success and when HoughCircles throws. This is
 * the only protection against the WASM-heap leak described in §Pitfall 1.
 * Adding a new intermediate Mat requires adding it to the `finally` block.
 *
 * When no `opts` is supplied, DEFAULT_HOUGH(imageData.width) is used so the
 * parameters scale with the input resolution (§Pattern 3, §Pitfall 4).
 */
export async function detectCirclesFromImageData(
  imageData: ImageData,
  opts?: HoughOpts,
): Promise<RawCircle[]> {
  const cv = await getCv();
  const params: HoughOpts = opts ?? DEFAULT_HOUGH(imageData.width);

  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const circles = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(5, 5),
      1.5,
      1.5,
      cv.BORDER_DEFAULT,
    );
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      params.dp,
      params.minDist,
      params.param1,
      params.param2,
      params.minRadius,
      params.maxRadius,
    );

    if (circles.cols === 0 || circles.rows === 0) {
      return [];
    }

    const out: RawCircle[] = [];
    for (let i = 0; i < circles.cols; i++) {
      out.push({
        cx: circles.data32F[i * 3],
        cy: circles.data32F[i * 3 + 1],
        r: circles.data32F[i * 3 + 2],
      });
    }
    return out;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    circles.delete();
  }
}
