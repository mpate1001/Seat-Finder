import { useState, useRef, useCallback, FormEvent } from 'react';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (searchTerm: string) => void;
}

export default function SearchForm({ onSearch }: SearchFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef<number | null>(null);

  const debouncedSearch = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      onSearch(value);
    }, 150);
  }, [onSearch]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Immediate search on submit
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearch(searchTerm);
  }

  function handleInputChange(value: string) {
    setSearchTerm(value);
    debouncedSearch(value);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="searchName">Search by Name</label>
        <input
          type="text"
          id="searchName"
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Enter first or last name"
          autoComplete="off"
          autoFocus
        />
      </div>
    </form>
  );
}
