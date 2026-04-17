# Phase 3: Map Experience — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 9 (7 new/modified + 2 deleted)
**Analogs found:** 7 / 7 (deleted files have no analog needed)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/MapView.tsx` | container component | request-response + event-driven | `src/components/FloorPlan.tsx` + `src/components/TableModal.tsx` | role-match (combined) |
| `src/components/MapView.css` | stylesheet | n/a | `src/components/TableModal.css` (overlay) + `src/components/FloorPlan.css` (animations) | role-match (combined) |
| `src/components/FloorPlan.tsx` (modified) | presentational component | request-response | `src/components/FloorPlan.tsx` (current) | exact (before state) |
| `src/components/FloorPlan.css` (modified) | stylesheet | n/a | `src/components/FloorPlan.css` (current) | exact (before state) |
| `src/App.tsx` (modified) | container / root | request-response | `src/App.tsx` (current) | exact (before state) |
| `scripts/generate-images.mjs` | build script | file-I/O | none — greenfield | no analog |
| `vitest.config.ts` | config | n/a | `vite.config.ts` | partial (file shape only) |
| `src/test/setup.ts` | test config | n/a | none — greenfield | no analog |
| `src/components/MapView.test.tsx` | test | n/a | none — greenfield | no analog |
| `src/App.test.tsx` | test | n/a | none — greenfield | no analog |
| `package.json` (modified) | config | n/a | `package.json` (current) | exact (before state) |

---

## Pattern Assignments

### `src/components/MapView.tsx` (container component, request-response + event-driven)

**Primary analog:** `src/components/FloorPlan.tsx`
**Secondary analog:** `src/components/TableModal.tsx`

MapView merges the overlay pattern from TableModal (fixed overlay, escape-to-close, onClose prop) with the image/marker rendering from FloorPlan (imageLoaded guard, percentage coords, hasValidPosition fallback). It adds TransformWrapper, history integration, and the animation sequence.

**Props interface pattern** — copy from TableModal lines 6–9, extend for MapView:
```tsx
// TableModal.tsx lines 6-9
interface TableModalProps {
  guest: Guest;
  onClose: () => void;
}
// MapView follows the same shape exactly — same prop names, same types
```

**Imports pattern** — combine both analogs:
```tsx
// TableModal.tsx lines 1-4 (imports)
import { useEffect } from 'react';
import { Guest } from '../types';
import FloorPlan from './FloorPlan';
import './TableModal.css';

// FloorPlan.tsx lines 1-5 (imports)
import { useEffect, useState, useCallback, useRef } from 'react';
import './FloorPlan.css';
import floorPlanConfig from '../config/floorPlan.json';
import floorPlanImageSrc from '../assets/Reception Seat Diagram.png';

// MapView.tsx imports (executor assembles from both + new library):
// import { useEffect, useRef, useCallback } from 'react';
// import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
// import { Guest } from '../types';
// import floorPlanConfig from '../config/floorPlan.json';
// import './MapView.css';
// NOTE: No direct image import — public/ files are referenced as '/floor-plan/...' strings
```

**Escape-to-close pattern** — copy verbatim from TableModal lines 12–22:
```tsx
// TableModal.tsx lines 12-22 — the canonical escape-to-close pattern in this codebase
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

**History back-button pattern** — new to this codebase; add as a second useEffect alongside escape-to-close:
```tsx
// Pattern from RESEARCH.md Pattern 6 — no existing analog in codebase
useEffect(() => {
  history.pushState({ mapOpen: true }, '');

  function handlePopState() {
    onClose();
  }

  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
    if (history.state?.mapOpen) {
      history.back();
    }
  };
}, [onClose]);
```

**hasValidPosition fallback pattern** — copy from FloorPlan lines 41–42:
```tsx
// FloorPlan.tsx lines 41-42
const position = config.tablePositions[tableNumber];
const hasValidPosition = Boolean(position);
// MapView reads tableNumber from guest.tableNumber and applies same guard
```

**DEV duplicate-position warning** — copy from FloorPlan lines 23–32 (keep as regression guard):
```tsx
// FloorPlan.tsx lines 23-32
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
// Place this block at module scope in FloorPlan.tsx (it moves with the config import)
```

**useRef pattern** — copy from FloorPlan line 40:
```tsx
// FloorPlan.tsx line 40
const imageRef = useRef<HTMLImageElement>(null);
// MapView needs two refs: transformRef and assignedPinRef
// const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
// const assignedPinRef = useRef<HTMLDivElement | null>(null);
```

