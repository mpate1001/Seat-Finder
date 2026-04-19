---
phase: 01-data-integrity
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/components/FloorPlan.tsx
autonomous: true
requirements: [DATA-02]

must_haves:
  truths:
    - "Markers render at the correct position in normal view using percentage * displayed image dimensions"
    - "Markers render at the correct position in enlarged view using percentage * enlarged display dimensions + offsets"
    - "Resizing the browser window does not shift markers off their tables"
    - "FloorPlan.tsx contains no references to canvasWidth or canvasHeight"
  artifacts:
    - path: "src/components/FloorPlan.tsx"
      provides: "Percentage-based marker rendering"
      contains: "imageHeight"
  key_links:
    - from: "src/components/FloorPlan.tsx"
      to: "src/config/floorPlan.json"
      via: "tablePositions lookup"
      pattern: "config.tablePositions\\["
---

<objective>
Rewrite `FloorPlan.tsx` scaling math to consume percentage coordinates from the migrated `floorPlan.json`, add window-resize robustness via ResizeObserver, and remove all remaining references to `canvasWidth`/`canvasHeight`.

Purpose: Close DATA-02 — markers must render correctly against the displayed image in both normal and enlarged views, and survive browser resizes / image swaps.
Output: Updated `FloorPlan.tsx` with `imageHeight` state, `ResizeObserver`-backed resize handling, percentage-based marker math at both render sites, and a dev-only duplicate-coordinate warning.

Note: The `FloorPlanConfig` interface was already stripped of `canvasWidth`/`canvasHeight` in Plan 01 (Wave 1), so this plan starts from a clean interface and focuses on render logic only.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-data-integrity/01-CONTEXT.md
@.planning/phases/01-data-integrity/01-RESEARCH.md
@.planning/phases/01-data-integrity/01-01-SUMMARY.md
@src/components/FloorPlan.tsx
@src/config/floorPlan.json

<interfaces>
Post-Plan-01 JSON shape (input to this plan):
```json
{
  "imageFileName": "Reception Seat Diagram.png",
  "tablePositions": { "1": { "x": 0.2758, "y": 0.3854 }, ... }
}
```

Post-Plan-01 TypeScript interface (already in place — do not re-edit):
```typescript
interface TablePosition { x: number; y: number; }
interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}
```

Render formula (normal view):
  left = position.x * imageWidth
  top  = position.y * imageHeight

