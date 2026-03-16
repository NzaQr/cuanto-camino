import React, { useReducer, useEffect, useRef, useCallback, useId, useState } from 'react';
import ReactDOM from 'react-dom';
import { MapPin, X } from 'lucide-react';
import type { Place } from '../types.ts';
import './PlaceInput.css';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const AMBA_VIEWBOX = '-58.60,-34.80,-58.28,-34.50';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    viewbox: AMBA_VIEWBOX,
    bounded: '1',
    'accept-language': 'es',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'Accept-Language': 'es' },
  });
  if (!res.ok) return [];
  return res.json() as Promise<NominatimResult[]>;
}

interface SearchState {
  query: string;
  suggestions: NominatimResult[];
  isSearching: boolean;
  showDropdown: boolean;
  activeIndex: number;
}

type SearchAction =
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; results: NominatimResult[] }
  | { type: 'SEARCH_FAIL' }
  | { type: 'MOVE_ACTIVE'; delta: number }
  | { type: 'SELECT'; displayName: string }
  | { type: 'CLEAR' }
  | { type: 'OPEN_DROPDOWN' }
  | { type: 'CLOSE_DROPDOWN' }
  | { type: 'SYNC_VALUE'; value: string };

const initialSearchState: SearchState = {
  query: '',
  suggestions: [],
  isSearching: false,
  showDropdown: false,
  activeIndex: -1,
};

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.query, activeIndex: -1 };
    case 'SEARCH_START':
      return { ...state, isSearching: true };
    case 'SEARCH_SUCCESS':
      return {
        ...state,
        suggestions: action.results,
        isSearching: false,
        showDropdown: action.results.length > 0,
        activeIndex: -1,
      };
    case 'SEARCH_FAIL':
      return { ...state, suggestions: [], isSearching: false, showDropdown: false };
    case 'MOVE_ACTIVE': {
      const max = state.suggestions.length - 1;
      const next = state.activeIndex + action.delta;
      return { ...state, activeIndex: Math.max(-1, Math.min(max, next)) };
    }
    case 'SELECT':
      return {
        ...state,
        query: action.displayName,
        suggestions: [],
        isSearching: false,
        showDropdown: false,
        activeIndex: -1,
      };
    case 'CLEAR':
      return { ...initialSearchState };
    case 'OPEN_DROPDOWN':
      return { ...state, showDropdown: state.suggestions.length > 0 };
    case 'CLOSE_DROPDOWN':
      return { ...state, showDropdown: false };
    case 'SYNC_VALUE':
      return {
        ...state,
        query: action.value || '',
        suggestions: [],
        isSearching: false,
        showDropdown: false,
        activeIndex: -1,
      };
    default:
      return state;
  }
}

interface DropdownProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  suggestions: NominatimResult[];
  activeIndex: number;
  listboxId: string;
  optionIdPrefix: string;
  onSelect: (result: NominatimResult) => void;
}

function Dropdown({ anchorRef, suggestions, activeIndex, listboxId, optionIdPrefix, onSelect }: DropdownProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

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
      id={listboxId}
      style={{
        position: 'fixed',
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      }}
    >
      {suggestions.map((result, i) => (
        <li
          key={result.place_id}
          id={`${optionIdPrefix}-${i}`}
          className={`place-suggestion${i === activeIndex ? ' active' : ''}`}
          role="option"
          aria-selected={i === activeIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(result);
          }}
        >
          <MapPin size={12} className="suggestion-icon" />
          <span className="suggestion-text">{result.display_name}</span>
        </li>
      ))}
    </ul>,
    document.body,
  );
}

interface PlaceInputProps {
  label: string;
  color: string;
  value: string;
  placeholder: string;
  onSelect: (place: Place) => void;
  onClear: () => void;
}

function PlaceInput({ label, color, value, placeholder, onSelect, onClear }: PlaceInputProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionIdPrefix = `${id}-option`;

  const [state, dispatch] = useReducer(searchReducer, {
    ...initialSearchState,
    query: value || '',
  });
  const { query, suggestions, isSearching, showDropdown, activeIndex } = state;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    isSyncingRef.current = true;
    dispatch({ type: 'SYNC_VALUE', value });
  }, [value]);

  useEffect(() => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    if (query === value) return;
    if (query.length < 3) {
      dispatch({ type: 'SEARCH_FAIL' });
      return;
    }
    dispatch({ type: 'SEARCH_START' });
    const timer = setTimeout(async () => {
      try {
        const results = await searchNominatim(query);
        dispatch({ type: 'SEARCH_SUCCESS', results });
      } catch {
        dispatch({ type: 'SEARCH_FAIL' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, value]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        dispatch({ type: 'CLOSE_DROPDOWN' });
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = useCallback(
    (result: NominatimResult) => {
      dispatch({ type: 'SELECT', displayName: result.display_name });
      onSelect({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      });
    },
    [onSelect],
  );

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_QUERY', query: e.target.value });
      if (!e.target.value) onClear();
    },
    [onClear],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        dispatch({ type: 'MOVE_ACTIVE', delta: 1 });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        dispatch({ type: 'MOVE_ACTIVE', delta: -1 });
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      } else if (e.key === 'Escape') {
        dispatch({ type: 'CLOSE_DROPDOWN' });
      }
    },
    [showDropdown, activeIndex, suggestions, handleSelect],
  );

  const hasValue = Boolean(value);
  const activeOptionId = activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined;

  return (
    <div className="place-input-wrapper" ref={wrapperRef}>
      <div className={`place-input-row ${hasValue ? 'has-value' : ''}`}>
        <div className="place-dot" style={{ background: color }} />
        <div className="place-input-inner">
          <span className="place-label">{label}</span>
          <div className="place-input-field">
            <input
              ref={inputRef}
              id={id}
              type="text"
              className="place-text-input"
              value={query}
              onChange={handleChange}
              onFocus={() => dispatch({ type: 'OPEN_DROPDOWN' })}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showDropdown}
              aria-haspopup="listbox"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
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
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showDropdown ? (
        <Dropdown
          anchorRef={wrapperRef}
          suggestions={suggestions}
          activeIndex={activeIndex}
          listboxId={listboxId}
          optionIdPrefix={optionIdPrefix}
          onSelect={handleSelect}
        />
      ) : null}
    </div>
  );
}

export default PlaceInput;
