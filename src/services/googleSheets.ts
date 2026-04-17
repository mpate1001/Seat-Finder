import { Guest } from '../types';

// -- Env var (PERF-04, D-17/D-18) ---------------------------------------------
// Module-load-time guard. Throws immediately if VITE_SHEET_URL is missing, so
// downstream code never sees an undefined URL. Build-time enforcement also lives
// in vite.config.ts (requireSheetUrl plugin) to fail CI before the bundle ships.
export const SHEET_URL: string = import.meta.env.VITE_SHEET_URL;

if (!SHEET_URL) {
  throw new Error(
    'VITE_SHEET_URL is not set. Copy .env.example to .env.local and set the Sheets CSV URL.'
  );
}

// -- CSV column mapping -------------------------------------------------------
const HEADER_MAP: Record<keyof Guest, string> = {
  tableNumber: 'table number',
  firstName: 'first name',
  lastName: 'last name',
  contactInfo: 'contact info',
  description: 'guest description',
};

// -- Public API ---------------------------------------------------------------

/**
 * Parse a raw CSV string into Guest[]. Header-indexed (not positional) so the
 * source sheet can reorder columns without breaking the app.
 *
 * Throws Error with a user-friendly message if:
 *   - The CSV is empty
 *   - Any required column header is missing
 */
export function parseGuestsCsv(csvText: string): Guest[] {
  const lines = csvText.split('\n');
  if (lines.length === 0 || !lines[0].trim()) {
    throw new Error('Guest list is empty');
  }

  const headerIndex = buildHeaderIndex(lines[0]);

  const idx: Record<keyof Guest, number | undefined> = {
    tableNumber: headerIndex[HEADER_MAP.tableNumber],
    firstName: headerIndex[HEADER_MAP.firstName],
    lastName: headerIndex[HEADER_MAP.lastName],
    contactInfo: headerIndex[HEADER_MAP.contactInfo],
    description: headerIndex[HEADER_MAP.description],
  };

  const missing = (Object.keys(idx) as (keyof Guest)[]).filter((k) => idx[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Guest list is missing required column(s): ${missing.join(', ')}`);
  }

  const guests: Guest[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCSVLine(line);
    guests.push({
      tableNumber: (fields[idx.tableNumber!] ?? '').trim(),
      firstName: (fields[idx.firstName!] ?? '').trim(),
      lastName: (fields[idx.lastName!] ?? '').trim(),
      contactInfo: (fields[idx.contactInfo!] ?? '').trim(),
      description: (fields[idx.description!] ?? '').trim(),
    });
  }

  return guests;
}

/**
 * Fetch the published Google Sheets CSV and parse it.
 * Preserves the existing user-facing error surface (try/catch + re-throw).
 * Network-first caching lives in guestsCache.ts (plan 04-02), NOT here --
 * this function remains the unwrapped "always hit the network" path.
 */
export async function fetchGuests(): Promise<Guest[]> {
  try {
    const response = await fetch(SHEET_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch guest list: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseGuestsCsv(csvText);
  } catch (error) {
    console.error('Error fetching guest data:', error);
    throw new Error('Failed to load guest list. Please try again.');
  }
}

// -- Internals ----------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes (two double quotes in a row)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function buildHeaderIndex(headerLine: string): Record<string, number> {
  const headers = parseCSVLine(headerLine);
  const index: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    if (key in index) {
      console.warn(`Duplicate CSV header "${key}" at column ${i}; using rightmost occurrence`);
    }
    index[key] = i;
  });
  return index;
}
