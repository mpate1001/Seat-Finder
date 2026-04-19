/**
 * src/setup/dupWarning.ts — duplicate-position warning utility (D-14).
 *
 * Repurposes the Phase 1 dev-console duplicate-position warning pattern
 * (see `FloorPlan.tsx::warnDuplicatePositions`) into a user-facing surface:
 * the admin reviewing a set of draft pins needs to SEE that two pins are
 * stacked on top of each other, since a detection duplicate is the
 * #1 false-positive mode for HoughCircles on clean line-art inputs.
 *
 * Pure O(n²) scan. With 54 tables (the Reception Seat Diagram baseline)
 * the 2,916 comparisons are negligible; even at a theoretical 500 pins
 * the 250k comparisons complete in sub-millisecond.
 *
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-14
 */

import type { DraftPin } from './types';

/** One unique (a, b) pair of draft pins closer than the configured threshold. */
export interface DupPair {
  pinId: string;
  otherPinId: string;
  /** Euclidean distance in 0..1 fraction space. */
  distance: number;
}

/**
 * Returns every unique pair of draft pins whose fractional coordinates sit
 * within `threshold` (Euclidean, 0..1 space). Pair ordering is stable:
 * `(pinId, otherPinId)` is emitted with `pinId < otherPinId` by string
 * comparison — so a given logical pair appears once, not twice.
 *
 * Default threshold = 0.03 (3% of image dimension) — the D-14 value.
 */
export function findDuplicatePositions(
  pins: DraftPin[],
  threshold: number = 0.03,
): DupPair[] {
  const pairs: DupPair[] = [];
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i];
      const b = pins[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < threshold) {
        // Normalize ordering so `{pinId, otherPinId}` is deterministic
        // regardless of iteration order (callers can safely de-dup by key).
        const [pinId, otherPinId] =
          a.id < b.id ? [a.id, b.id] : [b.id, a.id];
        pairs.push({ pinId, otherPinId, distance });
      }
    }
  }
  return pairs;
}
