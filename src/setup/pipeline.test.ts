/**
 * Tests for src/setup/pipeline.ts — runDetectionPipeline orchestration.
 *
 * Both lower modules are mocked:
 *   - ./detect   → detectCircles returns a controllable fixture circle list
 *   - ./ocr      → recognizeCircles returns a controllable fixture result list
 *     and forwards progress ticks to the pipeline's onProgress shim.
 *
 * The input ImageBitmap is a synthetic jsdom-friendly shape — the real
 * browser type cannot be constructed in jsdom, and the production pipeline
 * only reads `.width`, `.height`, and passes it to `drawImage`. Since we
 * never run real detection here, a width/height-only object is enough.
 *
 * Specs verify:
 *  - Progress sequence (preparing → scanning → cropping → ocr → done)
 *  - Pixel→fraction mapping (D-07)
 *  - D-09 status derivation on all three branches (ok / low-confidence /
 *    needs-number)
 *  - OCR progress forwarding (done/total)
 *  - Pitfall 4 large-image downscale path
 *  - Negative-crop-x guard inside the crop loop
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Code Examples
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-06, D-07, D-09
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawCircle } from './types';
import type { OcrResult } from './ocr';

/* ------------------------------------------------------------------------- */
/* Shared mutable pipeline-fixture state (vi.hoisted so mocks see it).       */
/* ------------------------------------------------------------------------- */

const pipelineState = vi.hoisted(() => {
  let circles: RawCircle[] = [];
  let ocrResults: OcrResult[] = [];
  // Whether recognizeCircles should forward a synthetic progress tick per
  // crop BEFORE returning its fixture results. Off by default so most tests
  // only assert the final DraftPin shape.
  let emitOcrProgress = false;

  // Capture the getImageData call list so the crop-guard test can assert
  // (x, y, side, side) coercion to non-negative values.
  const getImageDataCalls: Array<[number, number, number, number]> = [];

  function reset() {
    circles = [];
    ocrResults = [];
    emitOcrProgress = false;
    getImageDataCalls.length = 0;
  }

  return {
    get circles() { return circles; },
    setCircles(list: RawCircle[]) { circles = list; },
    get ocrResults() { return ocrResults; },
    setOcrResults(list: OcrResult[]) { ocrResults = list; },
    get emitOcrProgress() { return emitOcrProgress; },
    setEmitOcrProgress(v: boolean) { emitOcrProgress = v; },
    get getImageDataCalls() { return getImageDataCalls; },
    pushGetImageDataCall(call: [number, number, number, number]) {
      getImageDataCalls.push(call);
    },
    reset,
  };
});

/* ------------------------------------------------------------------------- */
/* Mock the two lower modules.                                               */
/* ------------------------------------------------------------------------- */

vi.mock('./detect', () => ({
  detectCircles: vi.fn(async () => pipelineState.circles),
  getCv: vi.fn(async () => ({})),
}));

vi.mock('./ocr', () => ({
  recognizeCircles: vi.fn(
    async (
      crops: ImageData[],
      onProgress?: (done: number, total: number) => void,
    ) => {
      if (pipelineState.emitOcrProgress && onProgress) {
        for (let i = 0; i < crops.length; i++) {
          onProgress(i + 1, crops.length);
        }
      }
      return pipelineState.ocrResults;
    },
  ),
}));

/* ------------------------------------------------------------------------- */
/* Test-side helpers: synthetic ImageBitmap and canvas spies.                */
/* ------------------------------------------------------------------------- */

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap;
}

// Patch document.createElement so the canvas we hand detectCircles has a 2D
// context with a recording getImageData. drawImage is a no-op; detectCircles
// is mocked, so the canvas is just a carrier for the recording context.
const originalCreateElement = document.createElement.bind(document);
function installCanvasSpy() {
  vi.spyOn(document, 'createElement').mockImplementation(
    ((tag: string, options?: ElementCreationOptions) => {
      if (tag !== 'canvas') return originalCreateElement(tag, options);
      const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
      const fakeCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
          pipelineState.pushGetImageDataCall([x, y, w, h]);
          return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
        }),
      };
      canvas.getContext = vi.fn(() => fakeCtx) as unknown as HTMLCanvasElement['getContext'];
      return canvas;
    }) as typeof document.createElement,
  );
}

