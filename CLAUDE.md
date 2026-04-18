# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Seat-Finder is a mobile-friendly seat-lookup app for the wedding of Mahek & Saumya in Newport News, VA. The app allows guests to:
- Scan a QR code to access the app
- Search for their name
- View their assigned table number
- See their seating highlighted on a visual floor map

**Key Requirements:**
- High throughput during reception check-ins
- Minimal friction for event staff
- Mobile-first design
- Fast name search functionality
- Visual floor map with seat highlighting

## Architecture Notes

This is a new repository. When implementing the application, consider:

1. **Frontend Framework**: Choose a mobile-first framework (React, Vue, or similar) optimized for quick load times on mobile devices
2. **Search Functionality**: Implement fuzzy search to handle name variations and typos during high-stress check-in scenarios
3. **Data Structure**: Guest list with name-to-table mappings; floor map coordinates for seat highlighting
4. **Offline Capability**: Consider offline-first approach to ensure reliability during the event regardless of venue connectivity
5. **QR Code Integration**: QR code should deep-link directly to the app, potentially pre-filling venue/event context

## Development Workflow

Since this repository is in early stages, establish:
- Build and test commands in package.json
- Linting and formatting standards
- Deployment strategy (likely static hosting for a simple web app)
- Guest data structure and sample data for testing
- Can you use these please

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Seat-Finder**

A mobile-first wedding guest seating app for Mahek & Saumya's reception in Newport News, VA. Guests scan a QR code, search for their name, see their table number, and get an animated visual guide showing exactly where their table is on the venue floor plan. The app prioritizes speed and simplicity during high-throughput check-in.

**Core Value:** A guest finds their table in under 10 seconds — search, see the number, see it on the map, walk there.

### Constraints

