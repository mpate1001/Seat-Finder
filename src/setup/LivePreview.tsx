/**
 * src/setup/LivePreview.tsx — real-FloorPlan preview driven by draft pins.
 *
 * D-13: the review UI renders the REAL `<FloorPlan/>` component from
 * src/components/FloorPlan.tsx, fed a synthetic config derived from current
 * draft pins. This proves-out what guests will see BEFORE the admin approves
 * — no "looked-right-in-my-editor-but-broke-in-production" gap.
 *
 * Pattern notes:
 *  - `buildSyntheticConfig(pins, fileName)` is memoized at the caller via
 *    useMemo so FloorPlan's DEV dup-warning dedupe gate (warnedConfigsRef in
 *    FloorPlan.tsx) continues to de-dup across renders. A fresh config
 *    identity per render would re-warn in DEV and spam the console.
 *  - Pins with `tableNumber === null` are skipped — they have no legal JSON
 *    key. The admin sees them in ReviewCanvas but they cannot preview.
 *  - `focusedTableNumber` lets the admin click a pin in the review canvas to
 *    simulate "what this guest would see" — defaults to '' so no pin is
 *    highlighted until the admin selects one.
 *  - `TransformWrapper initialScale={1} minScale={1} maxScale={4}` matches
 *    plan 05-03's map interaction envelope (MapView uses maxScale=6 with
 *    toggle-zoom; the preview is simpler — no toggle, no fling). `doubleClick
 *    disabled` because the preview is read-only — the admin works in
 *    ReviewCanvas, not here.
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-13, D-16
 *  - src/components/MapView.tsx (TransformWrapper usage pattern)
 *  - src/components/FloorPlan.tsx (the component this wraps)
 */

import { useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import FloorPlan, { type FloorPlanConfig } from '../components/FloorPlan';
import type { DraftPin } from './types';

/**
 * Stable no-op ref callback — declared at module scope so the LivePreview
 * component body does not create a new identity every render. CLAUDE.md's
 * `noUnusedLocals` strict flag is satisfied because this constant is read by
 * the JSX below.
 */
const noopPinRef: React.Ref<HTMLDivElement> = () => {};

const noopImageLoad = (): void => {};

/**
 * Maps DraftPin[] + an imageFileName to the FloorPlanConfig shape consumed by
 * `<FloorPlan/>`. Pins without a tableNumber are skipped (they would have no
 * legal JSON key in tablePositions).
 *
 * Duplicate tableNumbers resolve last-one-wins — the admin's ReviewCanvas
 * dup-warning strip surfaces this case above the canvas so they can fix it.
 * We could alternatively throw, but the preview should render SOMETHING even
 * with temporary inconsistency; the admin can always navigate back and
 * delete the older duplicate.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildSyntheticConfig(
  pins: DraftPin[],
  imageFileName: string,
): FloorPlanConfig {
  const tablePositions: Record<string, { x: number; y: number }> = {};
  for (const pin of pins) {
    if (pin.tableNumber === null) continue;
    tablePositions[pin.tableNumber] = { x: pin.x, y: pin.y };
  }
  return {
    imageFileName,
    tablePositions,
  };
}

export interface LivePreviewProps {
  pins: DraftPin[];
  imageUrl: string;
  imageFileName: string;
  /** When supplied, the corresponding pin renders as a red-teardrop
   *  assigned pin in the preview. Defaults to '' (nothing highlighted). */
  focusedTableNumber?: string;
}

export default function LivePreview({
  pins,
  imageUrl,
  imageFileName,
  focusedTableNumber = '',
}: LivePreviewProps): JSX.Element {
  // Memoize the synthetic config so FloorPlan's DEV dup-warning gate
  // (warnedConfigsRef) sees a stable identity until pins/fileName actually
  // change. This is a plan-05-03 contract: FloorPlan dedupes by reference.
  const syntheticConfig = useMemo(
    () => buildSyntheticConfig(pins, imageFileName),
    [pins, imageFileName],
  );

  return (
    <div className="live-preview-root">
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={4}
        centerOnInit={true}
        doubleClick={{ disabled: true }}
        limitToBounds={true}
        wheel={{ step: 0.2 }}
      >
        <TransformComponent wrapperClass="live-preview-wrapper">
          <FloorPlan
            tableNumber={focusedTableNumber}
            assignedPinRef={noopPinRef}
            onImageLoad={noopImageLoad}
            config={syntheticConfig}
            imageSrc={imageUrl}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
