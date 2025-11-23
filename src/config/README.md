# Floor Plan Configuration

This folder contains the configuration for the interactive floor plan feature.

## Updating the Floor Plan

### To update table coordinates ONLY:

1. Open `floorPlan.json`
2. Update the `tablePositions` object with new coordinates
3. Save and commit - done!

**Format:**
```json
"tablePositions": {
  "1": { "x": 910, "y": 970 },
  "2": { "x": 1633, "y": 973 }
}
```

### To replace the floor plan image:

**Step 1: Update the config file**
1. Add your new image to `src/assets/`
2. Open `floorPlan.json`
3. Update `imageFileName` with the new filename
4. Update `canvasWidth` and `canvasHeight` to match your new image dimensions

**Example:**
```json
{
  "imageFileName": "New Floor Plan.png",
  "canvasWidth": 4000,
  "canvasHeight": 3000
}
```

**Step 2: Update the import statement**
1. Open `src/components/FloorPlan.tsx`
2. Find line 5 (the image import)
3. Update the import path to match your new image filename

**Example:**
```typescript
// Change this line:
import floorPlanImageSrc from '../assets/Reception Seat Diagram.png';

// To this:
import floorPlanImageSrc from '../assets/New Floor Plan.png';
```

### Finding Image Dimensions:

- **Mac**: Right-click image → Get Info → Look for "Dimensions"
- **Windows**: Right-click image → Properties → Details tab
- **Any OS**: Open in image viewer - usually shows dimensions in title bar

### Finding Table Coordinates:

You can use any image editing tool to find pixel coordinates:

1. **Preview (Mac)**:
   - Open image in Preview
   - Tools → Show Inspector
   - Hover over table location, coordinates shown at bottom

2. **Paint (Windows)**:
   - Open image in Paint
   - Hover over table location
   - Coordinates shown at bottom left

3. **GIMP (Free, any OS)**:
   - Open image
   - Window → Dockable Dialogs → Pointer
   - Hover over table location

4. **Online Tools**:
   - Upload to https://www.image-map.net/
   - Click on each table to get coordinates

### Quick Update Template:

Copy and paste this format into `tablePositions`:

```
Table 1    x, y
Table 2    x, y
Table 3    x, y
...
```

The system will automatically convert these to the JSON format needed.

## Current Configuration

- **Image**: Reception Seat Diagram.png
- **Canvas Size**: 3300 × 2517 pixels
- **Number of Tables**: 54
