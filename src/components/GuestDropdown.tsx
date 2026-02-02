import { Guest } from '../types';
import './GuestDropdown.css';

interface GuestDropdownProps {
  guests: Guest[];
  onSelect: (guest: Guest) => void;
}

export default function GuestDropdown({ guests, onSelect }: GuestDropdownProps) {
  return (
    <div className="guest-dropdown">
      <div className="dropdown-header">
        {guests.length === 1
          ? '1 guest found'
          : `${guests.length} guests found`}
      </div>
      <div className="dropdown-list">
        {guests.map((guest, index) => (
          <button
            key={`${guest.firstName}-${guest.lastName}-${guest.tableNumber}-${index}`}
            className="guest-item"
            onClick={() => onSelect(guest)}
          >
            <div className="guest-name">
              {guest.firstName} {guest.lastName}
            </div>
            <div className="guest-identifier">
              {guest.contactInfo || guest.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
