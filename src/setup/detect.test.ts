/**
 * Tests for src/setup/detect.ts — worker-dispatch layer.
 *
 * The pure Hough algorithm is covered by src/setup/detect.core.test.ts. These
 * specs exercise only the main-thread surface:
 *   1. Request/response round-trip: postMessage payload shape, ImageData
 *      transfer list, and the worker's `id` correlation.
 *   2. Worker memoization: detectCircles shares a single Worker across calls.
 *   3. Error propagation: `{ type: 'error' }` replies reject the caller's
 *      promise with the carried message; worker `error` events are surfaced
 *      as crash errors.
 *   4. Concurrent requests: two in-flight detectCircles calls do not cross
 *      their responses.
 *
 * The global `Worker` constructor is stubbed via `vi.stubGlobal` so no real
 * worker script is loaded under jsdom. Each StubWorker instance records its
 * postMessage calls and can fire synthetic `message` / `error` / `messageerror`
 * events back through the registered listeners.
 *
 * Reference: ./detect.worker.ts message protocol
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { RawCircle } from './types';

/* ------------------------------------------------------------------------- */
/* Mock the transitively-imported OpenCV runtime.                             */
/*                                                                            */
/* detect.ts re-exports `getCv` from ./detect.core, which statically imports  */
/* `@techstark/opencv-js`. Loading the real WASM runtime under jsdom hangs   */
/* forever (no fetch for the .wasm file); the core algorithm path is already */
/* covered by detect.core.test.ts with its own mock, so here we just shut    */
/* the import up with an empty default.                                      */
/* ------------------------------------------------------------------------- */

vi.mock('@techstark/opencv-js', () => ({ default: {} }));

/* ------------------------------------------------------------------------- */
/* StubWorker — minimal Worker shape driven per-test via `onPost`.            */
/* ------------------------------------------------------------------------- */

type MessageListener = (ev: MessageEvent<unknown>) => void;
type ErrorListener = (ev: ErrorEvent) => void;

interface PostedFrame {
  message: unknown;
  transfer: Transferable[] | undefined;
}

class StubWorker {
  static instances: StubWorker[] = [];

  url: string | URL;
  options?: WorkerOptions;
  posted: PostedFrame[] = [];
  terminated = false;

  /**
   * Set by each test to control how the stub responds. Given the message the
   * dispatcher posted, the handler returns either a single response frame
   * (dispatched once) or an array (dispatched in order). Returning `null`
   * dispatches nothing — useful for the crash / messageerror cases.
   */
  onPost: ((message: unknown) => unknown | unknown[] | null) | null = null;

  private messageListeners = new Set<MessageListener>();
  private errorListeners = new Set<ErrorListener>();
  private messageErrorListeners = new Set<MessageListener>();

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    StubWorker.instances.push(this);
  }

  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    cb: MessageListener | ErrorListener,
  ): void {
    if (type === 'message') this.messageListeners.add(cb as MessageListener);
    else if (type === 'error') this.errorListeners.add(cb as ErrorListener);
    else this.messageErrorListeners.add(cb as MessageListener);
  }

  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    cb: MessageListener | ErrorListener,
  ): void {
    if (type === 'message') this.messageListeners.delete(cb as MessageListener);
    else if (type === 'error') this.errorListeners.delete(cb as ErrorListener);
    else this.messageErrorListeners.delete(cb as MessageListener);
  }

  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.posted.push({ message, transfer });
    if (!this.onPost) return;
    const reply = this.onPost(message);
    if (reply === null) return;
    // Microtask-delay the reply so the caller's promise listener chain is
    // armed before we fire — mirrors real worker message latency.
    queueMicrotask(() => {
      const frames = Array.isArray(reply) ? reply : [reply];
      for (const frame of frames) {
        this.dispatchMessage(frame);
      }
    });
  }

  dispatchMessage(data: unknown): void {
    const ev = { data } as MessageEvent<unknown>;
    for (const cb of this.messageListeners) cb(ev);
  }

  dispatchError(message: string): void {
    const ev = { message } as ErrorEvent;
    for (const cb of this.errorListeners) cb(ev);
  }

  dispatchMessageError(): void {
    const ev = {} as MessageEvent<unknown>;
    for (const cb of this.messageErrorListeners) cb(ev);
  }

  terminate(): void {
    this.terminated = true;
  }
}

/* ------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* ------------------------------------------------------------------------- */

function makeImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

function makeCanvas(
  width: number,
  height: number,
  imageData = makeImageData(width, height),
): HTMLCanvasElement {
  return {
    width,
    height,
    getContext: (_type: string) => ({
      getImageData: (_x: number, _y: number, _w: number, _h: number) =>
        imageData,
    }),
  } as unknown as HTMLCanvasElement;
}

/* ------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* ------------------------------------------------------------------------- */

