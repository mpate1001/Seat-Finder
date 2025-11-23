import { useState, FormEvent } from 'react';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (firstName: string, lastName: string) => void;
}

export default function SearchForm({ onSearch }: SearchFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(firstName, lastName);
  }

  function handleInputChange() {
    // Trigger search on every keystroke for real-time results
    setTimeout(() => {
      onSearch(firstName, lastName);
    }, 0);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="firstName">First Name</label>
        <input
          type="text"
          id="firstName"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            handleInputChange();
          }}
          placeholder="Enter first name"
          autoComplete="off"
        />
      </div>

      <div className="form-group">
        <label htmlFor="lastName">Last Name</label>
        <input
          type="text"
          id="lastName"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value);
            handleInputChange();
          }}
          placeholder="Enter last name"
          autoComplete="off"
        />
      </div>
    </form>
  );
}
