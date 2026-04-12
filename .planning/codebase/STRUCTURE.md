# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
Seat-Finder/
├── dist/                    # Vite production build output (committed)
│   ├── assets/              # Hashed JS, CSS, and image bundles
│   └── index.html           # Production HTML entry
├── src/                     # Application source code
│   ├── assets/              # Static images (floor plan, background photo)
│   ├── components/          # React UI components with co-located CSS
│   ├── config/              # JSON configuration files
│   ├── services/            # Data fetching and external integrations
│   ├── App.tsx              # Root application component
│   ├── App.css              # Root component styles
│   ├── main.tsx             # React DOM entry point
│   ├── index.css            # Global base styles
│   ├── types.ts             # Shared TypeScript interfaces
│   └── vite-env.d.ts        # Vite client type declarations
├── index.html               # Vite HTML entry point
├── package.json             # Dependencies and scripts
├── package-lock.json        # Dependency lockfile
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
├── CLAUDE.md                # AI assistant instructions
└── README.md                # Project readme
```

## Directory Purposes

**`src/`:**
- Purpose: All application source code
- Contains: TypeScript/TSX components, CSS, services, types, config, assets
- Key files: `App.tsx` (root), `main.tsx` (entry), `types.ts` (shared types)

**`src/components/`:**
- Purpose: React UI components
- Contains: `.tsx` component files with co-located `.css` files
- Key files:
  - `SearchForm.tsx` / `SearchForm.css` -- Name search input with debounce
  - `GuestDropdown.tsx` / `GuestDropdown.css` -- Search results list
  - `TableModal.tsx` / `TableModal.css` -- Selected guest modal with floor plan
  - `FloorPlan.tsx` / `FloorPlan.css` -- Interactive floor plan with table marker

**`src/services/`:**
- Purpose: External data fetching logic
- Contains: Google Sheets CSV fetcher and parser
- Key files: `googleSheets.ts` -- `fetchGuests()` function and CSV parser

**`src/config/`:**
- Purpose: Static JSON configuration
- Contains: Floor plan table position mappings
- Key files: `floorPlan.json` -- Maps table numbers (1-54) to pixel coordinates

**`src/assets/`:**
- Purpose: Static image assets bundled by Vite
- Contains: Background photo (`mahsompw-6074Z70_6074.jpeg`), floor plan diagram (`Reception Seat Diagram.png`)

**`dist/`:**
- Purpose: Production build output
- Contains: Compiled and hashed JS/CSS bundles, optimized images, HTML
- Generated: Yes (by `npm run build`)
- Committed: Yes (currently checked into git)

## Key File Locations

**Entry Points:**
- `index.html`: Vite HTML shell, loads `src/main.tsx`
- `src/main.tsx`: React DOM mount point, renders `<App />` into `#root`
- `src/App.tsx`: Root component, all top-level state and data flow

**Configuration:**
- `package.json`: Dependencies, scripts (`dev`, `build`, `preview`, `lint`)
- `tsconfig.json`: TypeScript strict mode, ES2020 target, bundler module resolution
- `vite.config.ts`: Vite with `@vitejs/plugin-react`, no custom settings
- `src/config/floorPlan.json`: Table number to pixel coordinate mapping

**Core Logic:**
- `src/App.tsx`: Guest search filtering, state management, data loading
- `src/services/googleSheets.ts`: CSV fetch from Google Sheets, CSV line parsing
- `src/components/FloorPlan.tsx`: Image scaling calculations, marker positioning

**Types:**
- `src/types.ts`: `Guest` interface (shared across app)
- `src/vite-env.d.ts`: Vite client type references

**Styles:**
- `src/index.css`: Global reset and base body styles
- `src/App.css`: Root layout, card, typography, responsive breakpoints
- `src/components/SearchForm.css`: Search input styling
- `src/components/GuestDropdown.css`: Dropdown list styling
- `src/components/TableModal.css`: Modal overlay and content styling
- `src/components/FloorPlan.css`: Floor plan image, markers, enlarged view

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` (e.g., `FloorPlan.tsx`, `SearchForm.tsx`)
- CSS: PascalCase `.css` matching component name (e.g., `FloorPlan.css`)
- Services: camelCase `.ts` (e.g., `googleSheets.ts`)
- Types: camelCase `.ts` (e.g., `types.ts`)
- Config: camelCase `.json` (e.g., `floorPlan.json`)

**Directories:**
- All lowercase: `components/`, `services/`, `config/`, `assets/`

## Where to Add New Code

**New UI Component:**
- Create `src/components/ComponentName.tsx`
- Create `src/components/ComponentName.css` for co-located styles
- Import and use from `src/App.tsx` or parent component
- Export as default function component

**New Service/Data Source:**
- Create `src/services/serviceName.ts`
- Export async functions that return typed data
- Import types from `src/types.ts`

**New Shared Type:**
- Add interface/type to `src/types.ts`

**New Configuration:**
- Add JSON file to `src/config/`
- Import directly in consuming component (Vite handles JSON imports)

**New Static Asset:**
- Add to `src/assets/`
- Import in component file (Vite handles asset imports with hashing)

**New Utility/Helper:**
- Currently no `src/utils/` directory exists; create one if needed
- Use camelCase `.ts` file naming

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (via `npm run build` which runs `tsc && vite build`)
- Committed: Yes (should likely be in `.gitignore` but is currently tracked)

**`.idea/`:**
- Purpose: JetBrains IDE configuration
- Generated: Yes
- Committed: Yes (should likely be in `.gitignore`)

**`.omc/`:**
- Purpose: External tool state (mission/agent tracking)
- Generated: Yes
- Committed: Unknown

**`.planning/`:**
- Purpose: Codebase analysis documents
- Generated: Yes (by mapping tools)
- Committed: As needed

---

*Structure analysis: 2026-04-12*