/* ------------------------------------------------------------------------- */

async function loadPipeline() {
  return await import('./pipeline');
}

beforeEach(() => {
  pipelineState.reset();
  vi.resetModules();
  vi.restoreAllMocks();
  installCanvasSpy();
});

describe('runDetectionPipeline', () => {
  it('emits progress in order preparing → scanning → cropping → ocr → done', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([{ cx: 100, cy: 100, r: 20 }]);
    pipelineState.setOcrResults([{ text: '1', confidence: 90 }]);

    const stages: string[] = [];
    await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', (p) => {
      stages.push(p.stage);
    });

    // Drop duplicate 'ocr' stages (the OCR stage may emit multiple progress
    // ticks) — we only care about stage-transition ordering.
    const uniqueOrder = stages.filter((s, i) => s !== stages[i - 1]);
    expect(uniqueOrder).toEqual([
      'preparing',
      'scanning',
      'cropping',
      'ocr',
      'done',
    ]);
  });

  it('maps 3 fake circles to 3 DraftPins with correct bitmap-normalized fractions', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([
      { cx: 100, cy: 100, r: 30 },
      { cx: 500, cy: 400, r: 25 },
      { cx: 900, cy: 700, r: 40 },
    ]);
    pipelineState.setOcrResults([
      { text: '1', confidence: 88 },
      { text: '2', confidence: 85 },
      { text: '3', confidence: 80 },
    ]);

    // Use 1000x800 so circle at (900, 700) fits the bitmap. Stub
    // createImageBitmap to pass the source through unchanged (skipping the
    // downscale path the MAX_DIMENSION=800 threshold would otherwise trigger).
    (globalThis as unknown as { createImageBitmap: (b: ImageBitmap) => Promise<ImageBitmap> }).createImageBitmap =
      async (b: ImageBitmap) => b;
    const pins = await runDetectionPipeline(
      fakeBitmap(1000, 800),
      'plan.png',
      () => {},
    );
    expect(pins).toHaveLength(3);
    // Pin 1: (100,100,30) on 1000x800 → x=0.1, y=0.125, r=0.03
    expect(pins[0].x).toBeCloseTo(0.1);
    expect(pins[0].y).toBeCloseTo(0.125);
    expect(pins[0].detectedRadius).toBeCloseTo(0.03);
    expect(pins[0].tableNumber).toBe('1');
    // Pin 2: (500,400,25) on 1000x800 → x=0.5, y=0.5, r=0.025
    expect(pins[1].x).toBeCloseTo(0.5);
    expect(pins[1].y).toBeCloseTo(0.5);
    expect(pins[1].detectedRadius).toBeCloseTo(0.025);
    // Pin 3: (900,700,40) on 1000x800 → x=0.9, y=0.875, r=0.04
    expect(pins[2].x).toBeCloseTo(0.9);
    expect(pins[2].y).toBeCloseTo(0.875);
    expect(pins[2].detectedRadius).toBeCloseTo(0.04);

    // Every pin gets a unique id (crypto.randomUUID()).
    const ids = new Set(pins.map((p) => p.id));
    expect(ids.size).toBe(3);
  });

  it("sets status='ok' when confidence>=40 and digits parsed", async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([{ cx: 100, cy: 100, r: 20 }]);
    pipelineState.setOcrResults([{ text: '12', confidence: 88 }]);
    const pins = await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', () => {});
    expect(pins[0].status).toBe('ok');
    expect(pins[0].tableNumber).toBe('12');
    expect(pins[0].confidence).toBe(88);
  });

  it("sets status='low-confidence' when digits parsed but confidence < 40", async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([{ cx: 100, cy: 100, r: 20 }]);
    pipelineState.setOcrResults([{ text: '7', confidence: 25 }]);
    const pins = await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', () => {});
    expect(pins[0].status).toBe('low-confidence');
    expect(pins[0].tableNumber).toBe('7');
  });

  it("sets status='needs-number' when OCR returns no digits", async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([{ cx: 100, cy: 100, r: 20 }]);
    pipelineState.setOcrResults([{ text: '', confidence: 90 }]);
    const pins = await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', () => {});
    expect(pins[0].status).toBe('needs-number');
    expect(pins[0].tableNumber).toBeNull();
  });

  it('strips non-digit characters from OCR text (belt + suspenders vs whitelist)', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([{ cx: 100, cy: 100, r: 20 }]);
    // Simulate a whitelist-leak edge case — text contains a stray letter.
    pipelineState.setOcrResults([{ text: '4a2', confidence: 75 }]);
    const pins = await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', () => {});
    expect(pins[0].tableNumber).toBe('42');
    expect(pins[0].status).toBe('ok');
  });

  it('forwards OCR loop progress as { stage: "ocr", done, total } events', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([
      { cx: 100, cy: 100, r: 20 },
      { cx: 200, cy: 200, r: 20 },
      { cx: 300, cy: 300, r: 20 },
    ]);
    pipelineState.setOcrResults([
      { text: '1', confidence: 80 },
      { text: '2', confidence: 80 },
      { text: '3', confidence: 80 },
    ]);
    pipelineState.setEmitOcrProgress(true);

    const ocrProgress: Array<{ done?: number; total?: number }> = [];
    await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', (p) => {
      // Filter out the bootstrap `done:0` tick emitted BEFORE the OCR loop
      // starts — we're asserting the per-recognize forwarded ticks.
      if (p.stage === 'ocr' && typeof p.done === 'number' && p.done > 0) {
        ocrProgress.push({ done: p.done, total: p.total });
      }
    });
    expect(ocrProgress).toEqual([
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ]);
  });

  it('downscales bitmaps exceeding 1200px via createImageBitmap (Pitfall 4)', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([]);
    pipelineState.setOcrResults([]);

    // globalThis.createImageBitmap is not available in jsdom; stub + spy.
    const downscaled = fakeBitmap(1200, 915);
    const createImageBitmapSpy = vi.fn(async () => downscaled);
    (globalThis as unknown as { createImageBitmap: typeof createImageBitmapSpy }).createImageBitmap =
      createImageBitmapSpy;

    await runDetectionPipeline(
      fakeBitmap(3300, 2517),
      'big.png',
      () => {},
    );

    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    const [source, opts] = createImageBitmapSpy.mock.calls[0] as unknown as [
      ImageBitmap,
      { resizeWidth: number; resizeQuality: string },
    ];
    expect(source.width).toBe(3300);
    expect(opts.resizeWidth).toBe(1200);
    expect(opts.resizeQuality).toBe('high');
  });

  it('does NOT downscale bitmaps under 1200px', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    pipelineState.setCircles([]);
    pipelineState.setOcrResults([]);

    const createImageBitmapSpy = vi.fn(async () => fakeBitmap(1000, 800));
    (globalThis as unknown as { createImageBitmap: typeof createImageBitmapSpy }).createImageBitmap =
      createImageBitmapSpy;

    await runDetectionPipeline(fakeBitmap(1000, 800), 'small.png', () => {});
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it('guards getImageData against negative x/y when a circle sits near the canvas edge', async () => {
    const { runDetectionPipeline } = await loadPipeline();
    // Circle center (5, 5) radius 20 → raw crop x = 5 - 20 = -15. Must clamp to 0.
    pipelineState.setCircles([{ cx: 5, cy: 5, r: 20 }]);
    pipelineState.setOcrResults([{ text: '1', confidence: 80 }]);

    await runDetectionPipeline(fakeBitmap(600, 500), 'plan.png', () => {});
    expect(pipelineState.getImageDataCalls).toHaveLength(1);
    const [x, y] = pipelineState.getImageDataCalls[0];
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
