/**
 * src/setup/validation.ts — approval-gate validation for draft pins (D-15).
 *
 * The Approve button in SetupApp (plan 05-06) runs this check before
 * transitioning to the `approved` mode. On failure, the error list is
 * rendered inline above the review canvas so the admin can fix issues
 * before re-clicking Approve.
 *
 * Four failure kinds (D-15):
 *  - 'missing-number'  → tableNumber is null / empty / whitespace-only.
 *  - 'not-a-number'    → tableNumber is present but not a pure ASCII-digit
 *                        integer (e.g. 'abc', '1.5', '-1', '1e2').
 *  - 'out-of-range'    → x or y falls outside [0, 1] (fraction space).
 *  - 'duplicate-id'    → two pins share the same tableNumber. Distinct from
 *                        D-14's duplicate-POSITION warning (which fires on
 *                        close coordinates regardless of number). Both
 *                        offending pins are reported so the UI can highlight
 *                        them all.
 *
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-15
 */

import type { DraftPin } from './types';

export type ValidationErrorKind =
  | 'missing-number'
  | 'duplicate-id'
  | 'out-of-range'
  | 'not-a-number';

export interface ValidationError {
  kind: ValidationErrorKind;
  pinId: string;
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

const DIGITS_ONLY = /^\d+$/;

/**
 * Validate a set of draft pins for approval/export readiness.
 *
 * Pure and synchronous — safe to call from a click handler. O(n) on pin count.
 */
export function validateDraftPins(pins: DraftPin[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Group pin ids by their tableNumber so we can emit one duplicate-id error
  // per offending pin after the per-pin pass. Pins without a number are
  // excluded here — they're reported via missing-number instead.
  const byNumber = new Map<string, string[]>();

  for (const pin of pins) {
    const raw = pin.tableNumber;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';

    if (raw === null || trimmed === '') {
      errors.push({
        kind: 'missing-number',
        pinId: pin.id,
        detail: 'Pin has no table number. Click the pin and type a number.',
      });
    } else if (!DIGITS_ONLY.test(trimmed)) {
      errors.push({
        kind: 'not-a-number',
        pinId: pin.id,
        detail: `Table number "${trimmed}" is not a positive integer.`,
      });
    } else {
      // Eligible for duplicate-id grouping. Use the trimmed canonical value
      // so "7" and "7 " collide as the same table.
      const group = byNumber.get(trimmed);
      if (group) group.push(pin.id);
      else byNumber.set(trimmed, [pin.id]);
    }

    if (pin.x < 0 || pin.x > 1 || pin.y < 0 || pin.y > 1) {
      errors.push({
        kind: 'out-of-range',
        pinId: pin.id,
        detail: `Coordinates (${pin.x}, ${pin.y}) fall outside the 0..1 image range.`,
      });
    }
  }

  for (const [tableNumber, pinIds] of byNumber) {
    if (pinIds.length < 2) continue;
    for (const pinId of pinIds) {
      errors.push({
        kind: 'duplicate-id',
        pinId,
        detail: `Table number "${tableNumber}" is used by ${pinIds.length} pins — numbers must be unique.`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
