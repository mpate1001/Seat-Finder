# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- Components: PascalCase `.tsx` files (e.g., `SearchForm.tsx`, `FloorPlan.tsx`, `GuestDropdown.tsx`)
- CSS: Matching component name in PascalCase `.css` (e.g., `SearchForm.css`, `FloorPlan.css`)
- Services: camelCase `.ts` files (e.g., `googleSheets.ts`)
- Types: camelCase `.ts` files (e.g., `types.ts`)
- Config: camelCase `.json` files (e.g., `floorPlan.json`)
- App entry: `App.tsx`, `main.tsx`

**Functions:**
- Use camelCase for all functions: `handleSearch`, `loadGuests`, `handleInputChange`
- Event handlers prefixed with `handle`: `handleSearch`, `handleSubmit`, `handleEnlarge`, `handleClose`
- Data fetching functions use verb prefix: `fetchGuests`, `loadGuests`
- Callback props prefixed with `on`: `onSearch`, `onSelect`, `onClose`

**Variables:**
- camelCase for all variables: `searchTerm`, `searchResults`, `selectedGuest`
- State variables use descriptive nouns: `guests`, `loading`, `error`, `imageLoaded`
- Boolean state uses adjective or `is` prefix: `loading`, `isEnlarged`, `imageLoaded`

**Types/Interfaces:**
- PascalCase for interfaces: `Guest`, `SearchFormProps`, `FloorPlanProps`, `TablePosition`
- Props interfaces follow `{ComponentName}Props` pattern: `SearchFormProps`, `GuestDropdownProps`, `TableModalProps`, `FloorPlanProps`
- Defined in dedicated `src/types.ts` for shared types, or inline in component files for component-specific types

**CSS Classes:**
- kebab-case for all class names: `app-container`, `search-form`, `guest-dropdown`
- BEM-like naming with component prefix: `floor-plan-container`, `floor-plan-header`, `floor-plan-legend`
- State/modifier classes: `floor-plan-warning`, `guest-identifier`

## Code Style

**Formatting:**
- No Prettier config file detected -- uses default IDE formatting
- 2-space indentation in TypeScript/TSX files
- Single quotes for string literals in TypeScript
- Double quotes for JSX attribute values (standard JSX convention)
- Semicolons at end of statements
- Trailing commas in multi-line arrays/objects (observed in some places)

**Linting:**
- ESLint configured in `package.json` script: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
- Packages installed: `eslint@^9.15.0`, `@typescript-eslint/eslint-plugin@^8.15.0`, `@typescript-eslint/parser@^8.15.0`
- Plugins: `eslint-plugin-react-hooks@^5.0.0`, `eslint-plugin-react-refresh@^0.4.14`
- No `.eslintrc` or `eslint.config.*` file detected -- ESLint config may be missing or inline

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`
- Target: ES2020, Module: ESNext, JSX: react-jsx
- No path aliases configured

## Import Organization

**Order (observed pattern):**
1. React imports (`import { useState, useEffect } from 'react'`)
2. Type imports from local files (`import { Guest } from '../types'`)
3. Service/utility imports (`import { fetchGuests } from './services/googleSheets'`)
4. Component imports (`import SearchForm from './components/SearchForm'`)
5. Asset imports (`import backgroundImage from './assets/mahsompw-6074Z70_6074.jpeg'`)
6. CSS imports (`import './App.css'`)

**Path Style:**
- Relative paths throughout (no `@/` aliases)
- Include `.tsx` extension on local imports in `main.tsx` (`import App from './App.tsx'`), but omit in other files
- CSS imported as side-effect imports (`import './App.css'`)
- JSON imported directly (`import floorPlanConfig from '../config/floorPlan.json'`)
- Image assets imported as default exports (`import floorPlanImageSrc from '../assets/Reception Seat Diagram.png'`)

**Path Aliases:**
- None configured. Use relative paths.

## Component Patterns

**Component Definition:**
- Use `function` declarations (not arrow functions) for components: `export default function SearchForm(...)` 
- Default exports for all components
- Props destructured in function parameters: `function SearchForm({ onSearch }: SearchFormProps)`
- Props interfaces defined directly above the component in the same file

**State Management:**
- `useState` for all local state
- No global state management library (no Redux, Zustand, Context, etc.)
- State lifted to `App.tsx` which acts as the single state container
- Data flows down via props; events flow up via callback props

**Hooks Usage:**
- `useState` for local state
- `useEffect` for side effects (data fetching in `App.tsx`, keyboard listeners in `TableModal.tsx` and `FloorPlan.tsx`)
- `useCallback` for memoized callbacks (`FloorPlan.tsx` handleClose, `SearchForm.tsx` debouncedSearch)
- `useRef` for debounce timer (`SearchForm.tsx`)
- No custom hooks

**Component Structure (typical pattern):**
```typescript
import { useState } from 'react';
import { Guest } from '../types';
import './ComponentName.css';

interface ComponentNameProps {
  prop1: string;
  onAction: () => void;
}

export default function ComponentName({ prop1, onAction }: ComponentNameProps) {
  const [localState, setLocalState] = useState(initialValue);

  function handleSomething() {
    // handler logic
  }

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}
```

## CSS / Styling Approach

**Method:** Plain CSS files, one per component, co-located in `src/components/`
- No CSS modules, no Tailwind, no styled-components, no CSS-in-JS
- Global styles in `src/index.css` (reset + body font)
- App-level styles in `src/App.css`

**Design System:**
- Color palette centered around: `#2b2d42` (dark navy), `#ef233c` / `#d90429` (red accent), `#8d99ae` (muted blue-gray), `#edf2f4` (light gray)
- Border radius: consistently `10px` for inputs/cards, `20px` for major containers, `50%` for circles
- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- Responsive breakpoint: `@media (max-width: 600px)` used consistently across all component CSS files

**Animation:**
- CSS `@keyframes` for animations: `fadeIn`, `slideUp`, `pulse`, `ripple`
- `transition` for hover/interaction states (typically `0.2s-0.3s ease`)

## Error Handling

**Patterns:**
- try/catch in async functions with error re-throwing as user-friendly messages (`src/services/googleSheets.ts`)
- `console.error` for logging caught errors before re-throwing
- `instanceof Error` check for error message extraction: `err instanceof Error ? err.message : 'Failed to load guests'`
- Error state stored in component state (`useState<string | null>(null)`)
- Error UI rendered conditionally with retry button in `src/App.tsx`
- No error boundary components

## Logging

**Framework:** `console` (browser native)

**Patterns:**
- `console.error` used only in catch blocks (`src/services/googleSheets.ts`)
- No structured logging, no log levels beyond console.error
- No logging framework installed

## Comments

**When to Comment:**
- Inline comments for non-obvious logic (CSV parsing, image scaling calculations)
- Comments explain "why" not "what": `// Prevents zoom on iOS`, `// Handle escaped quotes (two double quotes in a row)`
- No JSDoc/TSDoc annotations on functions or interfaces
- Sparse commenting overall -- code is self-documenting for simple operations

## Function Design

**Size:** Functions are small, typically 5-20 lines
**Parameters:** Destructured objects for component props; simple parameters for utility functions
**Return Values:** Components return JSX; service functions return `Promise<Guest[]>`; handlers return void

## Module Design

**Exports:**
- Default exports for all React components
- Named exports for service functions (`export async function fetchGuests`)
- Named exports for types (`export interface Guest`)

**Barrel Files:**
- None used. Import directly from the source file.
- When adding new shared types, add to `src/types.ts`
- When adding new services, create a new file in `src/services/`

---

*Convention analysis: 2026-04-12*
