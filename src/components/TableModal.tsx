import { useEffect } from 'react';
import { Guest } from '../types';
import FloorPlan from './FloorPlan';
import './TableModal.css';

interface TableModalProps {
  guest: Guest;
  onClose: () => void;
}

export default function TableModal({ guest, onClose }: TableModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