**imageLoaded guard + onLoad handler** — copy from FloorPlan lines 35, 44–48:
```tsx
// FloorPlan.tsx lines 35, 44-48
const [imageLoaded, setImageLoaded] = useState(false);

const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  setImageWidth(e.currentTarget.offsetWidth);
  setImageHeight(e.currentTarget.offsetHeight);
  setImageLoaded(true);
};
// MapView version: setImageLoaded(true) only — no pixel dimensions needed
// (percentage positioning via CSS left/top % replaces pixel math)
// Zoom sequence fires here after 250ms setTimeout
```

**useCallback pattern** — copy from FloorPlan lines 95–97:
```tsx
// FloorPlan.tsx lines 95-97
const handleClose = useCallback(() => {
  setIsEnlarged(false);
}, []);
// MapView: handleClose wraps onClose() in useCallback if passed to child
```

**Percentage-coordinate marker positioning** — copy from FloorPlan lines 129–140, switching to % CSS:
```tsx
// FloorPlan.tsx lines 129-140 (current pixel approach — being replaced)
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

// New pattern (RESEARCH.md Pattern 7) — percentage CSS, no pixel state needed:
// style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
// The wrapping div must be position: relative; display: inline-block
```

**Close button JSX** — copy from TableModal lines 27–29, then upgrade to 44px per UI-SPEC:
```tsx
// TableModal.tsx lines 27-29
<button className="close-button" onClick={onClose}>
  &times;
</button>
// MapView rename: className="map-close-button", add aria-label="Close map" title="Close map (Esc)"
```

**Conditional description render** — copy from TableModal lines 37–41:
```tsx
// TableModal.tsx lines 37-41
{guest.description && (
  <div className="guest-message">
    {guest.description}
  </div>
)}
// MapView version: className="map-overlay-card-description", copy conditional pattern exactly
```

**Component declaration shape** — follow CLAUDE.md: `function` declaration, default export, props destructured:
```tsx
// TableModal.tsx line 11 (canonical shape)
export default function TableModal({ guest, onClose }: TableModalProps) {
// MapView follows same shape:
// export default function MapView({ guest, onClose }: MapViewProps) {
```

---

### `src/components/MapView.css` (stylesheet)

**Primary analog:** `src/components/TableModal.css` (overlay + animation patterns)
**Secondary analog:** `src/components/FloorPlan.css` (keyframes, close button, marker patterns)

**fadeIn keyframe** — copy verbatim from TableModal.css lines 16–23:
```css
/* TableModal.css lines 16-23 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**slideUp keyframe** — copy from TableModal.css lines 38–47, adapt to slide-down (8px) for overlay card:
```css
/* TableModal.css lines 38-47 */
@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
/* MapView slide-down variant for overlay card:
@keyframes slide-down {
  from { transform: translateY(-8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
} */
```

**Full-screen overlay pattern** — copy from FloorPlan.css lines 113–126, upgrade to `inset: 0`:
```css
/* FloorPlan.css lines 113-126 */
.floor-plan-enlarged-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}
/* MapView version uses position: fixed; inset: 0 (shorthand), black background, no padding,
   overscroll-behavior: contain, touch-action: none per D-17 */
```

**Close button pattern** — copy from FloorPlan.css lines 142–167 (has position: absolute, size, border-radius: 50%); upgrade to fixed + safe-area + 44px per UI-SPEC:
```css
/* FloorPlan.css lines 142-167 */
.floor-plan-close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(239, 35, 60, 0.9);
  color: white;
  border: none;
  font-size: 2rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s ease;
  line-height: 1;
  padding: 0;
}
/* MapView version: position: fixed, top: max(16px, env(safe-area-inset-top)),
   right: max(16px, env(safe-area-inset-right)), width/height: 44px,
   background: rgba(43, 45, 66, 0.7) (NOT red — per UI-SPEC color contract),
   z-index: 110 */
