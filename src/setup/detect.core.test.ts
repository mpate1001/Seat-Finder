/**
 * Tests for src/setup/detect.core.ts — Hough circle detection with mocked
 * OpenCV. Retargeted from the pre-worker `detect.test.ts` so the same Mat-
 * disposal and default-params guarantees survive the Web-Worker split.
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
  let deleteCount = 0;
  let nextCircles: number[] = [];
  let houghShouldThrow: Error | null = null;
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
    nextCircles = [];
    houghShouldThrow = null;
    lastHoughArgs = null;
  }

  return {
    get deleteCount() { return deleteCount; },
    incDelete() { deleteCount++; },
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
  class FakeMat {
    cols = 0;
    rows = 0;
    data32F: Float32Array = new Float32Array(0);
    delete() {
      fakeState.incDelete();
    }
  }

  const cv: Record<string, unknown> = {};

  cv.Size = class FakeSize {
    constructor(public w: number, public h: number) {}
  };

  cv.HOUGH_GRADIENT = 3;
  cv.COLOR_RGBA2GRAY = 7;
  cv.BORDER_DEFAULT = 4;

  // detect.core.ts uses matFromImageData (post-worker-split) instead of
  // imread — the worker doesn't have a DOM Canvas, only the ImageData that
  // the main-thread dispatcher transferred to it.
  cv.matFromImageData = (_imageData: ImageData): FakeMat => new FakeMat();
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

  cv.Mat = FakeMat;

  // getCv's readiness check requires both Mat (function) AND
  // getBuildInformation (function) to prove the runtime is initialized, not
  // just present as an Emscripten cwrap stub.
  cv.getBuildInformation = () => 'fake cv build info';

  // Simulate Emscripten's MODULARIZE `.then` method on the Module export.
  // The real @techstark/opencv-js exposes this; it is the thenable that
  // triggers Promise-resolution absorption and hung detection until
  // commit 7dcc253. getCv must strip it before resolving so the outer
  // `await` returns cleanly — the spec below asserts that it does.
  cv.then = () => {
    /* Emscripten-style thenable — never actually called in this mock. */
  };

  return { default: cv };
});

/* ------------------------------------------------------------------------- */

async function loadDetectCore() {
  // Re-import after vi.resetModules so the module-level cvPromise is cleared
  // between tests — lets the memoization spec observe a fresh cache.
  return await import('./detect.core');
}

function makeFakeImageData(width: number, height = 800): ImageData {
  return {
    width,
    height,
    // A real Uint8ClampedArray so `.buffer` is transferable in the worker-
    // dispatch tests. For the core tests we never read the pixels.
    data: new Uint8ClampedArray(width * height * 4),
  } as ImageData;
}

beforeEach(() => {
  fakeState.reset();
  vi.resetModules();
});

describe('getCv', () => {
  it('resolves once and memoizes the promise across calls', async () => {
    const { getCv } = await loadDetectCore();
    const p1 = getCv();
    const p2 = getCv();
    expect(p1).toBe(p2);
    const cv1 = await p1;
    const cv2 = await p2;
    expect(cv1).toBe(cv2);
  });

  it('strips the Emscripten thenable `.then` from the resolved cv namespace', async () => {
    // REGRESSION GUARD: @techstark/opencv-js ships its Module object as the
    // default export with a MODULARIZE `.then` method. When returned from an
    // async function, Promise resolution treats it as a thenable and re-awaits
    // `mod.then` — but Module.then never calls its callback after
    // onRuntimeInitialized has already fired, so the caller's `await getCv()`
    // hangs forever. Fixed in commit 7dcc253 by stripping `.then` before
    // returning. This spec pins that contract: if a future upgrade of the
    // opencv package moves or renames the thenable, we want the test suite
    // to surface the drift before it re-enters UAT.
    //
    // Install `.then` explicitly here — `vi.mock` factories cache their
    // returned object across `vi.resetModules()`, so a prior test that
    // exercised getCv has already stripped the mock's `.then`. Re-installing
    // via defineProperty keeps the test order-independent.
    const cvModuleImport = await import('@techstark/opencv-js');
    const mod = cvModuleImport.default as unknown as { then?: unknown };
    Object.defineProperty(mod, 'then', {
      value: () => {
        /* Emscripten-style thenable — never invoked; existence alone triggers
           Promise-resolution absorption if not stripped. */
      },
      configurable: true,
    });
    expect(typeof mod.then).toBe('function');

    const { getCv } = await loadDetectCore();
    const cv = await getCv();

    const cvAsThenable = cv as unknown as { then?: unknown };
    expect(cvAsThenable.then).toBeUndefined();
  });
});

describe('detectCirclesFromImageData', () => {
  it('returns parsed circles in order matching the HoughCircles output', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setNextCircles([
      10, 20, 30,
      40, 50, 60,
      70, 80, 90,
    ]);
    const out = await detectCirclesFromImageData(makeFakeImageData(1000));
    expect(out).toEqual([
      { cx: 10, cy: 20, r: 30 },
      { cx: 40, cy: 50, r: 60 },
      { cx: 70, cy: 80, r: 90 },
    ]);
  });

  it('returns [] when HoughCircles writes an empty output Mat', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setNextCircles([]);
    const out = await detectCirclesFromImageData(makeFakeImageData(1000));
    expect(out).toEqual([]);
  });

  it('calls .delete() on all 4 Mats on the success path', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setNextCircles([1, 2, 3]);
    await detectCirclesFromImageData(makeFakeImageData(1000));
    // src + gray + blurred + circles = 4.
    expect(fakeState.deleteCount).toBe(4);
  });

  it('calls .delete() on all 4 Mats on the error path', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setHoughThrow(new Error('boom'));
    await expect(
      detectCirclesFromImageData(makeFakeImageData(1000)),
    ).rejects.toThrow('boom');
    expect(fakeState.deleteCount).toBe(4);
  });

  it('uses DEFAULT_HOUGH(imageData.width) when opts is omitted', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setNextCircles([]);
    await detectCirclesFromImageData(makeFakeImageData(1000));
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
    // future unrelated DEFAULT_HOUGH tweak can't silently drift. Values
    // restored to the original calibrated fractions (0.012 / 0.035) after
    // the main-thread-hang tightening rounds were obsoleted by the
    // Phase 5 Web-Worker hotfix.
    expect(expected.minRadius).toBe(12);
    expect(expected.maxRadius).toBe(35);
  });

  it('honours a caller-supplied opts override', async () => {
    const { detectCirclesFromImageData } = await loadDetectCore();
    fakeState.setNextCircles([]);
    await detectCirclesFromImageData(makeFakeImageData(1000), {
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
