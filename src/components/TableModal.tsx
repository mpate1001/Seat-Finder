import { Guest } from '../types';
import FloorPlan from './FloorPlan';
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

        {guest.description && (
          <div className="guest-message">
            {guest.description}
          </div>
        )}

        <FloorPlan tableNumber={guest.tableNumber} />

        <button className="done-button" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