```

**Pulse keyframe** — copy from FloorPlan.css lines 71–80 as the base; the new `pin-pulse` is a refinement:
```css
/* FloorPlan.css lines 71-80 */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}
/* New pin-pulse keyframe (UI-SPEC spec): scale 1.0→1.15→1.0, opacity 0.6→0.0→0.6, 1.2s, ease-in-out:
@keyframes pin-pulse {
  0%, 100% { transform: scale(1);    opacity: 0.6; }
  50%       { transform: scale(1.15); opacity: 0.0; }
}
Add @media (prefers-reduced-motion: reduce) { .pin-pulse-ring { animation: none; } } */
```

**Mobile breakpoint** — copy from FloorPlan.css line 200 (every CSS file uses this exact breakpoint):
```css
/* FloorPlan.css line 200, TableModal.css line 137 — identical pattern across all files */
@media (max-width: 600px) {
  /* component-specific overrides */
}
```

**BEM-ish class naming convention** — observe from existing files:
```css
/* Existing: floor-plan-container, floor-plan-header, floor-plan-close-button */
/* New classes follow same pattern: map-surface, map-overlay-card, map-close-button,
   map-overlay-card-greeting, map-overlay-card-description,
   pin-assigned, pin-dot, pin-label */
```

**backdrop-filter + solid fallback** — new to this codebase; from UI-SPEC:
```css
/* MapView pattern (no existing analog — follow App.css card as reference for blur): */
/* App.css line 32: backdrop-filter: blur(10px) on .card — same technique */
.map-overlay-card {
  background: rgba(43, 45, 66, 0.9);
  backdrop-filter: blur(8px);
  /* fallback: @supports not (backdrop-filter: blur(1px)) { background: #2b2d42; } */
}
```

---

### `src/components/FloorPlan.tsx` (MODIFIED — reduced scope)

**Analog:** `src/components/FloorPlan.tsx` (current file — this IS the before state)

**What survives (keep these patterns):**

Config import + FloorPlanConfig interface (lines 3–4, 16–19):
```tsx
// FloorPlan.tsx lines 3-4, 16-19 — KEEP
import floorPlanConfig from '../config/floorPlan.json';

interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}
```

DEV duplicate-position warning (lines 23–32) — KEEP as-is.

hasValidPosition guard (lines 41–42) — KEEP, used for fallback rendering.

**What gets removed:**

- `useState` for `imageWidth`, `imageHeight`, `isEnlarged`, `enlargedDimensions` (lines 36–39) — ResizeObserver pixel-tracking replaced by CSS percentage positioning.
- `imageRef` (line 40) — no longer needed when using percentage coords.
- `handleImageLoad` pixel-capture version (lines 44–48) — replaced by a simple `() => setImageLoaded(true)`.
- The entire `ResizeObserver` useEffect (lines 50–61) — removed per RESEARCH.md Pattern 7.
- `handleEnlargedImageLoad`, `handleEnlarge`, `handleClose`, escape useEffect (lines 63–111) — the enlarged modal is superseded by MapView.
- The `isEnlarged` conditional JSX block (lines 152–184) — deleted.
- The `.floor-plan-header`, `.floor-plan-legend`, `.canvas-container` click handler — removed.

**New marker positioning pattern** (replaces lines 129–140):
```tsx
// NEW: percentage CSS, no pixel state — from RESEARCH.md Pattern 7
// Place markers inside a position: relative wrapper alongside <picture>
{Object.entries(config.tablePositions).map(([id, pos]) => (
  <div
    key={id}
    className={id === tableNumber ? 'pin-assigned' : 'pin-dot'}
    data-table-id={id}
    ref={id === tableNumber ? assignedPinRef : undefined}
    style={{
      position: 'absolute',
      left: `${pos.x * 100}%`,
      top:  `${pos.y * 100}%`,
    }}
  >
    {/* assigned: inline SVG teardrop + pulse ring */}
    {/* others: nothing extra — CSS handles the dot shape */}
    <span className="pin-label">{id}</span>
  </div>
))}
```

**New props shape** — FloorPlan now accepts both `tableNumber` (assigned) and `assignedPinRef` passed down from MapView:
```tsx
// Current: interface FloorPlanProps { tableNumber: string; }
// New: interface FloorPlanProps {
//   tableNumber: string;
//   assignedPinRef: React.RefObject<HTMLDivElement | null>;
// }
// Component signature: export default function FloorPlan({ tableNumber, assignedPinRef }: FloorPlanProps)
```

**imageLoaded simplified handler** — from FloorPlan line 44 approach, stripped to essentials:
```tsx
// Current (lines 44-48): captures pixel dimensions
const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  setImageWidth(e.currentTarget.offsetWidth);
  setImageHeight(e.currentTarget.offsetHeight);
  setImageLoaded(true);
};
// New (no pixel capture needed):
// const handleImageLoad = () => setImageLoaded(true);
// onLoad fires; MapView's handleImageLoad fires the zoom sequence
// FloorPlan only needs: imageLoaded boolean to guard marker render
```

---

### `src/components/FloorPlan.css` (MODIFIED)

**Analog:** `src/components/FloorPlan.css` (current file — before state)

**What survives:**

`.canvas-container` base (lines 20–29) — keep `position: relative`, `overflow: hidden`, `box-shadow`.

**What gets removed:**

- `.point-marker` (lines 37–45) — replaced by `.pin-assigned` + `.pin-dot`
- `.point-pulse` + `::after` (lines 47–69) — replaced by `.pin-pulse-ring` keyframe
- `@keyframes pulse` + `@keyframes ripple` (lines 71–91) — replaced by `@keyframes pin-pulse`
- All enlarged-overlay styles (lines 113–197): `.floor-plan-enlarged-overlay`, `.floor-plan-enlarged-content`, `.floor-plan-close-button`, `.floor-plan-enlarged-header`, `.canvas-container-enlarged`, `.floor-plan-image-enlarged` — these move into MapView.css

**New classes to add:**

```css
/* Replaces .point-marker — assigned table teardrop host */
.pin-assigned {
  position: absolute;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -100%); /* anchor = bottom tip */
  pointer-events: none;              /* D-12: visual only */
  z-index: 10;
}

