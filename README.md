# Seat-Finder

A streamlined, mobile-friendly seat-lookup app built for the wedding of Mahek & Saumya in Newport News, VA. Guests can scan a QR code or NFC tag, search their name, and instantly view their assigned table number with a personalized message.

## Features

- **QR Code & NFC Integration**: Quick access via scan or tap
- **Real-time Google Sheets Integration**: Guest data automatically synced from a published Google Sheet
- **Smart Search**: Real-time search by first and last name with fuzzy matching
- **Unique Guest Identification**: Displays contact info or custom description to distinguish guests with identical names
- **Beautiful Table Assignment Display**: Animated popup showing table number and personalized message
- **Mobile-First Design**: Optimized for phones and tablets with touch-friendly interface
- **Modern Tech Stack**: Built with React, TypeScript, and Vite for fast performance

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Custom CSS with mobile-responsive design
- **Data Source**: Google Sheets (CSV export)
- **Color Palette**: Space Indigo, Lavender Grey, Platinum, Punch Red, Flag Red

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure the guest list data source:
   ```bash
   cp .env.example .env.local
   # Open .env.local and set VITE_SHEET_URL to your published Google Sheets CSV URL.
   ```

   The URL comes from `File → Share → Publish to web → CSV` in Google Sheets.
   It must end in `?output=csv`. The build will fail if this variable is unset
   (enforced by the `requireSheetUrl()` plugin in `vite.config.ts`).

3. (First-time or on rebrand) Generate PWA icons:
   ```bash
   npm run generate-pwa-icons
   ```

   This writes 4 PNG files to `public/` from an inline red-teardrop-pin SVG:
   `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png`, `apple-touch-icon.png`.
   Commit these files — they ship as the PWA manifest icons.

4. Generate floor-plan image variants (Phase 3 artifact — rerun only if the
   source image in `src/assets/` changes):
   ```bash
   npm run generate-images
   ```

## Development

```bash
npm run dev           # Vite dev server on :5173 (PWA SW enabled for testing)
npm run test          # Vitest run-once
npm run test:watch    # Vitest watch mode
npm run lint          # ESLint strict (--max-warnings 0)
npm run build         # Type-check, bundle, and verify PWA artifacts
npm run preview       # Serve dist/ locally (test the built PWA)
```

## PWA behavior

- First load fetches the guest list from Google Sheets and caches it in
  `localStorage` under `seatfinder.guests.v1`.
- Subsequent loads are network-first with a 2-second timeout; if the network
  is slow or offline, the cached list is served. Cache hard-expires after 24h.
- Static assets (JS/CSS/fonts/icons) are precached by the service worker;
  floor-plan images use a CacheFirst runtime rule (30-day TTL).
- The Google Sheets URL itself is never cached by the service worker —
  caching for that endpoint is done in the app layer (`src/services/guestsCache.ts`).
- A new deploy is detected automatically; the user sees a bottom toast
  ("New version available — Tap to refresh") and can opt in to reload.
- Guests can add the app to their home screen via the browser's native
  Add-to-Home-Screen affordance (no custom install prompt).

## Setup tool

An admin-only floor-plan coordinate mapper lives at the `/setup` route. It
takes a floor-plan image (the one guests will see) and produces the
`src/config/floorPlan.json` that the guest app consumes.

> **⚠️ No authentication.** `/setup` is protected only by route obscurity.
> Do NOT share the URL with guests. The page itself shows this warning at
> the top. Anyone with the URL can open the tool — but they cannot write
> back to the repo; the admin still pastes the generated JSON manually.

### Workflow

1. **Upload** — Drag-drop (or file-picker) a floor-plan PNG/JPEG/WebP/AVIF.
2. **Detect tables** — One click runs OpenCV `HoughCircles` (table shapes) +
   Tesseract OCR (printed numbers) in the browser. Status line shows
   progress: Preparing → Scanning → Cropping → Reading → Done.
3. **Review** — Draft pins overlay the image. Drag to reposition, click to
   edit the number, × to delete a false-positive, "Add pin" (or Shift+click)
   to add a missed table. A live preview alongside the editor renders the
   REAL `FloorPlan` component fed from the draft pins, so you see exactly
   what guests will see.
