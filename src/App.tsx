import { useState, useEffect } from 'react';
import { Guest } from './types';
import { fetchGuests } from './services/googleSheets';
import SearchForm from './components/SearchForm';
import GuestDropdown from './components/GuestDropdown';
import TableModal from './components/TableModal';
import backgroundImage from './assets/mahsompw-6074Z70_6074.jpeg';
import './App.css';

function App() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    try {
      setLoading(true);
      const guestData = await fetchGuests();
      setGuests(guestData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guests');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(firstName: string, lastName: string) {
    if (!firstName.trim() && !lastName.trim()) {
      setSearchResults([]);
      return;
    }

    const results = guests.filter((guest) => {
      const firstMatch = firstName.trim()
        ? guest.firstName.toLowerCase().includes(firstName.toLowerCase().trim())
        : true;
      const lastMatch = lastName.trim()
        ? guest.lastName.toLowerCase().includes(lastName.toLowerCase().trim())
        : true;
      return firstMatch && lastMatch;
    });

    setSearchResults(results);
  }

  function handleGuestSelect(guest: Guest) {
    setSelectedGuest(guest);
  }

  function closeModal() {
    setSelectedGuest(null);
  }

  if (loading) {
    return (
      <div className="app-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
        <div className="card">
          <h1 className="title">Seat Finder</h1>
            <p className="subtitle">Mahek & Saumya's Reception</p>
          <div className="loading">Loading guest list...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
        <div className="card">
          <h1 className="title">Seat Finder</h1>
          <p className="subtitle">Mahek & Saumya's Wedding</p>
          <div className="error">{error}</div>
          <button className="retry-button" onClick={loadGuests}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="card">
        <h1 className="title">Seat Finder</h1>
        <p className="subtitle">Mahek & Saumya's Wedding</p>
        <p className="subtitle">May 24th 2026</p>
        <p className="subtitle">#MikeMetSaumOne</p>
        <p className="welcome-text">Welcome! Please enter your name to find your table.</p>

        <SearchForm onSearch={handleSearch} />

        {searchResults.length > 0 && (
          <GuestDropdown guests={searchResults} onSelect={handleGuestSelect} />
        )}

        {selectedGuest && (
          <TableModal guest={selectedGuest} onClose={closeModal} />
        )}
      </div>
    </div>
  );
}

export default App;
