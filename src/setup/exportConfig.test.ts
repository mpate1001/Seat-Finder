/**
 * Tests for src/setup/exportConfig.ts — D-16 byte-equivalence contract.
 *
 * The byte-equivalence spec (spec 5) is the TOOL-02 proof: the setup tool's
 * exporter must reproduce the existing src/config/floorPlan.json file exactly,
 * because guest code reads that file unchanged.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildFloorPlanConfig,
  serializeFloorPlanConfig,
  roundTo4,
} from './exportConfig';
import type { DraftPin } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GROUND_TRUTH_PATH = resolve(__dirname, '../config/floorPlan.json');

function pin(overrides: Partial<DraftPin> = {}): DraftPin {
  return {
    id: overrides.id ?? 'pin-' + Math.random(),
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    detectedRadius: 0.02,
    tableNumber: overrides.tableNumber === undefined ? '1' : overrides.tableNumber,
    confidence: 100,
    status: overrides.status ?? 'ok',
    ...overrides,
  };
}

describe('roundTo4', () => {
  it('rounds to 4 decimal places (half-away-from-zero for typical fractions)', () => {
    expect(roundTo4(0.12345678)).toBe(0.1235);
    expect(roundTo4(0.2758)).toBe(0.2758);
    expect(roundTo4(0.385432)).toBe(0.3854);
  });
});

describe('buildFloorPlanConfig', () => {
  it('empty pins → empty tablePositions, imageFileName passthrough', () => {
    const cfg = buildFloorPlanConfig([], 'plan.png');
    expect(cfg).toEqual({ imageFileName: 'plan.png', tablePositions: {} });
  });

  it('three pins in reverse numeric order → output keys ordered 1, 2, 3', () => {
    const pins: DraftPin[] = [
      pin({ id: 'c', tableNumber: '3', x: 0.3, y: 0.3 }),
      pin({ id: 'b', tableNumber: '2', x: 0.2, y: 0.2 }),
      pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.1 }),
    ];
    const cfg = buildFloorPlanConfig(pins, 'plan.png');
    expect(Object.keys(cfg.tablePositions)).toEqual(['1', '2', '3']);
  });

  it('coordinate rounding: x=0.12345678 → x=0.1235 in output', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '1', x: 0.12345678, y: 0.5 }),
    ];
    const cfg = buildFloorPlanConfig(pins, 'plan.png');
    expect(cfg.tablePositions['1'].x).toBe(0.1235);
  });

  it('skips pins with tableNumber=null (defensive)', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.1 }),
      pin({ id: 'b', tableNumber: null, status: 'needs-number' }),
    ];
    const cfg = buildFloorPlanConfig(pins, 'plan.png');
    expect(Object.keys(cfg.tablePositions)).toEqual(['1']);
  });

  it('does not mutate input array ordering', () => {
    const pins: DraftPin[] = [
      pin({ id: 'c', tableNumber: '3' }),
      pin({ id: 'a', tableNumber: '1' }),
      pin({ id: 'b', tableNumber: '2' }),
    ];
    const originalIds = pins.map((p) => p.id);
    buildFloorPlanConfig(pins, 'plan.png');
    expect(pins.map((p) => p.id)).toEqual(originalIds);
  });
});

describe('serializeFloorPlanConfig', () => {
  it('emits the single-line-per-entry format (NOT JSON.stringify-with-indent)', () => {
    const out = serializeFloorPlanConfig({
      imageFileName: 'plan.png',
      tablePositions: {
        '1': { x: 0.1, y: 0.2 },
        '2': { x: 0.3, y: 0.4 },
      },
    });
    expect(out).toBe(
      [
        '{',
        '  "imageFileName": "plan.png",',
        '  "tablePositions": {',
        '    "1": { "x": 0.1000, "y": 0.2000 },',
        '    "2": { "x": 0.3000, "y": 0.4000 }',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('emits each coordinate at exactly 4 decimal places (preserves trailing zeros — D-16)', () => {
    const out = serializeFloorPlanConfig({
      imageFileName: 'plan.png',
      tablePositions: { '1': { x: 0.277, y: 0.5 } },
    });
    expect(out).toContain('"1": { "x": 0.2770, "y": 0.5000 }');
  });

  it('ends with a single trailing newline', () => {
    const out = serializeFloorPlanConfig({
      imageFileName: 'p.png',
      tablePositions: { '1': { x: 0, y: 0 } },
    });
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});

describe('byte-equivalence with src/config/floorPlan.json (TOOL-02 contract)', () => {
  it('rebuilds the ground-truth file BYTE-IDENTICALLY from DraftPin[]', () => {
    const groundTruth = readFileSync(GROUND_TRUTH_PATH, 'utf8');
    const parsed = JSON.parse(groundTruth) as {
      imageFileName: string;
      tablePositions: Record<string, { x: number; y: number }>;
    };

    // Derive DraftPin[] from the ground-truth file — deliberately shuffle
    // order so the sort in buildFloorPlanConfig is actually exercised.
    const draftPins: DraftPin[] = Object.entries(parsed.tablePositions)
      .reverse()
      .map(([tableNumber, pos], i) => ({
        id: `pin-${i}`,
        x: pos.x,
        y: pos.y,
        detectedRadius: 0.02,
        tableNumber,
        confidence: 100,
        status: 'ok' as const,
      }));

    const rebuilt = serializeFloorPlanConfig(
      buildFloorPlanConfig(draftPins, parsed.imageFileName),
    );

    if (rebuilt !== groundTruth) {
      // Find the first divergence to make failure actionable.
      const aLines = rebuilt.split('\n');
      const bLines = groundTruth.split('\n');
      const max = Math.max(aLines.length, bLines.length);
      for (let i = 0; i < max; i++) {
        if (aLines[i] !== bLines[i]) {
          throw new Error(
            `byte-equivalence failed at line ${i + 1}:\n` +
              `  expected: ${JSON.stringify(bLines[i])}\n` +
              `  actual  : ${JSON.stringify(aLines[i])}`,
          );
        }
      }
    }
    expect(rebuilt).toBe(groundTruth);
  });
});