/* Replaces .point-pulse approach — muted slate dot for all other tables */
.pin-dot {
  position: absolute;
  width: 44px;   /* tap target footprint */
  height: 44px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pin-dot::before {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #8d99ae;
  border: 1px solid #ffffff;
}

/* Adaptive neighbor labels — hidden by default, fade in when .labels-visible applied */
.pin-label {
  position: absolute;
  top: calc(100% + 2px); /* 16px below dot center via parent transform */
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  color: #2b2d42;
  text-shadow: 0 0 3px #fff, 0 0 3px #fff;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

/* Applied by useTransformComponent when scale >= 1.8 */
.labels-visible .pin-dot .pin-label {
  opacity: 1;
}
```

**Mobile breakpoint** — copy structural pattern from lines 200–250 of current file; adjust for new class names.

---

### `src/App.tsx` (MODIFIED)

**Analog:** `src/App.tsx` (current file — before state)

**Current selectedGuest state + TableModal render block** (lines 17, 97–99) — this is exactly what gets swapped:
```tsx
// App.tsx line 17 — KEEP unchanged
const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

// App.tsx lines 97-99 — REPLACE this block
{selectedGuest && (
  <TableModal guest={selectedGuest} onClose={closeModal} />
)}
// Replace with:
// {selectedGuest && (
//   <MapView key={selectedGuest.tableNumber} guest={selectedGuest} onClose={closeModal} />
// )}
// Note: key={selectedGuest.tableNumber} forces remount on guest switch (RESEARCH.md Pitfall 5)
```

**Current import block** (lines 1–9) — update imports:
```tsx
// App.tsx lines 1-9 (current)
import { useState, useEffect, useMemo } from 'react';
import { Guest } from './types';
import { fetchGuests } from './services/googleSheets';
import { buildGuestIndex, searchGuests, type RankedGuest } from './services/searchGuests';
import SearchForm from './components/SearchForm';
import GuestDropdown from './components/GuestDropdown';
import TableModal from './components/TableModal';  // ← DELETE this line
import backgroundImage from './assets/mahsompw-6074Z70_6074.jpeg';
import './App.css';
// Add: import MapView from './components/MapView';
```

**Image preload useEffect** — new to this codebase; add as a second useEffect after the existing guests-load one. Pattern from RESEARCH.md Pattern 5:
```tsx
// App.tsx line 21 (current useEffect — KEEP)
useEffect(() => {
  loadGuests();
}, []);

// Add second useEffect for image preload (mount only, fires alongside loadGuests):
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/avif';
  link.setAttribute('imagesrcset',
    '/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w'
  );
  link.setAttribute('imagesizes', '100vw');
  (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
  document.head.appendChild(link);
  return () => { document.head.removeChild(link); };
}, []);
```

**Belt-and-suspenders hidden img** — add to JSX, always in DOM:
```tsx
// Add inside App's return JSX (outside the .app-container, or as first child):
<img src="/floor-plan/floor-plan-1600.avif" style={{ display: 'none' }} aria-hidden="true" alt="" />
```

**handleGuestSelect + closeModal contract** (lines 43–49) — KEEP both functions unchanged:
```tsx
// App.tsx lines 43-49 — no changes needed
function handleGuestSelect(guest: Guest) {
  setSelectedGuest(guest);
}

function closeModal() {
  setSelectedGuest(null);
}
```

---

### `scripts/generate-images.mjs` (NEW — greenfield)

**Analog:** None in this codebase.

**Convention notes from CLAUDE.md + RESEARCH.md:**
- File extension `.mjs` — Node.js ESM module (matches `"type": "module"` in package.json)
- Node.js v22.14.0 available (RESEARCH.md Environment Availability)
- Installed as devDependency: `sharp@0.34.5`
- Output dir: `public/floor-plan/` (create if not exists)
- Source: `src/assets/Reception Seat Diagram.png`
- 9 variants: widths [900, 1600, 2400] × formats [avif, webp, png]

**Script shape from RESEARCH.md Pattern 4** — use as the direct template:
```js
// scripts/generate-images.mjs
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../src/assets/Reception Seat Diagram.png');
const out = resolve(__dirname, '../public/floor-plan');

mkdirSync(out, { recursive: true });

const widths = [900, 1600, 2400];
const formats = [
  { ext: 'avif', opts: { quality: 50 } },
  { ext: 'webp', opts: { quality: 80 } },
  { ext: 'png',  opts: { compressionLevel: 9 } },
];

for (const width of widths) {
  for (const { ext, opts } of formats) {
    await sharp(src)
      .resize(width)
      [ext](opts)
      .toFile(resolve(out, `floor-plan-${width}.${ext}`));
    console.log(`Generated floor-plan-${width}.${ext}`);
  }
}
```

**package.json script entry** — add to `"scripts"`:
```json
"generate-images": "node scripts/generate-images.mjs"
```

---

### `vitest.config.ts` (NEW — greenfield)

**Analog:** `vite.config.ts` (file shape only — not content)

**vite.config.ts shape** (full file, lines 1–7):
```ts
// vite.config.ts — use as structural template for vitest.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**vitest.config.ts shape** — follows same `defineConfig` + `export default` pattern:
```ts
// vitest.config.ts (new file — same structural shape as vite.config.ts)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

**Convention notes:**
- Named import `defineConfig` from the test framework package (matches `vite.config.ts` line 1)
- `export default defineConfig(...)` (matches `vite.config.ts` line 5)
- 2-space indent, single quotes — matches CLAUDE.md code style

---

### `src/test/setup.ts` (NEW — greenfield)

**Analog:** None in this codebase.

**Content:** Standard @testing-library/jest-dom bootstrap. No project-specific patterns exist to copy — use the library's documented setup:
```ts
// src/test/setup.ts
import '@testing-library/jest-dom';
```

---

### `src/components/MapView.test.tsx` and `src/App.test.tsx` (NEW — greenfield)

**Analog:** None in this codebase — no existing tests. Test infrastructure is created in Wave 0.

**Convention notes:**
- Files co-located with component (MapView.test.tsx next to MapView.tsx) — matches PascalCase component file pattern
- App.test.tsx at `src/` level alongside App.tsx
- Use `vitest` globals (`describe`, `it`, `expect`, `vi`) — available via `globals: true` in vitest.config.ts
- Import pattern for components: `import MapView from './MapView'` (no extension, per CLAUDE.md — except main.tsx)
- Mock `react-zoom-pan-pinch` ref methods with `vi.fn()`

**Key test cases per RESEARCH.md Validation Architecture:**
- `MapView.test.tsx`: `zoomToElement` called after 250ms hold + image load; fallback text when tableNumber not in config
- `App.test.tsx`: preload `<link>` injected into `<head>` on mount

---

### `package.json` (MODIFIED)

**Analog:** `package.json` (current file — before state)

**Current scripts block** (lines 5–10) — exact text to extend:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
},
```
Add after `"lint"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"generate-images": "node scripts/generate-images.mjs"
```

**Current dependencies block** (lines 11–15) — exact text, add one entry:
```json
"dependencies": {
  "fuse.js": "^7.3.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
},
```
Add: `"react-zoom-pan-pinch": "^4.0.3"`

**Current devDependencies block** (lines 16–28) — exact text, add entries:
```json
"devDependencies": {
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
  "@typescript-eslint/eslint-plugin": "^8.15.0",
  "@typescript-eslint/parser": "^8.15.0",
  "@vitejs/plugin-react": "^4.3.4",
  "baseline-browser-mapping": "^2.10.15",
  "eslint": "^9.15.0",
  "eslint-plugin-react-hooks": "^5.0.0",
  "eslint-plugin-react-refresh": "^0.4.14",
  "typescript": "~5.6.2",
  "vite": "^6.0.1"
}
```
Add:
```json
"@testing-library/react": "^16.3.2",
"@testing-library/user-event": "^14.0.0",
"@testing-library/jest-dom": "^6.0.0",
"@types/node": "^22.0.0",
"jsdom": "^26.0.0",
"sharp": "^0.34.5",
"vitest": "^4.1.4"
```

---

## Shared Patterns

### Function declaration shape (all components)
**Source:** `src/components/TableModal.tsx` line 11, `src/components/FloorPlan.tsx` line 34
**Apply to:** MapView.tsx, modified FloorPlan.tsx
```tsx
// Use function declarations (not arrow functions), default export, props destructured
export default function ComponentName({ prop1, prop2 }: ComponentNameProps) {
```

### CSS import as side-effect
**Source:** `src/components/FloorPlan.tsx` line 2, `src/components/TableModal.tsx` line 4
**Apply to:** MapView.tsx
```tsx
import './MapView.css';
```

### Event handler naming (`handle*` prefix)
**Source:** `src/components/FloorPlan.tsx` lines 44, 63, 91, 95; `src/App.tsx` lines 38, 43, 47
**Apply to:** All new event handlers in MapView.tsx
```tsx
// Correct: handleImageLoad, handleClose, handleKeyDown, handlePopState
// Not: onImageLoad, closeHandler, keyDown
```

### Callback prop naming (`on*` prefix)
**Source:** `src/components/TableModal.tsx` line 8 (`onClose`); `src/App.tsx` line 43 (`onSelect`)
**Apply to:** MapView props interface
```tsx
// Correct: onClose (not closeCallback, close, handleModalClose)
```

### Error handling in async functions
**Source:** `src/App.tsx` lines 26–36
**Apply to:** Any async code added (not applicable in MapView itself — no async ops; applies to App.tsx preload if needed)
```tsx
// App.tsx lines 26-36
async function loadGuests() {
  try {
    setLoading(true);
    const guestData = await fetchGuests();
    setGuests(guestData);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load guests');
  } finally {
    setLoading(false);
  }
}
```

### Palette hex values (all CSS files)
**Source:** `src/App.css`, `src/components/FloorPlan.css`, `src/components/TableModal.css`
**Apply to:** MapView.css, modified FloorPlan.css
```
#2b2d42  — dark navy (overlay card background base, text)
#d90429  — deep red (assigned pin fill ONLY per UI-SPEC)
#ef233c  — bright red (existing pulse uses this; pin-pulse can use #d90429 per UI-SPEC)
#8d99ae  — muted slate (non-assigned dots, description text de-emphasis)
#edf2f4  — light gray (description text color on dark card background)
#ffffff  — white (pin number text, close button glyph, greeting text)
```

### Mobile breakpoint (all CSS files)
**Source:** `src/components/FloorPlan.css` line 200, `src/components/TableModal.css` line 137, `src/App.css` line 99
**Apply to:** MapView.css, modified FloorPlan.css
```css
@media (max-width: 600px) {
  /* all mobile overrides in this project use exactly this query */
}
```

### Transition timing conventions
**Source:** `src/components/TableModal.css` line 64, `src/components/FloorPlan.css` line 160
**Apply to:** MapView.css close button hover, label fade
```css
transition: all 0.2s ease;  /* hover/interaction states: 0.2s ease */
transition: ... 0.3s ease;  /* mount animations: 0.3s ease */
```

### border-radius scale
**Source:** `src/App.css` line 37 (20px cards), `src/components/FloorPlan.css` line 11 (10px), `src/components/TableModal.css` line 63 (50% circles)
**Apply to:** MapView.css
```
10px — inputs, small cards, overlay card (per UI-SPEC)
20px — major containers (not applicable in MapView — full viewport)
50%  — close button circle (per UI-SPEC)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/generate-images.mjs` | build script | file-I/O | No Node.js scripts exist in codebase; use RESEARCH.md Pattern 4 as template |
| `vitest.config.ts` | config | n/a | No test config exists; use `vite.config.ts` for file shape only |
| `src/test/setup.ts` | test bootstrap | n/a | No test infrastructure exists; use @testing-library/jest-dom docs |
| `src/components/MapView.test.tsx` | test | n/a | No tests exist in codebase; use RESEARCH.md Validation Architecture section |
| `src/App.test.tsx` | test | n/a | Same — no tests exist |

---

## Metadata

**Analog search scope:** `src/components/`, `src/`, `vite.config.ts`, `package.json`
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-04-16
