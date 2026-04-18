/**
 * Tests for src/setup/ocr.ts — Tesseract one-shot worker with mocked runtime.
 *
 * tesseract.js is mocked via vi.mock so tests never download the 10+ MB
 * eng.traineddata or fetch the core WASM. The fake worker implementation is
 * controllable per-call (fixture arrays for text/confidence) so every code
 * branch — happy path, non-number confidence, error → terminate — is
 * exercised deterministically.
 *
 * Reference: .planning/phases/05-setup-tooling/05-RESEARCH.md §Pattern 4
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-08, D-09
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------------- */
/* Shared mutable fake-tesseract state (vi.hoisted so vi.mock can see it).   */
/* ------------------------------------------------------------------------- */

type FakeRecognizeOutcome =
  | { kind: 'ok'; text: string; confidence: unknown }
  | { kind: 'throw'; error: Error };

const tesseractState = vi.hoisted(() => {
  // Planned return value per recognize() call; consumed FIFO. Any missing
  // index falls back to an empty ok result so we never leak undefined into
  // the system under test.
  let outcomes: FakeRecognizeOutcome[] = [];

  // Captures the order + args of every worker method call for sequencing
  // assertions (whitelist-before-recognize, terminate always-called, etc.).
  const callLog: Array<{ method: string; args: unknown[] }> = [];

  // Most recent createWorker args for the v7 signature assertion.
  let lastCreateWorkerArgs: unknown[] = [];

  function reset() {
    outcomes = [];
    callLog.length = 0;
    lastCreateWorkerArgs = [];
  }

  return {
    get outcomes() { return outcomes; },
    setOutcomes(list: FakeRecognizeOutcome[]) { outcomes = list; },
    get callLog() { return callLog; },
    pushCall(method: string, args: unknown[]) {
      callLog.push({ method, args });
    },
    get lastCreateWorkerArgs() { return lastCreateWorkerArgs; },
    setLastCreateWorkerArgs(args: unknown[]) { lastCreateWorkerArgs = args; },
    reset,
  };
});

/* ------------------------------------------------------------------------- */
/* vi.mock('tesseract.js') — controllable fake worker factory.               */
/* ------------------------------------------------------------------------- */

vi.mock('tesseract.js', () => {
  function makeFakeWorker() {
    let recognizeIndex = 0;
    const worker = {
      setParameters: vi.fn(async (params: unknown) => {
        tesseractState.pushCall('setParameters', [params]);
      }),
      recognize: vi.fn(async (input: unknown) => {
        tesseractState.pushCall('recognize', [input]);
        const outcome =
          tesseractState.outcomes[recognizeIndex] ??
          ({ kind: 'ok', text: '', confidence: 0 } satisfies FakeRecognizeOutcome);
        recognizeIndex++;
        if (outcome.kind === 'throw') throw outcome.error;
        return { data: { text: outcome.text, confidence: outcome.confidence } };
      }),
      terminate: vi.fn(async () => {
        tesseractState.pushCall('terminate', []);
      }),
    };
    return worker;
  }

  async function createWorker(...args: unknown[]) {
    tesseractState.setLastCreateWorkerArgs(args);
    tesseractState.pushCall('createWorker', args);
    return makeFakeWorker();
  }

  return {
    createWorker,
  };
});

/* ------------------------------------------------------------------------- */

async function loadOcr() {
  return await import('./ocr');
}

function fakeImageData(id: number): ImageData {
  // The fake worker does not touch the content — any unique sentinel works.
  return { sentinel: id } as unknown as ImageData;
}

beforeEach(() => {
  tesseractState.reset();
  vi.resetModules();
});

describe('recognizeCircles', () => {
  it("initializes the worker with ('eng', 1, { logger }) per v7 signature", async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([{ kind: 'ok', text: '1', confidence: 90 }]);
    await recognizeCircles([fakeImageData(0)]);
    const [lang, oem, opts] = tesseractState.lastCreateWorkerArgs as [
      string,
      number,
      { logger: unknown },
    ];
    expect(lang).toBe('eng');
    expect(oem).toBe(1);
    expect(typeof opts.logger).toBe('function');
  });

  it('applies the digit whitelist BEFORE the first recognize() call', async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([
      { kind: 'ok', text: '1', confidence: 80 },
      { kind: 'ok', text: '2', confidence: 80 },
    ]);
    await recognizeCircles([fakeImageData(0), fakeImageData(1)]);
    const order = tesseractState.callLog.map((c) => c.method);
    const firstSetParams = order.indexOf('setParameters');
    const firstRecognize = order.indexOf('recognize');
    expect(firstSetParams).toBeGreaterThan(-1);
    expect(firstRecognize).toBeGreaterThan(-1);
    expect(firstSetParams).toBeLessThan(firstRecognize);

    const setParamCall = tesseractState.callLog.find(
      (c) => c.method === 'setParameters',
    )!;
    expect(setParamCall.args[0]).toEqual({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '8',
    });
  });

  it('returns text + confidence for each input image', async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([
      { kind: 'ok', text: '42', confidence: 88 },
      { kind: 'ok', text: '  7  ', confidence: 73 },
      { kind: 'ok', text: '13', confidence: 55 },
    ]);
    const results = await recognizeCircles([
      fakeImageData(0),
      fakeImageData(1),
      fakeImageData(2),
    ]);
    expect(results).toEqual([
      { text: '42', confidence: 88 },
      { text: '7', confidence: 73 },
      { text: '13', confidence: 55 },
    ]);
  });

  it('defaults confidence to 0 when tesseract returns a non-number', async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([
      { kind: 'ok', text: '7', confidence: undefined },
    ]);
    const results = await recognizeCircles([fakeImageData(0)]);
    expect(results).toEqual([{ text: '7', confidence: 0 }]);
  });

  it('invokes onProgress(i+1, total) after every recognize in order', async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([
      { kind: 'ok', text: '1', confidence: 90 },
      { kind: 'ok', text: '2', confidence: 90 },
      { kind: 'ok', text: '3', confidence: 90 },
    ]);
    const progressCalls: Array<[number, number]> = [];
    await recognizeCircles(
      [fakeImageData(0), fakeImageData(1), fakeImageData(2)],
      (done, total) => progressCalls.push([done, total]),
    );
    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('terminates the worker once on the happy path', async () => {
    const { recognizeCircles } = await loadOcr();
    tesseractState.setOutcomes([
      { kind: 'ok', text: '1', confidence: 90 },
    ]);
    await recognizeCircles([fakeImageData(0)]);
    const terminateCalls = tesseractState.callLog.filter(
      (c) => c.method === 'terminate',
    );
    expect(terminateCalls).toHaveLength(1);
  });

  it('terminates the worker when recognize() throws (finally branch)', async () => {
    const { recognizeCircles } = await loadOcr();
    const boom = new Error('OCR boom');
    tesseractState.setOutcomes([
      { kind: 'ok', text: '1', confidence: 90 },
      { kind: 'throw', error: boom },
    ]);
    await expect(
      recognizeCircles([fakeImageData(0), fakeImageData(1)]),
    ).rejects.toBe(boom);
    const terminateCalls = tesseractState.callLog.filter(
      (c) => c.method === 'terminate',
    );
    expect(terminateCalls).toHaveLength(1);
  });
});
