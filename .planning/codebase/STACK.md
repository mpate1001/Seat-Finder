# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript ~5.6.2 - All application source code (`src/**/*.ts`, `src/**/*.tsx`)
- CSS - Styling via plain CSS files co-located with components (`src/**/*.css`)

**Secondary:**
- HTML - Single entry point (`index.html`)
- JSON - Configuration data (`src/config/floorPlan.json`, `package.json`, `tsconfig.json`)

## Runtime

**Environment:**
- Node.js v22.14.0 (detected on dev machine)
- Browser target: ES2020 (per `tsconfig.json` `"target": "ES2020"`)
- DOM libs: ES2020, DOM, DOM.Iterable

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React ^18.3.1 - UI framework, functional components with hooks
- React DOM ^18.3.1 - Browser rendering

**Build/Dev:**
- Vite ^6.0.1 - Dev server and production bundler (`vite.config.ts`)
- @vitejs/plugin-react ^4.3.4 - React Fast Refresh and JSX transform

**Linting:**
- ESLint ^9.15.0 - Code linting
- @typescript-eslint/eslint-plugin ^8.15.0 - TypeScript-specific lint rules
- @typescript-eslint/parser ^8.15.0 - TypeScript parser for ESLint
- eslint-plugin-react-hooks ^5.0.0 - React hooks lint rules
- eslint-plugin-react-refresh ^0.4.14 - React Refresh boundary validation

## Key Dependencies

**Critical (dependencies):**
- `react` ^18.3.1 - Core UI rendering library
- `react-dom` ^18.3.1 - DOM rendering for React

**Dev Only (devDependencies):**
- `typescript` ~5.6.2 - Type checking and compilation
- `vite` ^6.0.1 - Bundler and dev server
- `@types/react` ^18.3.12 - React type definitions
- `@types/react-dom` ^18.3.1 - React DOM type definitions

**Notable:** The project has zero runtime dependencies beyond React itself. No routing library, no state management library, no CSS framework, no HTTP client library. All data fetching uses the native `fetch` API.

## TypeScript Configuration

**Config file:** `tsconfig.json`

**Key settings:**
- `strict: true` - Full strict mode enabled
- `noUnusedLocals: true` - Flags unused local variables
- `noUnusedParameters: true` - Flags unused function parameters
- `noFallthroughCasesInSwitch: true` - Requires break/return in switch cases
- `moduleResolution: "bundler"` - Vite-compatible module resolution
- `jsx: "react-jsx"` - Modern JSX transform (no React import needed)
- `noEmit: true` - TypeScript used for type checking only; Vite handles compilation
- `isolatedModules: true` - Ensures compatibility with Vite's per-file transpilation
- `types: ["vite/client"]` - Vite client types for import.meta and asset imports

**Custom type declarations:** `src/vite-env.d.ts` declares modules for image imports (`.jpeg`, `.jpg`, `.png`, `.svg`, `.gif`, `.webp`)

## Build Configuration

**Vite config:** `vite.config.ts`
- Minimal configuration: only the React plugin enabled
- No custom aliases, proxy, or environment variable configuration
- ESM module type (`"type": "module"` in `package.json`)

**Build output:** `dist/` directory (gitignored)

## Scripts

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite production build (tsc && vite build)
npm run preview    # Preview production build locally
npm run lint       # ESLint with zero warnings tolerance
```

## Platform Requirements

**Development:**
- Node.js (v22+ detected, likely works with v18+)
- npm
- No native dependencies or platform-specific requirements

**Production:**
- Static file hosting only (SPA with `index.html` entry)
- No server-side rendering
- No backend server required (data fetched from Google Sheets CSV endpoint)
- Build output is pure HTML/CSS/JS in `dist/`

---

*Stack analysis: 2026-04-12*