- **Tech stack**: React/Vite/TypeScript — keep the existing stack, don't rewrite
- **Data source**: Google Sheets CSV — working well, no reason to change
- **Hosting**: Static site — no backend server, keep it simple
- **Timeline**: ~1-2 months to ship polished version
- **Primary device**: Mobile phones at the venue — performance on cellular/WiFi is critical
- **Floor plan input**: User-drawn image (Canva, Figma, etc.) — auto-detection must work with various image styles
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.6.2 - All application source code (`src/**/*.ts`, `src/**/*.tsx`)
- CSS - Styling via plain CSS files co-located with components (`src/**/*.css`)
- HTML - Single entry point (`index.html`)
- JSON - Configuration data (`src/config/floorPlan.json`, `package.json`, `tsconfig.json`)
## Runtime
- Node.js v22.14.0 (detected on dev machine)
- Browser target: ES2020 (per `tsconfig.json` `"target": "ES2020"`)
- DOM libs: ES2020, DOM, DOM.Iterable
- npm
- Lockfile: `package-lock.json` (present)
## Frameworks
- React ^18.3.1 - UI framework, functional components with hooks
- React DOM ^18.3.1 - Browser rendering
- Vite ^6.0.1 - Dev server and production bundler (`vite.config.ts`)
- @vitejs/plugin-react ^4.3.4 - React Fast Refresh and JSX transform
- ESLint ^9.15.0 - Code linting
- @typescript-eslint/eslint-plugin ^8.15.0 - TypeScript-specific lint rules
- @typescript-eslint/parser ^8.15.0 - TypeScript parser for ESLint
- eslint-plugin-react-hooks ^5.0.0 - React hooks lint rules
- eslint-plugin-react-refresh ^0.4.14 - React Refresh boundary validation
## Key Dependencies
- `react` ^18.3.1 - Core UI rendering library
- `react-dom` ^18.3.1 - DOM rendering for React
- `typescript` ~5.6.2 - Type checking and compilation
- `vite` ^6.0.1 - Bundler and dev server
- `@types/react` ^18.3.12 - React type definitions
- `@types/react-dom` ^18.3.1 - React DOM type definitions
## TypeScript Configuration
- `strict: true` - Full strict mode enabled
- `noUnusedLocals: true` - Flags unused local variables
- `noUnusedParameters: true` - Flags unused function parameters
- `noFallthroughCasesInSwitch: true` - Requires break/return in switch cases
- `moduleResolution: "bundler"` - Vite-compatible module resolution
- `jsx: "react-jsx"` - Modern JSX transform (no React import needed)
- `noEmit: true` - TypeScript used for type checking only; Vite handles compilation
- `isolatedModules: true` - Ensures compatibility with Vite's per-file transpilation
- `types: ["vite/client"]` - Vite client types for import.meta and asset imports
## Build Configuration
- Minimal configuration: only the React plugin enabled
- No custom aliases, proxy, or environment variable configuration
- ESM module type (`"type": "module"` in `package.json`)
## Scripts
- `npm run dev` — Vite dev server on :5173 (PWA service worker enabled via `devOptions.enabled: true`)
- `npm run build` — Type-check (`tsc`), bundle (`vite build`), and verify PWA artifacts (`node scripts/verify-pwa-build.mjs`)
- `npm run preview` — Serve the built `dist/` locally (production PWA test)
- `npm run lint` — ESLint strict (`--max-warnings 0`, `.ts`/`.tsx`)
- `npm run test` — Vitest run-once
- `npm run test:watch` — Vitest watch mode
- `npm run generate-images` — Regenerate floor-plan image variants (Phase 3 artifact)
- `npm run generate-pwa-icons` — Regenerate PWA manifest icons from the inline red-pin SVG (Phase 4 artifact)
## Platform Requirements
- Node.js (v22+ detected, likely works with v18+)
- npm
- No native dependencies or platform-specific requirements
- Static file hosting only (SPA with `index.html` entry)
- No server-side rendering
- No backend server required (data fetched from Google Sheets CSV endpoint)
- Build output is pure HTML/CSS/JS in `dist/`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: PascalCase `.tsx` files (e.g., `SearchForm.tsx`, `FloorPlan.tsx`, `GuestDropdown.tsx`)
- CSS: Matching component name in PascalCase `.css` (e.g., `SearchForm.css`, `FloorPlan.css`)
- Services: camelCase `.ts` files (e.g., `googleSheets.ts`)
- Types: camelCase `.ts` files (e.g., `types.ts`)
- Config: camelCase `.json` files (e.g., `floorPlan.json`)
- App entry: `App.tsx`, `main.tsx`
- Use camelCase for all functions: `handleSearch`, `loadGuests`, `handleInputChange`
- Event handlers prefixed with `handle`: `handleSearch`, `handleSubmit`, `handleEnlarge`, `handleClose`
- Data fetching functions use verb prefix: `fetchGuests`, `loadGuests`
- Callback props prefixed with `on`: `onSearch`, `onSelect`, `onClose`
- camelCase for all variables: `searchTerm`, `searchResults`, `selectedGuest`
- State variables use descriptive nouns: `guests`, `loading`, `error`, `imageLoaded`
- Boolean state uses adjective or `is` prefix: `loading`, `isEnlarged`, `imageLoaded`
- PascalCase for interfaces: `Guest`, `SearchFormProps`, `FloorPlanProps`, `TablePosition`
- Props interfaces follow `{ComponentName}Props` pattern: `SearchFormProps`, `GuestDropdownProps`, `TableModalProps`, `FloorPlanProps`
- Defined in dedicated `src/types.ts` for shared types, or inline in component files for component-specific types
- kebab-case for all class names: `app-container`, `search-form`, `guest-dropdown`
- BEM-like naming with component prefix: `floor-plan-container`, `floor-plan-header`, `floor-plan-legend`
- State/modifier classes: `floor-plan-warning`, `guest-identifier`
## Code Style
- No Prettier config file detected -- uses default IDE formatting
- 2-space indentation in TypeScript/TSX files
- Single quotes for string literals in TypeScript
- Double quotes for JSX attribute values (standard JSX convention)
- Semicolons at end of statements
- Trailing commas in multi-line arrays/objects (observed in some places)
- ESLint configured in `package.json` script: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
- Packages installed: `eslint@^9.15.0`, `@typescript-eslint/eslint-plugin@^8.15.0`, `@typescript-eslint/parser@^8.15.0`
- Plugins: `eslint-plugin-react-hooks@^5.0.0`, `eslint-plugin-react-refresh@^0.4.14`
- No `.eslintrc` or `eslint.config.*` file detected -- ESLint config may be missing or inline
- Strict mode enabled in `tsconfig.json`
- `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`
- Target: ES2020, Module: ESNext, JSX: react-jsx
- No path aliases configured
## Import Organization
- Relative paths throughout (no `@/` aliases)
- Include `.tsx` extension on local imports in `main.tsx` (`import App from './App.tsx'`), but omit in other files
- CSS imported as side-effect imports (`import './App.css'`)
- JSON imported directly (`import floorPlanConfig from '../config/floorPlan.json'`)
- Image assets imported as default exports (`import floorPlanImageSrc from '../assets/Reception Seat Diagram.png'`)
- None configured. Use relative paths.
## Component Patterns
- Use `function` declarations (not arrow functions) for components: `export default function SearchForm(...)` 
- Default exports for all components
- Props destructured in function parameters: `function SearchForm({ onSearch }: SearchFormProps)`
- Props interfaces defined directly above the component in the same file
- `useState` for all local state
- No global state management library (no Redux, Zustand, Context, etc.)
- State lifted to `App.tsx` which acts as the single state container
- Data flows down via props; events flow up via callback props
- `useState` for local state
- `useEffect` for side effects (data fetching in `App.tsx`, keyboard listeners in `TableModal.tsx` and `FloorPlan.tsx`)
- `useCallback` for memoized callbacks (`FloorPlan.tsx` handleClose, `SearchForm.tsx` debouncedSearch)
- `useRef` for debounce timer (`SearchForm.tsx`)
- No custom hooks
## CSS / Styling Approach
- No CSS modules, no Tailwind, no styled-components, no CSS-in-JS
- Global styles in `src/index.css` (reset + body font)
- App-level styles in `src/App.css`
- Color palette centered around: `#2b2d42` (dark navy), `#ef233c` / `#d90429` (red accent), `#8d99ae` (muted blue-gray), `#edf2f4` (light gray)
- Border radius: consistently `10px` for inputs/cards, `20px` for major containers, `50%` for circles
- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- Responsive breakpoint: `@media (max-width: 600px)` used consistently across all component CSS files
- CSS `@keyframes` for animations: `fadeIn`, `slideUp`, `pulse`, `ripple`
- `transition` for hover/interaction states (typically `0.2s-0.3s ease`)
## Error Handling
- try/catch in async functions with error re-throwing as user-friendly messages (`src/services/googleSheets.ts`)
- `console.error` for logging caught errors before re-throwing
- `instanceof Error` check for error message extraction: `err instanceof Error ? err.message : 'Failed to load guests'`
- Error state stored in component state (`useState<string | null>(null)`)
- Error UI rendered conditionally with retry button in `src/App.tsx`
- No error boundary components
## Logging
- `console.error` used only in catch blocks (`src/services/googleSheets.ts`)
- No structured logging, no log levels beyond console.error
- No logging framework installed
## Comments
- Inline comments for non-obvious logic (CSV parsing, image scaling calculations)
- Comments explain "why" not "what": `// Prevents zoom on iOS`, `// Handle escaped quotes (two double quotes in a row)`
- No JSDoc/TSDoc annotations on functions or interfaces
- Sparse commenting overall -- code is self-documenting for simple operations
## Function Design
## Module Design
- Default exports for all React components
- Named exports for service functions (`export async function fetchGuests`)
- Named exports for types (`export interface Guest`)
- None used. Import directly from the source file.
- When adding new shared types, add to `src/types.ts`
- When adding new services, create a new file in `src/services/`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React 18 SPA built with Vite, no client-side router
- Single view with search-driven UI flow (search -> select -> modal)
- All guest data fetched at startup from a published Google Sheets CSV
- No backend server -- purely static frontend consuming a public CSV endpoint
- No state management library -- React useState at the App level serves as the single source of truth
## Layers
- Purpose: Bootstrap React into the DOM
- Location: `index.html`, `src/main.tsx`
- Contains: HTML shell with `#root` div; React StrictMode mount
- Depends on: `src/App.tsx`
- Used by: Browser (initial page load)
- Purpose: Holds all application state and orchestrates data flow between components
- Location: `src/App.tsx`
- Contains: Guest list state, search logic, loading/error states, event handlers
- Depends on: `src/services/googleSheets.ts`, `src/types.ts`, all components
- Used by: `src/main.tsx`
- Purpose: Presentational and interactive UI components
- Location: `src/components/`
- Contains: SearchForm, GuestDropdown, TableModal, FloorPlan
- Depends on: `src/types.ts`, `src/config/floorPlan.json`, component-level CSS
- Used by: `src/App.tsx`
- Purpose: External data fetching and CSV parsing
- Location: `src/services/googleSheets.ts`
- Contains: `fetchGuests()` function, CSV parser
- Depends on: `src/types.ts`, browser Fetch API
- Used by: `src/App.tsx`
- Purpose: Static configuration data for the floor plan
- Location: `src/config/floorPlan.json`
- Contains: Table pixel coordinates mapped to table numbers, canvas dimensions
- Depends on: Nothing
- Used by: `src/components/FloorPlan.tsx`
- Purpose: Shared TypeScript interfaces
- Location: `src/types.ts`
- Contains: `Guest` interface (tableNumber, firstName, lastName, contactInfo, description)
- Depends on: Nothing
- Used by: `src/App.tsx`, `src/services/googleSheets.ts`, `src/components/GuestDropdown.tsx`, `src/components/TableModal.tsx`
## Data Flow
- All state lives in `src/App.tsx` using `useState`:
- `src/components/FloorPlan.tsx` has local state for image dimensions, enlarged view toggle, and enlarged dimensions
- `src/components/SearchForm.tsx` has local state for the input value and a debounce timer ref
## Key Abstractions
- Purpose: Represents a wedding guest with their table assignment
- Definition: `src/types.ts`
- Fields: `tableNumber`, `firstName`, `lastName`, `contactInfo`, `description`
- Pattern: Simple data interface, no methods
- Purpose: Maps table numbers to pixel coordinates on the floor plan image
- Definition: `src/config/floorPlan.json`
- Pattern: JSON config with `canvasWidth`/`canvasHeight` (original image dimensions) and `tablePositions` as a `Record<string, {x, y}>`. Coordinates are scaled at runtime based on the displayed image width.
## Entry Points
- Location: `index.html`
- Triggers: Initial page load / QR code scan
- Responsibilities: Loads `src/main.tsx` as an ES module
- Location: `src/main.tsx`
- Triggers: Script execution from `index.html`
- Responsibilities: Mounts `<App />` in React StrictMode into `#root`
- Location: `src/App.tsx`
- Triggers: React render
- Responsibilities: Fetches guest data, manages all app state, renders UI flow
## Error Handling
- `src/services/googleSheets.ts`: Catches fetch errors, logs to console, re-throws with user-friendly message
- `src/App.tsx`: Catches service errors, stores in `error` state, renders error card with "Retry" button that re-invokes `loadGuests()`
- No global error boundary
- No offline fallback or caching of guest data
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:phase-5-boundary-start -->
## Setup tool module boundary (Phase 5)

