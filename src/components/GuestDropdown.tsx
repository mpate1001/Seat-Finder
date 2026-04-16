import { Guest } from '../types';
import { type RankedGuest } from '../services/searchGuests';
import HighlightedText from './HighlightedText';
import './GuestDropdown.css';

interface GuestDropdownProps {
  results: RankedGuest[];
  query: string;
  onSelect: (guest: Guest) => void;
}

export default function GuestDropdown({ results, query, onSelect }: GuestDropdownProps) {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  if (results.length === 0) {
    return (
      <div className="guest-dropdown">
        <div className="no-results">
          No guests match '{trimmed}'. Check spelling or try last name only.
        </div>
      </div>
    );
  }

  return (
    <div className="guest-dropdown">
      <div className="dropdown-header">
        {results.length === 1
          ? '1 guest found'
          : `${results.length} guests found`}
      </div>
      <div className="dropdown-list">
        {results.map((r, index) => {
          const fnMatch = r.matches.find((m) => m.key === 'firstName');
          const lnMatch = r.matches.find((m) => m.key === 'lastName');
          return (
            <button
              key={`${r.guest.firstName}-${r.guest.lastName}-${r.guest.tableNumber}-${index}`}
              className="guest-item"
              onClick={() => onSelect(r.guest)}
            >
              <div className="guest-name">
                <HighlightedText text={r.guest.firstName} ranges={fnMatch?.indices ?? []} />{' '}
                <HighlightedText text={r.guest.lastName} ranges={lnMatch?.indices ?? []} />
              </div>
              <div className="guest-identifier">
                {r.guest.contactInfo || r.guest.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
