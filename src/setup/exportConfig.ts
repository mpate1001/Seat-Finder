/**
 * src/setup/exportConfig.ts — build + serialize FloorPlanConfig for export (D-16).
 *
 * Two-step pipeline:
 *  1. `buildFloorPlanConfig(pins, imageFileName)` converts approved DraftPins
 *     to the JSON shape that guest code already consumes.
 *  2. `serializeFloorPlanConfig(cfg)` emits a string BYTE-IDENTICAL to the
 *     existing `src/config/floorPlan.json` format. We cannot use
 *     `JSON.stringify(cfg, null, 2)` because that emits each `x` and `y` on
 *     its own line — the existing file has `{ "x": N, "y": N }` on one line
 *     per entry. The byte-equivalence spec in exportConfig.test.ts is the
 *     contract proof.
 *
 * Reference: .planning/phases/05-setup-tooling/05-CONTEXT.md D-16
 * Reference: .planning/phases/05-setup-tooling/05-06-PLAN.md must_haves
 */

import type { FloorPlanConfig } from '../components/FloorPlan';
import type { DraftPin } from './types';

/** Round to 4 decimal places to match the existing floorPlan.json convention.
 *  Math.round is half-away-from-zero for positive finite doubles in the fraction
 *  range we care about (0..1), which is what the existing file uses. */
export function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Build a FloorPlanConfig from approved DraftPins.
 *  - Pins are sorted by numeric tableNumber ascending (keeps the committed
 *    file's natural reading order).
 *  - Pins with `tableNumber === null` are skipped (defensive — validation
 *    should have blocked this path).
 *  - x/y are rounded to 4 decimals.
 */
export function buildFloorPlanConfig(
  pins: DraftPin[],
  imageFileName: string,
): FloorPlanConfig {
  const sorted = [...pins].sort((a, b) => {
    // Null-tableNumber pins (defensive): push to the end; they get skipped
    // below anyway but sorting must stay total-order for type safety.
    if (a.tableNumber === null && b.tableNumber === null) return 0;
    if (a.tableNumber === null) return 1;
    if (b.tableNumber === null) return -1;
    const aN = Number(a.tableNumber);
    const bN = Number(b.tableNumber);
    if (Number.isFinite(aN) && Number.isFinite(bN)) return aN - bN;
    if (Number.isFinite(aN)) return -1;
    if (Number.isFinite(bN)) return 1;
    return a.tableNumber.localeCompare(b.tableNumber);
  });

  const tablePositions: Record<string, { x: number; y: number }> = {};
  for (const pin of sorted) {
    if (pin.tableNumber === null) continue;
    tablePositions[pin.tableNumber] = {
      x: roundTo4(pin.x),
      y: roundTo4(pin.y),
    };
  }

  return { imageFileName, tablePositions };
}

/**
 * Serialize a FloorPlanConfig to a string byte-identical to
 * `src/config/floorPlan.json`. Format (exact):
 *
 *   {
 *     "imageFileName": "<filename>",
 *     "tablePositions": {
 *       "1": { "x": N, "y": N },
 *       ...
 *       "K": { "x": N, "y": N }
 *     }
 *   }
 *
 *  - Outer object: 2-space indent.
 *  - tablePositions: one entry per line at 4-space indent, compact object,
 *    last entry has no trailing comma.
 *  - Final `}` is followed by a single '\n'.
 *
 * Insertion order of tablePositions is preserved — callers should pass
 * configs already sorted (e.g. via buildFloorPlanConfig).
 *
 * ⚠️  THE OUTPUT FORMAT IS INTENTIONALLY BYTE-STRICT.  ⚠️
 *
 * The setup tool's contract (D-16, TOOL-02) is that an admin who exports
 * a layout, hand-edits one entry, and pastes it back into
 * `src/config/floorPlan.json` produces a file that diff-clean against what
 * this serializer would re-emit. That diff-cleanliness is what
 * `exportConfig.test.ts > byte-equivalence with src/config/floorPlan.json`
 * pins down. Switching to `JSON.stringify(cfg, null, 2)` "for cleanliness"
 * would silently break that contract — every coordinate would land on its
 * own line and every existing diff/PR review against the file would be
 * unreadable. If you genuinely need to change the on-disk format, you must
 * also (a) re-export and recommit `src/config/floorPlan.json`, (b) update
 * the byte-equivalence test fixture, and (c) flag the change in the next
 * release notes so consumers re-running the setup tool aren't surprised.
 */
export function serializeFloorPlanConfig(cfg: FloorPlanConfig): string {
  // The committed floorPlan.json stores every coordinate at EXACTLY 4 decimal
  // places (e.g. "0.2770", not "0.277"). JSON's number→string conversion drops
  // trailing zeros, so we use toFixed(4) to preserve the written-out form
  // byte-for-byte. The coordinates have already been rounded in
  // buildFloorPlanConfig, so toFixed here is a pure formatting pass.
  const fmt = (n: number): string => n.toFixed(4);
  const entries = Object.entries(cfg.tablePositions)
    .map(
      ([id, pos]) =>
        `    ${JSON.stringify(id)}: { "x": ${fmt(pos.x)}, "y": ${fmt(pos.y)} }`,
    )
    .join(',\n');

  // The tablePositions block is indented at 2 spaces (for the opening key)
  // and 4 spaces per entry. Two sub-cases: empty tablePositions collapses to
  // a `{}` pair on the key line; populated uses a multi-line block.
  const tablePositionsBlock =
    entries === ''
      ? `  "tablePositions": {}`
      : `  "tablePositions": {\n${entries}\n  }`;

  return (
    `{\n` +
    `  "imageFileName": ${JSON.stringify(cfg.imageFileName)},\n` +
    `${tablePositionsBlock}\n` +
    `}\n`
  );
}
