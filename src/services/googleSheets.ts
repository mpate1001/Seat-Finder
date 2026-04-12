import { Guest } from '../types';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2CjdXZd0XrE_Q9_BoNWhIqr69ElM60e7CgVvYSWIVA4QRs8CtVV-3UWqWaco9jk9iestkouEd_7en/pub?output=csv';

const HEADER_MAP: Record<keyof Guest, string> = {
  tableNumber: 'table number',
  firstName: 'first name',
  lastName: 'last name',
  contactInfo: 'contact info',
  description: 'guest description',
};

export async function fetchGuests(): Promise<Guest[]> {
  try {
    const response = await fetch(SHEET_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch guest list: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

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

    const missing = (Object.keys(idx) as (keyof Guest)[])
      .filter((k) => idx[k] === undefined);
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
  } catch (error) {
    console.error('Error fetching guest data:', error);
    throw new Error('Failed to load guest list. Please try again.');
  }
}

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
