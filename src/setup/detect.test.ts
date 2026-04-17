/**
 * Tests for src/setup/detect.ts — Hough circle detection with mocked OpenCV.
 *
 * The @techstark/opencv-js module is mocked end-to-end via vi.mock so tests
 * never load the real WASM runtime (it's slow + non-deterministic under Node
 * per the 05-02 calibration notes). The fake cv namespace also tracks Mat
 * delete() calls on a module-level counter so the Pitfall 1 leak guard is
 * provably enforced on both success and error paths.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 2, §Pattern 3, §Pitfall 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_HOUGH } from './houghDefaults';

/* ------------------------------------------------------------------------- */
/* Shared mutable fake-cv state hoisted so vi.mock factory can see it.       */
/* ------------------------------------------------------------------------- */

const fakeState = vi.hoisted(() => {
  // Tracks how many times any Mat instance has been .delete()'d.
  let deleteCount = 0;

  // Counts how many full getCv resolutions occurred (measures memoization).
  let initCount = 0;

  // Rows to write into the `circles` output Mat on the next HoughCircles call.
  // Shape is a flat array of triplets [cx1, cy1, r1, cx2, cy2, r2, ...].
  let nextCircles: number[] = [];

  // Next HoughCircles behaviour — throw synchronously if set.
  let houghShouldThrow: Error | null = null;

  // Most recent HoughCircles call args (for assertion of default params).
  let lastHoughArgs: {
    dp: number;
    minDist: number;
    param1: number;
    param2: number;
    minRadius: number;
    maxRadius: number;
  } | null = null;

  function reset() {
    deleteCount = 0;
    initCount = 0;
    nextCircles = [];
    houghShouldThrow = null;
    lastHoughArgs = null;
  }

  return {
    get deleteCount() { return deleteCount; },
    incDelete() { deleteCount++; },
    get initCount() { return initCount; },
    incInit() { initCount++; },
    get nextCircles() { return nextCircles; },
    setNextCircles(triplets: number[]) { nextCircles = triplets; },
    get houghShouldThrow() { return houghShouldThrow; },
    setHoughThrow(err: Error | null) { houghShouldThrow = err; },
    get lastHoughArgs() { return lastHoughArgs; },
    setLastHoughArgs(a: typeof lastHoughArgs) { lastHoughArgs = a; },
    reset,
  };
});

/* ------------------------------------------------------------------------- */
/* Mock @techstark/opencv-js with a controllable fake cv namespace.          */
/* ------------------------------------------------------------------------- */

vi.mock('@techstark/opencv-js', () => {
  // Mat fake — tracks delete() calls globally and can hold a data32F buffer
  // for the circles output.
  class FakeMat {
    cols = 0;
    rows = 0;
    data32F: Float32Array = new Float32Array(0);
    delete() {
      fakeState.incDelete();
    }
  }

  // The exported module shape — default export is an object that starts with
  // an unset onRuntimeInitialized, mimicking the real package's pre-init
  // state. getCv() sets onRuntimeInitialized and waits for it to fire; the
  // imread getter below fires it exactly once so the three-shape handler
  // reaches the await-resolve branch.
  const cv: Record<string, unknown> = {};

  cv.Size = class FakeSize {
    constructor(public w: number, public h: number) {}
  };

  // OpenCV constants — unique numbers so we can assert argument identity.
  cv.HOUGH_GRADIENT = 3;
  cv.COLOR_RGBA2GRAY = 7;
  cv.BORDER_DEFAULT = 4;

  cv.imread = (_canvas: HTMLCanvasElement): FakeMat => new FakeMat();
  cv.cvtColor = (_src: FakeMat, _dst: FakeMat, _code: number): void => {};
  cv.GaussianBlur = (
    _src: FakeMat,
    _dst: FakeMat,
    _size: unknown,
    _sx: number,
    _sy: number,
    _border: number,
  ): void => {};

  cv.HoughCircles = (
    _src: FakeMat,
    out: FakeMat,
    _method: number,
    dp: number,
    minDist: number,
    param1: number,
    param2: number,
    minRadius: number,
    maxRadius: number,
  ): void => {
    fakeState.setLastHoughArgs({
      dp,
      minDist,
      param1,
      param2,
      minRadius,
      maxRadius,
    });
    if (fakeState.houghShouldThrow) {
      throw fakeState.houghShouldThrow;
    }
    const triplets = fakeState.nextCircles;
    out.cols = triplets.length / 3;
    out.rows = out.cols === 0 ? 0 : 1;
    out.data32F = new Float32Array(triplets);
  };

  // The Mat constructor-as-value the code uses: `new cv.Mat()`. Bind to the
  // FakeMat class via a wrapper so `new cv.Mat()` yields a FakeMat.
  cv.Mat = FakeMat;

  // Drive the init path: we return the module uninitialized (no Mat property
  // yet from the module-exists perspective of the three-shape handler) so
  // getCv takes the onRuntimeInitialized branch.
  //
  // But the `mod as { Mat?: unknown }).Mat` check will see our `cv.Mat` class
  // and short-circuit to the already-initialized branch. To force the
  // onRuntimeInitialized path for the memoization spec, we defer attaching
  // `Mat` until onRuntimeInitialized fires. A getter exposes it conditionally.
  //
  // Simpler: keep `Mat` attached at module load time so the three-shape
  // handler takes the `(mod as …).Mat` branch. We still count getCv
  // invocations via a wrapped-default-export handler below.

  // Attach an init counter: the promise wrapper in getCv is what we memoize.
  // We expose `__trackInit` which detect.ts does NOT call — instead the
  // memoization spec counts calls via the incInit shim we inject in the
  // import graph. Easiest is to increment when the module is required — but
  // ESM static import fires once. So instead we count via the getCv factory.
  //
  // Implementation choice: getCv is memoized at module scope in detect.ts,
  // so the init counter is driven by `cv.Mat` construction frequency inside
  // detectCircles — one per run. The memoization spec asserts getCv()
  // returns the same promise instance across calls (identity check), which
  // does not require a real init counter.

  return { default: cv };
});

