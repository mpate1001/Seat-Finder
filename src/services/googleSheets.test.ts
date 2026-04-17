import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Guest } from '../types';
import { parseGuestsCsv } from './googleSheets';

const HEADER_LINE =
  'Table Number,First Name,Last Name,Contact Info,Guest Description';

describe('parseGuestsCsv', () => {
  it('returns Guest[] for a valid single-row CSV', () => {
    const csv = `${HEADER_LINE}\n1,Alice,Smith,alice@x.com,VIP\n`;
    const guests: Guest[] = parseGuestsCsv(csv);
    expect(guests).toHaveLength(1);
    expect(guests[0]).toEqual({
      tableNumber: '1',
      firstName: 'Alice',
      lastName: 'Smith',
      contactInfo: 'alice@x.com',
      description: 'VIP',
    });
  });

  it('handles quoted fields containing commas', () => {
    const csv = `${HEADER_LINE}\n2,"Bob","Jones, Jr.",bob@x,""\n`;
    const guests = parseGuestsCsv(csv);
    expect(guests).toHaveLength(1);
    expect(guests[0].lastName).toBe('Jones, Jr.');
  });

  it('throws when required column headers are missing', () => {
    const csv = 'Table Number,First Name\n1,Alice\n';
    expect(() => parseGuestsCsv(csv)).toThrow(/missing required column/);
  });

  it('treats reordered columns as valid (header-indexed, not positional)', () => {
    const csv =
      'Guest Description,Last Name,First Name,Contact Info,Table Number\n' +
      'friend,Smith,Alice,alice@x.com,7\n';
    const guests = parseGuestsCsv(csv);
    expect(guests[0].tableNumber).toBe('7');
    expect(guests[0].description).toBe('friend');
  });
});

describe('module load guard', () => {
  const originalEnv = import.meta.env.VITE_SHEET_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws when VITE_SHEET_URL is empty string', async () => {
    vi.stubEnv('VITE_SHEET_URL', '');
    await expect(import('./googleSheets?guard-empty')).rejects.toThrow(
      /VITE_SHEET_URL is not set/
    );
  });

  it('loads successfully when VITE_SHEET_URL is set', async () => {
    // Sanity -- in the normal test env (.env.local), the import should not throw.
    expect(originalEnv).toBeTruthy();
    const mod = await import('./googleSheets?guard-ok');
    expect(mod.SHEET_URL).toBe(originalEnv);
  });
});