Render formula (enlarged view):
  left = enlargedDimensions.offsetX + position.x * enlargedDimensions.width
  top  = enlargedDimensions.offsetY + position.y * enlargedDimensions.height
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch FloorPlan.tsx render sites to percentage-based scaling with imageHeight + ResizeObserver</name>
  <files>src/components/FloorPlan.tsx</files>
  <read_first>
    - src/components/FloorPlan.tsx (full current file — 2 marker render sites; `FloorPlanConfig` interface already post-Plan-01)
    - src/config/floorPlan.json (post-Plan-01 percentage shape)
    - .planning/phases/01-data-integrity/01-RESEARCH.md (sections: "FloorPlan.tsx Scaling Rewrite", "Duplicate Coordinate Validation", "Pitfall 2/5/6")
    - .planning/phases/01-data-integrity/01-CONTEXT.md (D-05)
    - .planning/phases/01-data-integrity/01-01-SUMMARY.md (confirms interface already cleaned)
  </read_first>
  <action>
    Modify `src/components/FloorPlan.tsx` as follows. Preserve existing code style (2-space indent, single quotes in TS, semicolons, `function` declarations, default export, PascalCase interfaces).

    NOTE: The `FloorPlanConfig` interface was already updated in Plan 01 Task 1 (Wave 1) to drop `canvasWidth`/`canvasHeight`. Do NOT re-edit the interface — it is already in the target shape. This task focuses on render logic and state.

    1. Add `imageHeight` state alongside `imageWidth`:
       ```typescript
       const [imageWidth, setImageWidth] = useState(0);
       const [imageHeight, setImageHeight] = useState(0);
       ```

    2. Update `handleImageLoad` to capture both dimensions:
       ```typescript
       const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
         setImageWidth(e.currentTarget.offsetWidth);
         setImageHeight(e.currentTarget.offsetHeight);
         setImageLoaded(true);
       };
       ```

    3. Add a `ResizeObserver` in a `useEffect` that watches the normal-view `<img>` and updates `imageWidth`/`imageHeight` on resize. Use a `useRef<HTMLImageElement>(null)` attached to the img via `ref={imageRef}`. Clean up observer on unmount (per RESEARCH "Window Resize Handling" Option 2 RESOLVED):
       ```typescript
       const imageRef = useRef<HTMLImageElement>(null);
       useEffect(() => {
         const el = imageRef.current;
         if (!el) return;
         const ro = new ResizeObserver((entries) => {
           for (const entry of entries) {
             setImageWidth(entry.contentRect.width);
             setImageHeight(entry.contentRect.height);
           }
         });
         ro.observe(el);
         return () => ro.disconnect();
       }, []);
       ```

    4. REMOVE the `scaleFactor` and `enlargedScaleFactor` lines entirely (they compute against the now-removed `config.canvasWidth`). If these reads were already removed as part of Plan 01's build-green fallback, this step is a no-op.

    5. Update the normal-view marker site (currently lines 107-118) to use percentage math:
       ```tsx
       {imageLoaded && position && imageWidth > 0 && imageHeight > 0 && (
         <div
           className="point-marker"
           data-table-id={tableNumber}
           style={{
             left: `${position.x * imageWidth}px`,
             top: `${position.y * imageHeight}px`,
           }}
         >
           <div className="point-pulse" />
         </div>
       )}
       ```

    6. Update `handleEnlargedImageLoad` to derive aspect from the loaded image, not the dropped canvas fields:
       ```typescript
       const imageAspect = img.naturalWidth / img.naturalHeight;
       ```
       (Replace the existing `config.canvasWidth / config.canvasHeight` line if still present. The rest of the function — containerAspect branching, offsetX/offsetY, setEnlargedDimensions — stays identical.)

    7. Update the enlarged-view marker site (currently lines 147-158) to percentage math:
       ```tsx
       {imageLoaded && position && enlargedDimensions.width > 0 && (
         <div
           className="point-marker"
           data-table-id={tableNumber}
           style={{
             left: `${enlargedDimensions.offsetX + position.x * enlargedDimensions.width}px`,
             top: `${enlargedDimensions.offsetY + position.y * enlargedDimensions.height}px`,
           }}
         >
           <div className="point-pulse" />
         </div>
       )}
       ```

    8. Add a dev-only duplicate-coordinate warning at module scope (after `const config: FloorPlanConfig = floorPlanConfig;`). This runs once at import time and is tree-shaken from prod builds via `import.meta.env.DEV` (per RESEARCH "Duplicate Coordinate Validation"):
       ```typescript
       if (import.meta.env.DEV) {
         const seen = new Map<string, string>();
         for (const [id, pos] of Object.entries(config.tablePositions)) {
           const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`;
           if (seen.has(key)) {
             console.warn(`Duplicate table position: ${id} and ${seen.get(key)} at ${key}`);
           }
           seen.set(key, id);
         }
       }
       ```

    9. Add `useRef` to the existing React import line: `import { useEffect, useState, useCallback, useRef } from 'react';`.

    10. Attach `ref={imageRef}` to the normal-view `<img>` tag (the one inside `.canvas-container`, not the enlarged one).

    DO NOT touch FloorPlan.css. DO NOT rename any classes. DO NOT change the enlarged view's onClick/escape/close logic. DO NOT re-edit the `FloorPlanConfig` interface (already handled in Plan 01).
  </action>
  <verify>
    <automated>npm run lint && npm run build</automated>
    Manual verification (required before sign-off):
    - `npm run dev` → search any guest → marker appears centered on the correct table in normal view
    - Click to enlarge → marker still aligned in enlarged view
    - Drag browser window from ~400px to ~1400px wide → marker tracks the table (does not drift)
    - Check dev console — no duplicate-coord warning should fire after the 46/47 fix (Plan 01)
  </verify>
  <acceptance_criteria>
    - `src/components/FloorPlan.tsx` does NOT contain the substring `canvasWidth`
    - `src/components/FloorPlan.tsx` does NOT contain the substring `canvasHeight`
    - `src/components/FloorPlan.tsx` does NOT contain the substring `scaleFactor`
    - `src/components/FloorPlan.tsx` contains the substring `imageHeight`
    - `src/components/FloorPlan.tsx` contains the substring `ResizeObserver`
    - `src/components/FloorPlan.tsx` contains the substring `import.meta.env.DEV`
    - `src/components/FloorPlan.tsx` contains the substring `img.naturalWidth / img.naturalHeight`
    - `src/components/FloorPlan.tsx` contains the substring `position.x * imageWidth`
    - `src/components/FloorPlan.tsx` contains the substring `position.y * imageHeight`
    - `npm run lint` exits 0
    - `npm run build` exits 0
    - `grep -rn "canvasWidth\|canvasHeight" src/` returns zero matches
  </acceptance_criteria>
  <done>
    FloorPlan renders markers from percentage coordinates in both views, resizes robustly via ResizeObserver, has no lingering references to the dropped canvas fields, and warns in dev about duplicate coordinates. Lint and build are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Pure client-side refactor of an existing component. No new external inputs, no new auth surface, no new secrets, no new network calls. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-02-01 | Denial of Service | ResizeObserver in FloorPlan.tsx | mitigate | Observer is attached to a single element and disconnected on unmount; callback only calls setState with rect dims (no loops, no fetches). |
| T-01-02-02 | Information Disclosure | dev-only console.warn for duplicate coordinates | accept | Guarded by `import.meta.env.DEV`, tree-shaken from production bundle. Logs only table numbers (non-PII). |
</threat_model>

<verification>
- `npm run lint` exits 0
- `npm run build` exits 0
- No grep hits for `canvasWidth` or `canvasHeight` anywhere under `src/`
- Manual browser check: marker stays on table across normal view, enlarged view, and window resize
</verification>

<success_criteria>
Phase success criterion 2 ("resizing the browser window or changing the floor plan image does not shift any table marker off its correct position") is satisfied. Tables 46 and 47 render in visibly distinct positions (criterion 1) thanks to Plan 01 + this plan's correct scaling.
</success_criteria>

<output>
After completion, create `.planning/phases/01-data-integrity/01-02-SUMMARY.md` per template.
</output>