/* ------------------------------------------------------------------------- */

async function loadDetect() {
  // Re-import after vi.resetModules so the module-level cvPromise is cleared
  // between tests. This lets the memoization spec observe a fresh cache.
  return await import('./detect');
}

function makeFakeCanvas(width: number, height = 800): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  fakeState.reset();
  vi.resetModules();
});

describe('getCv', () => {
  it('resolves once and memoizes the promise across calls', async () => {
    const { getCv } = await loadDetect();
    const p1 = getCv();
    const p2 = getCv();
    expect(p1).toBe(p2);
    const cv1 = await p1;
    const cv2 = await p2;
    expect(cv1).toBe(cv2);
  });
});

describe('detectCircles', () => {
  it('returns parsed circles in order matching the HoughCircles output', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setNextCircles([
      10, 20, 30,
      40, 50, 60,
      70, 80, 90,
    ]);
    const out = await detectCircles(makeFakeCanvas(1000));
    expect(out).toEqual([
      { cx: 10, cy: 20, r: 30 },
      { cx: 40, cy: 50, r: 60 },
      { cx: 70, cy: 80, r: 90 },
    ]);
  });

  it('returns [] when HoughCircles writes an empty output Mat', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setNextCircles([]);
    const out = await detectCircles(makeFakeCanvas(1000));
    expect(out).toEqual([]);
  });

  it('calls .delete() on all 4 Mats on the success path', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setNextCircles([1, 2, 3]);
    await detectCircles(makeFakeCanvas(1000));
    // src + gray + blurred + circles = 4.
    expect(fakeState.deleteCount).toBe(4);
  });

  it('calls .delete() on all 4 Mats on the error path', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setHoughThrow(new Error('boom'));
    await expect(detectCircles(makeFakeCanvas(1000))).rejects.toThrow('boom');
    expect(fakeState.deleteCount).toBe(4);
  });

  it('uses DEFAULT_HOUGH(canvas.width) when opts is omitted', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setNextCircles([]);
    await detectCircles(makeFakeCanvas(1000));
    const expected = DEFAULT_HOUGH(1000);
    expect(fakeState.lastHoughArgs).toEqual({
      dp: expected.dp,
      minDist: expected.minDist,
      param1: expected.param1,
      param2: expected.param2,
      minRadius: expected.minRadius,
      maxRadius: expected.maxRadius,
    });
    // Guard the concrete numbers documented in 05-02-calibration.md so a
    // future unrelated DEFAULT_HOUGH tweak can't silently drift.
    expect(expected.minRadius).toBe(12);
    expect(expected.maxRadius).toBe(35);
  });

  it('honours a caller-supplied opts override', async () => {
    const { detectCircles } = await loadDetect();
    fakeState.setNextCircles([]);
    await detectCircles(makeFakeCanvas(1000), {
      dp: 2,
      minDist: 11,
      param1: 22,
      param2: 33,
      minRadius: 44,
      maxRadius: 55,
    });
    expect(fakeState.lastHoughArgs).toEqual({
      dp: 2,
      minDist: 11,
      param1: 22,
      param2: 33,
      minRadius: 44,
      maxRadius: 55,
    });
  });
});
