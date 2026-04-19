# Codebase Concerns

**Analysis Date:** 2026-04-12

## Tech Debt

**No Fuzzy Search Implementation:**
- Issue: Search uses simple `String.includes()` matching instead of fuzzy search. CLAUDE.md explicitly calls for "fuzzy search to handle name variations and typos during high-stress check-in scenarios."
- Files: `src/App.tsx` (lines 34-55)
- Impact: Guests with misspelled names or name variations (e.g., "Mike" vs "Michael", "Patel" vs "Patell") will not find their seats. High-stress check-in scenario makes typos very likely on mobile keyboards.
- Fix approach: Integrate a fuzzy search library (e.g., Fuse.js) to replace the `.includes()` filter. Weight firstName and lastName fields, set an appropriate threshold for matching quality.
- Severity: **High**

**Hardcoded Google Sheets URL:**
- Issue: The guest data source URL is hardcoded directly in the service file as a constant string.
- Files: `src/services/googleSheets.ts` (line 3)
- Impact: Changing the data source requires a code change and redeploy. Cannot switch between test/production guest lists without modifying source code.
- Fix approach: Move the URL to an environment variable (`VITE_SHEET_URL`) loaded via Vite's env system, with a fallback default for development.
- Severity: **Medium**

**Committed dist/ Directory:**
- Issue: The `dist/` directory containing build artifacts is checked into the repository. The `.gitignore` lists `dist` but the folder exists in the repo (visible in file listing).
- Files: `dist/`, `.gitignore`
- Impact: Repository bloat, potential confusion between source and built assets, merge conflicts on generated files.
- Fix approach: Run `git rm -r --cached dist/` to remove from tracking. The `.gitignore` already has the correct entry.
- Severity: **Low**

**Committed .idea/ and .DS_Store Files:**
- Issue: IDE-specific files (`.idea/`) and macOS metadata (`.DS_Store`, `src/.DS_Store`) are committed to the repository.
- Files: `.idea/`, `.DS_Store`, `src/.DS_Store`
- Impact: Repository clutter, potential merge conflicts for developers using different IDEs.
- Fix approach: Add `.idea/` and `.DS_Store` to `.gitignore`, then `git rm -r --cached .idea/ .DS_Store src/.DS_Store`.
- Severity: **Low**

