# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- None installed. No test framework (Jest, Vitest, or otherwise) is present in `package.json` dependencies or devDependencies.
- No test configuration files exist (`jest.config.*`, `vitest.config.*`, etc.)

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands available
# package.json scripts: dev, build, preview, lint
# No "test" script defined
```

## Test File Organization

**Location:**
- No test files exist anywhere in the `src/` directory.
- No `__tests__/` directories, no `*.test.*` files, no `*.spec.*` files.

**Naming:**
- No convention established. When adding tests, follow this recommended pattern:
  - Co-locate test files next to source: `src/components/SearchForm.test.tsx`
  - Or use `__tests__/` directories: `src/components/__tests__/SearchForm.test.tsx`

## Test Structure

**No tests exist.** The following sections document recommended patterns for when testing is introduced.

### Recommended Setup

Given the Vite + React + TypeScript stack, use **Vitest** (native Vite integration):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `vite.config.ts`:
```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

Add to `package.json` scripts:
```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

## Mocking

**Framework:** Not applicable (no tests).

**What would need mocking:**
- `fetch` calls in `src/services/googleSheets.ts` (fetches CSV from Google Sheets)
- Image loading events in `src/components/FloorPlan.tsx`
- Keyboard events in `src/components/TableModal.tsx` and `src/components/FloorPlan.tsx`

## Fixtures and Factories

**Test Data:**
- No test fixtures exist.
- Guest data structure is defined in `src/types.ts`:
```typescript
export interface Guest {
  tableNumber: string;
  firstName: string;
  lastName: string;
  contactInfo: string;
  description: string;
}
```

**Recommended fixture location:** `src/test/fixtures/` or `src/__mocks__/`

Sample fixture:
```typescript
// src/test/fixtures/guests.ts
import { Guest } from '../../types';

export const mockGuests: Guest[] = [
  {
    tableNumber: '1',
    firstName: 'John',
    lastName: 'Doe',
    contactInfo: 'john@example.com',
    description: 'Family of the bride',
  },
  {
    tableNumber: '5',
    firstName: 'Jane',
    lastName: 'Smith',
    contactInfo: 'jane@example.com',
    description: 'College friends',
  },
];
```

## Coverage

**Requirements:** None enforced. No coverage tooling installed.

**View Coverage:**
```bash
# Not available until Vitest is installed
# Then: npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- None exist.
- Priority targets for unit tests:
  - `src/services/googleSheets.ts` - CSV parsing logic (`parseCSVLine` function) and `fetchGuests`
  - `src/App.tsx` - Search filtering logic (`handleSearch` function)

**Integration Tests:**
- None exist.
- Priority targets:
  - Search flow: type name -> see dropdown -> select guest -> see modal
  - Error handling: failed fetch -> error display -> retry

**E2E Tests:**
- Not used. No Playwright, Cypress, or similar installed.

## Test Coverage Gaps

**All code is untested.** Priority areas by risk:

**Critical - `src/services/googleSheets.ts`:**
- CSV parsing logic handles quoted fields, escaped quotes, edge cases
- This is hand-written CSV parsing with no library -- high bug risk
- Network fetch with error handling
- Priority: High

**Critical - `src/App.tsx` search logic:**
- Name matching across first name, last name, full name, reverse name
- Empty/whitespace search term handling
- Case-insensitive matching
- Priority: High

**Medium - `src/components/SearchForm.tsx`:**
- Debounce behavior (150ms timer)
- Form submission vs. live search interaction
- Priority: Medium

**Medium - `src/components/FloorPlan.tsx`:**
- Image scaling calculations (scaleFactor, enlargedScaleFactor)
- Table position marker placement accuracy
- Missing table position graceful fallback
- Priority: Medium

**Low - `src/components/GuestDropdown.tsx`:**
- Simple presentational component, low risk
- Priority: Low

**Low - `src/components/TableModal.tsx`:**
- Modal open/close, escape key handler
- Priority: Low

## CI/CD Integration

**CI Pipeline:** None detected. No `.github/workflows/`, no `.gitlab-ci.yml`, no CI config files.

**Recommended:** Add a GitHub Actions workflow once tests are established:
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

## Summary

Testing is entirely absent from this project. There are zero test files, no test framework installed, no test scripts in `package.json`, and no CI/CD pipeline. The most critical untested code is the hand-written CSV parser in `src/services/googleSheets.ts` and the search filtering logic in `src/App.tsx`.

---

*Testing analysis: 2026-04-12*
