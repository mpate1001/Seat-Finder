import { Guest } from '../types';
import './TableModal.css';

interface TableModalProps {
  guest: Guest;
  onClose: () => void;
}

export default function TableModal({ guest, onClose }: TableModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          &times;
        </button>

        <div className="modal-header">
          <h2 className="guest-greeting">
            Welcome, {guest.firstName}!
          </h2>
        </div>

        <div className="table-info">
          <div className="table-label">Your Table Number</div>
          <div className="table-number">{guest.tableNumber}</div>
        </div>

        {guest.description && (
          <div className="guest-message">
            {guest.description}
          </div>
        )}

        <button className="done-button" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
