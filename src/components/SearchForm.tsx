import { useState, FormEvent } from 'react';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (searchTerm: string) => void;
}

export default function SearchForm({ onSearch }: SearchFormProps) {
  const [searchTerm, setSearchTerm] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(searchTerm);
  }

  function handleInputChange(value: string) {
    setSearchTerm(value);
    // Trigger search on every keystroke for real-time results
    setTimeout(() => {
      onSearch(value);
    }, 0);
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