**Duplicate Table Position (Tables 46 and 47):**
- Issue: Tables 46 and 47 share identical pixel coordinates `{"x": 2170, "y": 920}` in the floor plan config.
- Files: `src/config/floorPlan.json` (lines 51-52)
- Impact: If a guest is at table 47, the marker will point to the wrong location (table 46's position). One of these two entries has incorrect coordinates.
- Fix approach: Verify the correct pixel position for table 47 on the floor plan image and update the JSON config.
- Severity: **High**

## Security Considerations

**Public Google Sheets URL Exposes Guest Data:**
- Risk: The published Google Sheets CSV URL is hardcoded in client-side JavaScript. Anyone can access the full guest list (names, contact info, descriptions) by extracting this URL from the built JS bundle.
- Files: `src/services/googleSheets.ts` (line 3)
- Current mitigation: None. The URL is publicly accessible by design (Google Sheets "Publish to web" feature).
- Recommendations: Accept this risk for a wedding app (low-stakes data), or add a lightweight proxy/serverless function that fetches the sheet server-side and returns only necessary fields. At minimum, consider whether the `contactInfo` field needs to be exposed to all guests.
- Severity: **Medium**

**No Input Sanitization on Search:**
- Risk: Search input is used directly in string comparison. React's JSX escaping prevents XSS in rendering, and no unsafe HTML rendering patterns are used.
- Files: `src/App.tsx` (line 40), `src/components/SearchForm.tsx`
- Current mitigation: React's built-in JSX escaping handles output safety. No unsafe HTML injection patterns present.
- Recommendations: Low risk given the architecture, but consider limiting input length to prevent performance issues with extremely long strings.
- Severity: **Low**

## Performance Concerns

**No Caching of Guest Data:**
- Problem: Every page load fetches the full guest CSV from Google Sheets. No caching, no service worker, no localStorage fallback.
- Files: `src/App.tsx` (lines 17-19, 21-32), `src/services/googleSheets.ts`
- Cause: The `useEffect` in `App.tsx` calls `fetchGuests()` on every mount with no cache-first strategy.
- Impact: During reception check-in with 100+ guests simultaneously accessing the app on potentially weak venue WiFi, every phone hits Google Sheets independently. Google may rate-limit or the venue network may bottleneck.
- Improvement path: (1) Cache fetched data in localStorage with a TTL. (2) Add a service worker for offline-first capability. (3) Consider bundling the guest data at build time as a JSON import if the list is finalized before the event.
- Severity: **High**

**No Offline Capability:**
- Problem: CLAUDE.md explicitly calls for "offline-first approach to ensure reliability during the event regardless of venue connectivity." Zero offline support exists.
- Files: All data fetching in `src/services/googleSheets.ts`
- Cause: No service worker, no PWA manifest, no localStorage caching.
- Impact: If venue WiFi drops during reception, the app becomes completely non-functional. Guests see "Failed to load guest list" error.
- Improvement path: (1) Register a service worker via vite-plugin-pwa. (2) Cache the guest CSV response. (3) Add a PWA manifest for "Add to Home Screen" capability. (4) Show cached data when offline with an "offline" indicator.
- Severity: **High**

**Large Floor Plan Image Not Optimized:**
- Problem: The floor plan image (`Reception Seat Diagram.png`) at canvas dimensions 3300x2517 is loaded at full resolution even on small mobile screens where the inline view is roughly 300px wide.
- Files: `src/components/FloorPlan.tsx`, `src/assets/Reception Seat Diagram.png`
- Cause: Single image source used for both thumbnail and enlarged views.
- Improvement path: Provide a smaller resolution version for the inline thumbnail view. Use `srcset` or load the high-res version only when the user clicks to enlarge. Consider converting to WebP format for smaller file size.
- Severity: **Medium**

## Accessibility Issues

**No ARIA Attributes on Modal:**
- Problem: The TableModal and enlarged FloorPlan overlays lack proper ARIA roles and attributes.
- Files: `src/components/TableModal.tsx`, `src/components/FloorPlan.tsx`
- Impact: Screen readers cannot identify the modal dialog, cannot announce when it opens/closes, and the close button lacks an accessible label.
- Fix approach: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to modal containers. Add `aria-label="Close"` to close buttons. Trap focus within the modal when open.
- Severity: **Medium**

**No Focus Trap in Modals:**
- Problem: When a modal is open, Tab key can move focus to elements behind the modal overlay.
- Files: `src/components/TableModal.tsx`, `src/components/FloorPlan.tsx`
- Impact: Keyboard users can interact with hidden content. Poor accessibility experience.
- Fix approach: Implement focus trapping within modal content when open. Restore focus to the trigger element on close.
- Severity: **Medium**

**Floor Plan Image Alt Text Not Descriptive:**
- Problem: The floor plan `alt` text is generic ("Reception Floor Plan") and does not convey the highlighted table information.
- Files: `src/components/FloorPlan.tsx` (lines 102, 142)
- Impact: Screen reader users get no information about which table is highlighted or where it is located.
- Fix approach: Use dynamic alt text like `"Reception floor plan with Table ${tableNumber} highlighted"`.
- Severity: **Low**

**Color-Only Indication for Table Marker:**
- Problem: The table position marker uses only a red pulsing circle. Users with color vision deficiency may not distinguish it.
- Files: `src/components/FloorPlan.css` (lines 47-69)
- Impact: Some users may not be able to locate their table on the map.
- Fix approach: Add a label/number inside the marker, or use a contrasting shape (arrow, crosshair) in addition to color.
- Severity: **Low**

## Missing Critical Features

**No "Not Found" Feedback:**
- Problem: When a guest searches and no results match, there is no message shown. The search results area simply remains empty.
- Files: `src/App.tsx` (lines 103-105)
- Blocks: Guests who cannot find their name have no guidance. They do not know if the search failed, if they are not on the list, or if they should try a different spelling.
- Fix approach: Add a "No guests found" message with suggestions (try a different spelling, ask staff) when `searchResults.length === 0` and the search term is non-empty.
- Severity: **High**

**No PWA Manifest:**
- Problem: No `manifest.json` or web app manifest is configured. The app cannot be "installed" or added to home screen.
- Files: `index.html` (no manifest link)
- Blocks: Cannot provide app-like experience on mobile. No custom icon or splash screen when opened from QR code.
- Fix approach: Add a `manifest.json` with app name, icons, theme color, and `display: "standalone"`. Link it in `index.html`.
- Severity: **Medium**

**No Loading Indicator for Floor Plan Image:**
- Problem: When selecting a guest, the modal opens instantly but the floor plan image may take time to load. No loading state for the image.
- Files: `src/components/FloorPlan.tsx` (line 107 -- marker only shows after `imageLoaded`)
- Blocks: Users see an empty floor plan area while the large image loads, with no indication that content is coming.
- Fix approach: Show a loading spinner or skeleton while `imageLoaded` is false.
- Severity: **Low**

## Fragile Areas

**CSV Parsing:**
- Files: `src/services/googleSheets.ts` (lines 45-71)
- Why fragile: Custom CSV parser assumes specific column order (table, first, last, contact, description). Any column reorder, addition, or format change in the Google Sheet breaks the app silently -- guests get wrong data mapped to wrong fields.
- Safe modification: Add header-row parsing to map columns by name rather than index. Validate expected columns exist before processing rows.
- Test coverage: No tests exist for CSV parsing.
- Severity: **High**

**Floor Plan Coordinate System:**
- Files: `src/config/floorPlan.json`, `src/components/FloorPlan.tsx`
- Why fragile: Table positions are hardcoded pixel coordinates tied to a specific image. Replacing or resizing the floor plan image requires recalculating all 54 table positions manually.
- Safe modification: Use percentage-based coordinates instead of pixels, or provide a visual calibration tool.
- Test coverage: No tests exist.
- Severity: **Medium**

## Test Coverage Gaps

**No Tests Exist:**
- What's not tested: The entire application. Zero test files exist in the repository.
- Files: No `*.test.*` or `*.spec.*` files found anywhere.
- Risk: Any change to CSV parsing, search logic, floor plan coordinate scaling, or component rendering could break without detection. The CSV parser and search logic are particularly high-risk untested areas.
- Priority: **High** -- At minimum, add unit tests for `parseCSVLine()` in `src/services/googleSheets.ts` and the search/filter logic in `src/App.tsx`.

## Dependencies at Risk

**Minimal Dependency Surface (Positive):**
- Risk: Very few production dependencies (only `react` and `react-dom`), which is positive for security. However, custom implementations (CSV parsing, debounce) must be maintained manually and may have unhandled edge cases.
- Impact: Custom CSV parser may fail on unusual field content. Low overall risk.
- Severity: **Low**

**Favicon References Default Vite Asset:**
- Risk: `index.html` references `/vite.svg` as favicon, which is the Vite default placeholder -- not a custom wedding app icon.
- Files: `index.html` (line 5)
- Impact: Browser tab shows generic Vite logo instead of wedding/app branding.
- Fix approach: Replace with a custom favicon.
- Severity: **Low**

---

*Concerns audit: 2026-04-12*
