import { useState, useEffect, useMemo } from 'react';
import { Guest } from './types';
import { SHEET_URL } from './services/googleSheets';
import { fetchGuestsCached } from './services/guestsCache';
import { buildGuestIndex, searchGuests, type RankedGuest } from './services/searchGuests';
import SearchForm from './components/SearchForm';
import GuestDropdown from './components/GuestDropdown';
import MapView from './components/MapView';
import StalenessBadge from './components/StalenessBadge';
import backgroundImage from './assets/mahsompw-6074Z70_6074.jpeg';
import './App.css';

function App() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<RankedGuest[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  // fetchedAt drives plan 04-04's StalenessBadge (rendered inside the .card
  // below). The badge is silent when online + cache is <1h old, shows
  // "Updated Xm ago" when >=1h, and "Offline — showing cached list" when
  // navigator.onLine === false. Tapping it reinvokes loadGuests.
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fuse = useMemo(() => buildGuestIndex(guests), [guests]);

  useEffect(() => {
    loadGuests();
  }, []);

  // Preload the floor-plan AVIF variants on app mount (D-15 / RESEARCH.md Pattern 5).
  // Injects a <link rel="preload"> with imagesrcset so the browser can pick the
  // correct width and start the fetch in parallel with the guest-list load.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/avif';
    link.setAttribute(
      'imagesrcset',
      '/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w',
    );
    link.setAttribute('imagesizes', '100vw');
    (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  async function loadGuests() {
    try {
      setLoading(true);
      const { guests: guestData, fetchedAt: fetchedAtIso } =
        await fetchGuestsCached(SHEET_URL);
      setGuests(guestData);
      setFetchedAt(fetchedAtIso);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guests');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(searchTerm: string) {
    setQuery(searchTerm);
    setSearchResults(searchGuests(searchTerm, guests, fuse));
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
        <StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />

        <SearchForm onSearch={handleSearch} />

        {query.trim().length > 0 && (
          <GuestDropdown
            results={searchResults}
            query={query}
            onSelect={handleGuestSelect}
          />
        )}

        {selectedGuest && (
          <MapView
            key={selectedGuest.tableNumber}
            guest={selectedGuest}
            onClose={closeModal}
          />
        )}
      </div>
      <img
        src="/floor-plan/floor-plan-1600.avif"
        style={{ display: 'none' }}
        aria-hidden="true"
        alt=""
      />
    </div>
  );
}

export default App;
