import { Guest } from '../types';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2CjdXZd0XrE_Q9_BoNWhIqr69ElM60e7CgVvYSWIVA4QRs8CtVV-3UWqWaco9jk9iestkouEd_7en/pub?output=csv';

export async function fetchGuests(): Promise<Guest[]> {
  try {
    const response = await fetch(SHEET_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch guest list: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.split('\n');
    const guests: Guest[] = [];

    // Skip header row (index 0), start from index 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parser (handles quoted fields)
      const fields = parseCSVLine(line);

      if (fields.length >= 5) {
        guests.push({
          tableNumber: fields[0].trim(),
          firstName: fields[1].trim(),
          lastName: fields[2].trim(),
          contactInfo: fields[3].trim(),
          description: fields[4].trim(),
        });
      }
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