beforeEach(() => {
  StubWorker.instances.length = 0;
  vi.stubGlobal('Worker', StubWorker as unknown as typeof Worker);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadDetect() {
  const mod = await import('./detect');
  // Always start from a fresh worker between tests.
  mod.__resetWorkerForTests();
  return mod;
}

/* ------------------------------------------------------------------------- */
/* Specs                                                                      */
/* ------------------------------------------------------------------------- */

describe('detectCircles (worker dispatch)', () => {
  it('constructs a module worker the first time it is called', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(800, 600);
    const fakeCircles: RawCircle[] = [{ cx: 1, cy: 2, r: 3 }];

    StubWorker.instances.length = 0;

    const promise = detectCircles(canvas);
    expect(StubWorker.instances).toHaveLength(1);
    const worker = StubWorker.instances[0];
    expect(worker.options).toEqual({ type: 'module' });
    // URL should reference detect.worker.ts (suffix check — the URL resolver
    // prefixes with the file URL scheme).
    expect(String(worker.url)).toContain('detect.worker');

    // Fire the worker's reply so detectCircles resolves.
    const postedId = (worker.posted[0].message as { id: number }).id;
    worker.dispatchMessage({
      id: postedId,
      type: 'result',
      circles: fakeCircles,
    });
    await expect(promise).resolves.toEqual(fakeCircles);
  });

  it('transfers the ImageData pixel buffer to the worker', async () => {
    const { detectCircles } = await loadDetect();
    const imageData = makeImageData(800, 600);
    const canvas = makeCanvas(800, 600, imageData);

    const promise = detectCircles(canvas);
    const worker = StubWorker.instances[0];
    const frame = worker.posted[0];
    expect(frame.transfer).toBeDefined();
    expect(frame.transfer).toHaveLength(1);
    expect(frame.transfer?.[0]).toBe(imageData.data.buffer);

    const postedId = (frame.message as { id: number }).id;
    worker.dispatchMessage({ id: postedId, type: 'result', circles: [] });
    await promise;
  });

  it('includes the ImageData and opts in the posted message', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(1000, 800);

    const opts = {
      dp: 2,
      minDist: 11,
      param1: 22,
      param2: 33,
      minRadius: 44,
      maxRadius: 55,
    };
    const promise = detectCircles(canvas, opts);
    const worker = StubWorker.instances[0];
    const msg = worker.posted[0].message as {
      id: number;
      imageData: ImageData;
      opts: typeof opts;
    };
    expect(typeof msg.id).toBe('number');
    expect(msg.imageData.width).toBe(1000);
    expect(msg.imageData.height).toBe(800);
    expect(msg.opts).toEqual(opts);

    worker.dispatchMessage({ id: msg.id, type: 'result', circles: [] });
    await promise;
  });

  it('reuses a single worker across sequential calls (memoization)', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(400, 300);

    const p1 = detectCircles(canvas);
    const w1 = StubWorker.instances[0];
    const id1 = (w1.posted[0].message as { id: number }).id;
    w1.dispatchMessage({ id: id1, type: 'result', circles: [] });
    await p1;

    const p2 = detectCircles(canvas);
    // Same worker instance — we did NOT spawn a second one.
    expect(StubWorker.instances).toHaveLength(1);
    const id2 = (w1.posted[1].message as { id: number }).id;
    expect(id2).not.toBe(id1);
    w1.dispatchMessage({ id: id2, type: 'result', circles: [] });
    await p2;
  });

  it('rejects with the message carried on a `type: "error"` response', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(400, 300);

    const promise = detectCircles(canvas);
    const worker = StubWorker.instances[0];
    const id = (worker.posted[0].message as { id: number }).id;
    worker.dispatchMessage({ id, type: 'error', message: 'hough failed' });
    await expect(promise).rejects.toThrow('hough failed');
  });

  it('rejects when the worker emits an error event', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(400, 300);

    const promise = detectCircles(canvas);
    const worker = StubWorker.instances[0];
    worker.dispatchError('worker crashed');
    await expect(promise).rejects.toThrow('worker crashed');
  });

  it('rejects when the worker emits a messageerror event', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(400, 300);

    const promise = detectCircles(canvas);
    const worker = StubWorker.instances[0];
    worker.dispatchMessageError();
    await expect(promise).rejects.toThrow(/deserialize/);
  });

  it('correlates responses by id so concurrent calls do not cross-talk', async () => {
    const { detectCircles } = await loadDetect();
    const canvas = makeCanvas(400, 300);

    const p1 = detectCircles(canvas);
    const p2 = detectCircles(canvas);
    const worker = StubWorker.instances[0];
    const id1 = (worker.posted[0].message as { id: number }).id;
    const id2 = (worker.posted[1].message as { id: number }).id;
    expect(id1).not.toBe(id2);

    // Reply to the SECOND request first.
    worker.dispatchMessage({
      id: id2,
      type: 'result',
      circles: [{ cx: 2, cy: 2, r: 2 }],
    });
    await expect(p2).resolves.toEqual([{ cx: 2, cy: 2, r: 2 }]);

    // Then the first.
    worker.dispatchMessage({
      id: id1,
      type: 'result',
      circles: [{ cx: 1, cy: 1, r: 1 }],
    });
    await expect(p1).resolves.toEqual([{ cx: 1, cy: 1, r: 1 }]);
  });

  it('throws synchronously when the canvas has no 2D context', async () => {
    const { detectCircles } = await loadDetect();
    const noCtx = {
      width: 400,
      height: 300,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    await expect(detectCircles(noCtx)).rejects.toThrow(/2D canvas context/);
  });
});