4. **Approve** — Validation pass (all pins have numeric IDs, no duplicates,
   all coords in 0..1). Errors list with per-pin "Edit pin" links. Once
   clean, the review canvas locks and the export panel appears.
5. **Export** — **Download floorPlan.json** or **Copy to Clipboard**. Paste
   into `src/config/floorPlan.json`, commit, redeploy.

### Requirements

- Modern browser (Chrome/Edge/Safari/Firefox — recent stable releases).
- **Internet on first run.** Tesseract fetches `eng.traineddata` (~15 MB)
  from jsDelivr on the first OCR call; it's cached in IndexedDB afterward.
- Secure context for clipboard (`https://` or `localhost`). If `/setup` is
  served over plain HTTP on a LAN IP, the Copy button falls back to a
  pre-selected `<textarea>` for manual `Cmd/Ctrl+C`.

### Bundle isolation (TOOL-03)

The setup tool's dependencies (`@techstark/opencv-js` ~8 MB WASM +
`tesseract.js`) add up to a ~11 MB chunk that guests MUST NEVER download.
Route-based code-splitting keeps the setup module in its own chunk:

- `src/main.tsx` uses `lazy(() => import('./setup/SetupApp'))` — the ONE
  allowed edge from the guest graph into `src/setup/`.
- Any static `import … from './setup/…'` in a guest-graph file (anything
  under `src/components/`, `src/services/`, `src/App.tsx`) is a violation.
- `scripts/verify-setup-split.mjs` runs at the end of `npm run build` and
  greps `dist/assets/index-*.js` for forbidden tokens (opencv, tesseract,
  `HoughCircles`, `tessedit_char_whitelist`, `runDetectionPipeline`,
  `DraftPin`). Any match fails the build. The script also positively
  asserts that a setup chunk exists and contains opencv or tesseract, so
  a tree-shaken-to-nothing regression is also caught.

### Local development

```bash
npm run dev           # Vite on :5173
# then visit http://localhost:5173/setup
```

### Known limits (v1 — deferred to v1.1)

- No auth on `/setup` (route obscurity only).
- No localStorage draft recovery — closing the tab mid-review loses work.
- One image at a time (no ceremony + reception multi-floor support).
- No automatic write-back to the repo — admin pastes manually.

---

### Google Sheets Setup

The app pulls guest data from a published Google Sheet with the following structure:

| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| Table Number | First Name | Last Name | Contact Info | Guest Description |

**Example Data:**
```
5, John, Smith, john.smith@email.com, Groom's college roommate
3, Sarah, Johnson, 757-555-0123, Bride's cousin from Richmond
```

To connect your own Google Sheet:
1. Create a Google Sheet with the columns above
2. Publish it to the web (File → Share → Publish to web → CSV)
3. Paste the published URL into `.env.local` as `VITE_SHEET_URL=…` (see Setup above).

## Project Structure

```
src/
├── components/
│   ├── SearchForm.tsx        # First/Last name search inputs
│   ├── SearchForm.css
│   ├── GuestDropdown.tsx     # Search results with unique identifiers
│   ├── GuestDropdown.css
│   ├── TableModal.tsx        # Table assignment popup
│   └── TableModal.css
├── services/
│   └── googleSheets.ts       # Google Sheets CSV fetching & parsing
├── App.tsx                   # Main application component
├── App.css
├── main.tsx                  # Entry point
├── index.css                 # Global styles
└── types.ts                  # TypeScript interfaces
```

## Color Palette

The app uses a sophisticated navy and red color scheme:

- **Space Indigo** (#2b2d42): Primary text, headers, buttons
- **Lavender Grey** (#8d99ae): Backgrounds, hover states
- **Platinum** (#edf2f4): Borders, subtle backgrounds
- **Punch Red** (#ef233c): Accents, table display
- **Flag Red** (#d90429): Hover states, gradients

## Development

The app is configured with:
- TypeScript strict mode for type safety
- ESLint for code quality
- Hot module replacement for fast development
- Mobile-responsive design with iOS-specific optimizations

## Future Enhancements (v2)

- [ ] Interactive venue floor map with table highlighting
- [ ] Offline support with service workers
- [ ] QR code generation for easy deployment
- [ ] Analytics for tracking guest check-ins
- [ ] Admin panel for real-time guest list updates

## License

Private project for Mahek & Saumya's wedding.

---

Built with ❤️ for Mahek & Saumya's special day!
