/**
 * src/setup/detect.ts — OpenCV.js Hough circle detection.
 *
 * Responsibilities (Phase 5 Plan 05-04):
 *  1. Lazy, memoized initialization of the `@techstark/opencv-js` WASM runtime
 *     (§Pattern 2). The module-level promise dedupes across React StrictMode
 *     double-invoke and rapid admin clicks (§Pitfall 3).
 *  2. Hough Circle detection with a try/finally that delete()s every Mat on
 *     both the success and error paths (§Pitfall 1 — heap leak prevention).
 *
 * Consumed by src/setup/pipeline.ts. Must NOT be imported from any file
 * outside `src/setup/` so TOOL-03 bundle isolation stays intact (enforced by
 * the grep gate from plan 05-07).
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 2, §Pattern 3, §Pitfall 1
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-05, D-06
 *  - .planning/phases/05-setup-tooling/05-02-calibration.md (accepted DEFAULT_HOUGH baseline)
 */

import cvModule from '@techstark/opencv-js';
import type { HoughOpts, RawCircle } from './types';
import { DEFAULT_HOUGH } from './houghDefaults';

/**
 * The shape of the default-exported `cv` namespace. Typed via the module's
 * own default-export type so imread/Mat/HoughCircles/etc. are discoverable
 * without re-declaring the surface.
 */
type CvNamespace = typeof cvModule;

/* ------------------------------------------------------------------------- */
/* getCv — memoized runtime init                                             */
/* ------------------------------------------------------------------------- */

/**
 * Module-level singleton guarding concurrent initialization. Declared at
 * module scope (NOT inside a React hook) so a StrictMode double-mount, two
 * rapid admin clicks, or a queued microtask all resolve to the same promise
 * instead of spawning parallel WASM inits (§Pitfall 3).
 */
let cvPromise: Promise<CvNamespace> | null = null;

/**
 * Returns the initialized OpenCV.js namespace, blocking on WASM runtime
 * readiness the first time it's called.
 *
 * Handles all three shapes the @techstark/opencv-js default export has been
 * observed to return across versions and build tools (§Pattern 2):
 *   (a) the default export IS a Promise that resolves to the `cv` namespace;
 *   (b) the default export is already initialized — `.Mat` is a class;
 *   (c) the default export is an object waiting for its
 *       `onRuntimeInitialized` hook to fire.
 */
export function getCv(): Promise<CvNamespace> {
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    const mod = cvModule as unknown;

    // Shape (a): some builds return a Promise from the default export.
    if (mod instanceof Promise) {
      return (await mod) as CvNamespace;
    }

    // Shape (b): runtime already initialized (e.g. shared across modules).
    if ((mod as { Mat?: unknown }).Mat) {
      return mod as CvNamespace;
    }

    // Shape (c): arm the onRuntimeInitialized callback and wait.
    await new Promise<void>((resolve) => {
      (mod as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
    });
    return mod as CvNamespace;
  })();

  return cvPromise;
}

/* ------------------------------------------------------------------------- */
/* detectCircles — Hough Circle Transform with Mat lifecycle discipline      */
/* ------------------------------------------------------------------------- */

/**
 * Runs the Hough Circle Transform on a canvas and returns the raw circles in
 * pixel coordinates. The caller (pipeline.ts) is responsible for translating
 * these into DraftPin fractions (D-07).
 *
 * Every `cv.Mat` allocated inside this function is .delete()'d in a `finally`
 * block — both on success and when HoughCircles throws. This is the only
 * protection against the WASM-heap leak described in §Pitfall 1. Adding a
 * new intermediate Mat requires adding it to the `finally` block.
 *
 * When no `opts` is supplied, DEFAULT_HOUGH(canvas.width) is used so the
 * parameters scale with the uploaded image's resolution (§Pattern 3, §Pitfall 4).
 */
export async function detectCircles(
  canvas: HTMLCanvasElement,
  opts?: HoughOpts,
): Promise<RawCircle[]> {
  const cv = await getCv();
  const params: HoughOpts = opts ?? DEFAULT_HOUGH(canvas.width);

  const src = cv.imread(canvas);
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

    // HoughCircles packs results as [cx, cy, r] triplets along a single row.
    // An empty detection leaves circles.cols === 0 OR circles.rows === 0 —
    // both shapes mean "no circles found" and must return []. Do NOT throw.
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
    // All four Mats must be deleted even on error (§Pitfall 1 — each unfreed
    // Mat keeps ~several MB of WASM memory alive across runs).
    src.delete();
    gray.delete();
    blurred.delete();
    circles.delete();
  }
}
