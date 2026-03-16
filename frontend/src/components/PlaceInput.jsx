import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './PlaceInput.css';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Bounding box for AMBA region: lon_min, lat_min, lon_max, lat_max
const AMBA_VIEWBOX = '-58.60,-34.80,-58.28,-34.50';

async function searchNominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: 5,
    viewbox: AMBA_VIEWBOX,
    bounded: '1',
    'accept-language': 'es',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'Accept-Language': 'es' },
  });
  if (!res.ok) return [];
  return res.json();
}

function Dropdown({ anchorRef, suggestions, onSelect }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setRect(r);
  }, [anchorRef, suggestions]);

  if (!rect) return null;

  return ReactDOM.createPortal(
    <ul
      className="place-dropdown"
      role="listbox"
      style={{
        position: 'fixed',
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      }}
    >
      {suggestions.map((result) => (
        <li
          key={result.place_id}
          className="place-suggestion"
          role="option"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(result);
          }}
        >
          <span className="suggestion-icon">📍</span>
          <span className="suggestion-text">{result.display_name}</span>
        </li>
      ))}
    </ul>,
    document.body
  );
}

function PlaceInput({ label, color, value, placeholder, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external value (set by map click or clear) into the input
  useEffect(() => {
    setQuery(value || '');
    if (!value) setSuggestions([]);
  }, [value]);

  // Debounced Nominatim search
  useEffect(() => {
    // Don't search if the query matches the already-selected value
    if (query === value) {
      setIsSearching(false);
      return;
    }
    if (query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchNominatim(query);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = useCallback((result) => {
    const place = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    };
    setQuery(result.display_name);
    setSuggestions([]);
    setShowDropdown(false);
    onSelect(place);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const handleChange = useCallback((e) => {
    setQuery(e.target.value);
    if (!e.target.value) {
      onClear();
    }
  }, [onClear]);

  const hasValue = Boolean(value);

  return (
    <div className="place-input-wrapper" ref={wrapperRef}>
      <div className={`place-input-row ${hasValue ? 'has-value' : ''}`}>
        <div className="place-dot" style={{ background: color }} />
        <div className="place-input-inner">
          <span className="place-label">{label}</span>
          <div className="place-input-field">
            <input
              ref={inputRef}
              type="text"
              className="place-text-input"
              value={query}
              onChange={handleChange}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
            {isSearching ? (
              <span className="place-spinner" />
            ) : query ? (
              <button
                type="button"
                className="place-clear-btn"
                onClick={handleClear}
                tabIndex={-1}
                aria-label="Limpiar"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showDropdown && suggestions.length > 0 ? (
        <Dropdown
          anchorRef={wrapperRef}
          suggestions={suggestions}
          onSelect={handleSelect}
        />
      ) : null}
    </div>
  );
}

export default PlaceInput;
