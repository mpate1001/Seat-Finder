# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Single-Page Application (SPA) with no routing

**Key Characteristics:**
- React 18 SPA built with Vite, no client-side router
- Single view with search-driven UI flow (search -> select -> modal)
- All guest data fetched at startup from a published Google Sheets CSV
- No backend server -- purely static frontend consuming a public CSV endpoint
- No state management library -- React useState at the App level serves as the single source of truth

## Layers

**Entry Layer:**
- Purpose: Bootstrap React into the DOM
- Location: `index.html`, `src/main.tsx`
- Contains: HTML shell with `#root` div; React StrictMode mount
- Depends on: `src/App.tsx`
- Used by: Browser (initial page load)

**Application Layer (Container):**
- Purpose: Holds all application state and orchestrates data flow between components
- Location: `src/App.tsx`
- Contains: Guest list state, search logic, loading/error states, event handlers
- Depends on: `src/services/googleSheets.ts`, `src/types.ts`, all components
- Used by: `src/main.tsx`

**Component Layer:**
- Purpose: Presentational and interactive UI components
- Location: `src/components/`
- Contains: SearchForm, GuestDropdown, TableModal, FloorPlan
- Depends on: `src/types.ts`, `src/config/floorPlan.json`, component-level CSS
- Used by: `src/App.tsx`

**Service Layer:**
- Purpose: External data fetching and CSV parsing
- Location: `src/services/googleSheets.ts`
- Contains: `fetchGuests()` function, CSV parser
- Depends on: `src/types.ts`, browser Fetch API
- Used by: `src/App.tsx`

**Configuration Layer:**
- Purpose: Static configuration data for the floor plan
- Location: `src/config/floorPlan.json`
- Contains: Table pixel coordinates mapped to table numbers, canvas dimensions
- Depends on: Nothing
- Used by: `src/components/FloorPlan.tsx`

**Type Layer:**
- Purpose: Shared TypeScript interfaces
- Location: `src/types.ts`
- Contains: `Guest` interface (tableNumber, firstName, lastName, contactInfo, description)
- Depends on: Nothing
- Used by: `src/App.tsx`, `src/services/googleSheets.ts`, `src/components/GuestDropdown.tsx`, `src/components/TableModal.tsx`

## Data Flow

**Guest Data Loading (on mount):**

1. `src/App.tsx` calls `loadGuests()` inside a `useEffect` on mount
2. `src/services/googleSheets.ts` `fetchGuests()` fetches CSV from a hardcoded Google Sheets published URL
3. CSV text is parsed line-by-line with a custom `parseCSVLine()` parser (handles quoted fields)
4. Parsed rows are mapped to `Guest[]` objects and returned
5. `src/App.tsx` stores the guest list in `useState<Guest[]>`

**Search Flow:**

1. User types in `src/components/SearchForm.tsx` input field
2. SearchForm debounces input (150ms) then calls `onSearch(searchTerm)` callback
3. `src/App.tsx` `handleSearch()` filters the full guest list using case-insensitive substring matching on firstName, lastName, and full name (both orders)
4. Matching guests are stored in `searchResults` state
5. `src/components/GuestDropdown.tsx` renders the filtered results as clickable buttons

**Guest Selection Flow:**

1. User clicks a guest in `src/components/GuestDropdown.tsx`
2. `onSelect(guest)` callback fires, setting `selectedGuest` state in `src/App.tsx`
3. `src/components/TableModal.tsx` renders as a modal overlay with guest greeting and description
4. TableModal embeds `src/components/FloorPlan.tsx` passing the guest's `tableNumber`
5. FloorPlan loads the floor plan image, reads pixel coordinates from `src/config/floorPlan.json`, and positions a pulsing red marker at the table location
6. User can click the map to enlarge it (fullscreen overlay with recalculated marker position)
7. Modal closes via close button, overlay click, or Escape key

**State Management:**
- All state lives in `src/App.tsx` using `useState`:
  - `guests: Guest[]` -- full guest list (loaded once)
  - `loading: boolean` -- loading indicator
  - `error: string | null` -- error message
  - `searchResults: Guest[]` -- filtered search results
  - `selectedGuest: Guest | null` -- currently selected guest (drives modal visibility)
- `src/components/FloorPlan.tsx` has local state for image dimensions, enlarged view toggle, and enlarged dimensions
- `src/components/SearchForm.tsx` has local state for the input value and a debounce timer ref

## Key Abstractions

**Guest:**
- Purpose: Represents a wedding guest with their table assignment
- Definition: `src/types.ts`
- Fields: `tableNumber`, `firstName`, `lastName`, `contactInfo`, `description`
- Pattern: Simple data interface, no methods

**Floor Plan Configuration:**
- Purpose: Maps table numbers to pixel coordinates on the floor plan image
- Definition: `src/config/floorPlan.json`
- Pattern: JSON config with `canvasWidth`/`canvasHeight` (original image dimensions) and `tablePositions` as a `Record<string, {x, y}>`. Coordinates are scaled at runtime based on the displayed image width.

## Entry Points

**Browser Entry:**
- Location: `index.html`
- Triggers: Initial page load / QR code scan
- Responsibilities: Loads `src/main.tsx` as an ES module

**React Entry:**
- Location: `src/main.tsx`
- Triggers: Script execution from `index.html`
- Responsibilities: Mounts `<App />` in React StrictMode into `#root`

**Application Root:**
- Location: `src/App.tsx`
- Triggers: React render
- Responsibilities: Fetches guest data, manages all app state, renders UI flow

## Error Handling

**Strategy:** Simple try/catch with user-facing error messages and retry capability

**Patterns:**
- `src/services/googleSheets.ts`: Catches fetch errors, logs to console, re-throws with user-friendly message
- `src/App.tsx`: Catches service errors, stores in `error` state, renders error card with "Retry" button that re-invokes `loadGuests()`
- No global error boundary
- No offline fallback or caching of guest data

## Cross-Cutting Concerns

**Logging:** `console.error` only, in `src/services/googleSheets.ts` on fetch failure. No structured logging.

**Validation:** Minimal -- CSV rows must have >= 5 fields to be included. No input sanitization on search. No schema validation on the floor plan config.

**Authentication:** None. The app is publicly accessible. The Google Sheets CSV URL is publicly published.

**Styling:** Plain CSS with component-scoped files (one `.css` per component). No CSS modules, no CSS-in-JS. Mobile-first responsive design via media queries in `src/App.css`.

---

*Architecture analysis: 2026-04-12*