The admin-only `/setup` route lives under `src/setup/`. Its dependencies
(`@techstark/opencv-js` + `tesseract.js`) add ~11 MB of WASM and OCR models
to any bundle they end up in. Guests must NEVER download them.

**Rule:** `@techstark/opencv-js` and `tesseract.js` may ONLY be imported from
files under `src/setup/`. Importing either package from `src/components/`,
`src/services/`, `src/App.tsx`, or `src/main.tsx` violates requirement TOOL-03
and fails `scripts/verify-setup-split.mjs` at build time.

**The one allowed boundary crossing:**

```ts
// src/main.tsx
const SetupApp = lazy(() => import('./setup/SetupApp'));
```

`lazy(() => import('./setup/SetupApp'))` is the sole edge from the guest graph
into `src/setup/`. Any other static `import … from './setup/…'` in a
guest-graph file (anything reachable from `main.tsx` under the non-`/setup`
path) pulls the setup tree into the guest bundle.

**How the rule is enforced:**

- `scripts/verify-setup-split.mjs` runs as the last step of `npm run build`
  (after `verify-pwa-build.mjs`). It greps `dist/assets/index-*.js` for 6
  forbidden tokens (`opencv`, `tesseract`, `HoughCircles`,
  `tessedit_char_whitelist`, `runDetectionPipeline`, `DraftPin`) — any match
  exits 1 and fails the build.
- The same script positively asserts that a chunk matching `/setup|SetupApp/i`
  exists and contains `opencv` or `tesseract`, so a regression where the
  lazy import is accidentally tree-shaken into nothing also fails.

**Why:** TOOL-03 keeps the guest entry bundle at ~224 KB (gzip ~73 KB) by
isolating the ~11 MB setup chunk. The guest-facing bundle is the page
guests fetch over cellular at the venue — every byte matters.

**When adding new setup-tool code:** put it under `src/setup/` alongside
`SetupApp.tsx`, `detect.ts`, `ocr.ts`, `ReviewCanvas.tsx`, etc. When adding
new guest-path code: do NOT import anything from `src/setup/` (not even
types — TypeScript will drop the import at runtime but the grep gate
matches on token presence, which survives type-only imports inconsistently
depending on `verbatimModuleSyntax`). Keep the two trees separate.
<!-- GSD:phase-5-boundary-end -->


<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
