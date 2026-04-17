/**
 * Tests for src/setup/validation.ts — D-15 approval gate.
 */

import { describe, it, expect } from 'vitest';
import { validateDraftPins } from './validation';
import type { DraftPin } from './types';

function pin(overrides: Partial<DraftPin> = {}): DraftPin {
  return {
    id: overrides.id ?? 'pin-1',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    detectedRadius: 0.02,
    tableNumber: overrides.tableNumber === undefined ? '1' : overrides.tableNumber,
    confidence: 90,
    status: overrides.status ?? 'ok',
    ...overrides,
  };
}

describe('validateDraftPins', () => {
  it('all-ok: 3 unique pins with fractional in-range coords → ok=true, errors=[]', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.2 }),
      pin({ id: 'b', tableNumber: '2', x: 0.3, y: 0.4 }),
      pin({ id: 'c', tableNumber: '3', x: 0.5, y: 0.6 }),
    ];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('missing-number: tableNumber=null → exactly one missing-number error', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: null, status: 'needs-number' }),
    ];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(false);
    const missing = result.errors.filter((e) => e.kind === 'missing-number');
    expect(missing).toHaveLength(1);
    expect(missing[0].pinId).toBe('a');
  });

  it('missing-number: whitespace-only tableNumber also flagged', () => {
    const pins: DraftPin[] = [pin({ id: 'a', tableNumber: '   ' })];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(false);
    expect(result.errors[0].kind).toBe('missing-number');
  });

  it('not-a-number: tableNumber="abc" → one not-a-number error', () => {
    const pins: DraftPin[] = [pin({ id: 'a', tableNumber: 'abc' })];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(false);
    const errs = result.errors.filter((e) => e.kind === 'not-a-number');
    expect(errs).toHaveLength(1);
    expect(errs[0].pinId).toBe('a');
  });

  it('not-a-number: rejects "1.5", "-1", "1e2", "1 2" (anything beyond ASCII digits)', () => {
    const cases = ['1.5', '-1', '1e2', '1 2'];
    for (const tableNumber of cases) {
      const result = validateDraftPins([pin({ tableNumber })]);
      const errs = result.errors.filter((e) => e.kind === 'not-a-number');
      expect(errs, `expected not-a-number for "${tableNumber}"`).toHaveLength(1);
    }
  });

  it('out-of-range: x=1.5 → one out-of-range error', () => {
    const pins: DraftPin[] = [pin({ id: 'a', tableNumber: '1', x: 1.5 })];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(false);
    const errs = result.errors.filter((e) => e.kind === 'out-of-range');
    expect(errs).toHaveLength(1);
    expect(errs[0].pinId).toBe('a');
  });

  it('out-of-range: negative y → flagged', () => {
    const pins: DraftPin[] = [pin({ id: 'a', tableNumber: '1', y: -0.01 })];
    const result = validateDraftPins(pins);
    expect(result.errors[0].kind).toBe('out-of-range');
  });

  it('in-range: x=0 and y=1 are boundary-inclusive', () => {
    const pins: DraftPin[] = [
      pin({ id: 'tl', tableNumber: '1', x: 0, y: 0 }),
      pin({ id: 'br', tableNumber: '2', x: 1, y: 1 }),
    ];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(true);
  });

  it('duplicate-id: two pins share tableNumber="7" → two duplicate-id errors (one per offender)', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '7' }),
      pin({ id: 'b', tableNumber: '7' }),
    ];
    const result = validateDraftPins(pins);
    expect(result.ok).toBe(false);
    const dupes = result.errors.filter((e) => e.kind === 'duplicate-id');
    expect(dupes).toHaveLength(2);
    expect(dupes.map((e) => e.pinId).sort()).toEqual(['a', 'b']);
  });

  it('duplicate-id + missing-number + out-of-range all compound on a single pin set', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '', x: 1.5 }), // missing-number + out-of-range
      pin({ id: 'b', tableNumber: '5' }),
      pin({ id: 'c', tableNumber: '5' }),         // duplicate with b
    ];
    const result = validateDraftPins(pins);
    const kinds = result.errors.map((e) => e.kind).sort();
    // a: missing-number, a: out-of-range, b: duplicate-id, c: duplicate-id
    expect(kinds).toEqual(['duplicate-id', 'duplicate-id', 'missing-number', 'out-of-range']);
  });
});
