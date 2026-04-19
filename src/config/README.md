# Floor Plan Configuration

This folder contains the configuration for the interactive floor plan feature.

## Coordinate System

Table positions are stored as **percentages** (floats in `[0, 1]`) relative to the floor plan image. `x` is the horizontal fraction from the left edge; `y` is the vertical fraction from the top edge. At render time, the app multiplies each percentage by the displayed image's pixel dimensions, so coordinates automatically stay correct when the image is resized or replaced with a differently sized file (as long as the table locations within the image haven't moved).

## Updating the Floor Plan

### To update table coordinates ONLY:

1. Open `floorPlan.json`
2. Update the `tablePositions` object with new percentage coordinates (4 decimals recommended)
3. Save and commit - done!

**Format:**
```json
"tablePositions": {
  "1": { "x": 0.2758, "y": 0.3854 },
  "2": { "x": 0.4948, "y": 0.3866 }
}
```

### To replace the floor plan image:

**Step 1: Update the config file**
1. Add your new image to `src/assets/`
2. Open `floorPlan.json`
3. Update `imageFileName` with the new filename

**Example:**
```json
{
  "imageFileName": "New Floor Plan.png",
  "tablePositions": { ... }
}
```

**Step 2: Update the import statement**
1. Open `src/components/FloorPlan.tsx`
2. Find the image import (near the top of the file)
3. Update the import path to match your new image filename

**Example:**
```typescript
// Change this line:
import floorPlanImageSrc from '../assets/Reception Seat Diagram.png';

// To this:
import floorPlanImageSrc from '../assets/New Floor Plan.png';
```

**Step 3: Re-map tables if layout changed**
- If the new image has the same layout at a different resolution: no changes needed to `tablePositions` (percentages are resolution-independent).
- If tables moved: re-measure each table's percentage position (see below).

### Finding Table Coordinates (as percentages):

Measure each table in pixels on the source image, then divide by the image's width/height.

1. **Preview (Mac)**:
   - Open image in Preview → Tools → Show Inspector
   - Hover over the table; note the pixel x/y shown
   - Divide by image width (for x) and height (for y)

2. **Paint (Windows)**:
   - Open image in Paint, hover over table
   - Pixel coordinates shown at bottom left
   - Divide by image dimensions

3. **Online Tools**:
   - Upload to https://www.image-map.net/
   - Click on each table to get pixel coordinates, then convert

**Example:** Image is 3300×2517. Table 1 at pixel (910, 970) → `{ "x": 910/3300, "y": 970/2517 }` = `{ "x": 0.2758, "y": 0.3854 }`.

## Current Configuration

- **Image**: Reception Seat Diagram.png
- **Number of Tables**: 54
- **Coordinate System**: Percentages (0-1)
