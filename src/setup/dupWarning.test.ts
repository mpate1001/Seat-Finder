/**
 * Tests for src/setup/dupWarning.ts — findDuplicatePositions.
 *
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-14
 */

import { describe, it, expect } from 'vitest';
import { findDuplicatePositions } from './dupWarning';
import type { DraftPin } from './types';

function pin(id: string, x: number, y: number): DraftPin {
  return {
    id,
    x,
    y,
    detectedRadius: 0.02,
    tableNumber: id,
    confidence: 90,
    status: 'ok',
  };
}

describe('findDuplicatePositions', () => {
  it('returns [] for an empty pin list', () => {
    expect(findDuplicatePositions([])).toEqual([]);
  });

  it('returns a single pair when two pins share identical coordinates', () => {
    const pairs = findDuplicatePositions([
      pin('a', 0.5, 0.5),
      pin('b', 0.5, 0.5),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].pinId).toBe('a');
    expect(pairs[0].otherPinId).toBe('b');
    expect(pairs[0].distance).toBeCloseTo(0);
  });

  it('returns 0 pairs when two pins are 0.04 apart (default threshold = 0.03)', () => {
    // Axis-aligned: dx=0.04, dy=0 → distance=0.04.
    const pairs = findDuplicatePositions([
      pin('a', 0.5, 0.5),
      pin('b', 0.54, 0.5),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('returns 1 pair when two pins are 0.02 apart (default threshold)', () => {
    const pairs = findDuplicatePositions([
      pin('a', 0.5, 0.5),
      pin('b', 0.52, 0.5),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].distance).toBeCloseTo(0.02);
  });

  it('returns 3 pairs when three pins are all within threshold (n choose 2)', () => {
    const pairs = findDuplicatePositions([
      pin('a', 0.50, 0.50),
      pin('b', 0.51, 0.50),
      pin('c', 0.50, 0.51),
    ]);
    expect(pairs).toHaveLength(3);
    // Pair ids are always normalized so (min, max) — makes de-dupe trivial.
    for (const p of pairs) {
      expect(p.pinId < p.otherPinId).toBe(true);
    }
  });

  it('respects a custom threshold override', () => {
    // 0.10 apart — outside default, inside a threshold of 0.20.
    const pins = [pin('a', 0.3, 0.3), pin('b', 0.4, 0.3)];
    expect(findDuplicatePositions(pins)).toHaveLength(0);
    expect(findDuplicatePositions(pins, 0.2)).toHaveLength(1);
  });
});
