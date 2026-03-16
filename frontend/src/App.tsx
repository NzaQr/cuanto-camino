import React, { useReducer, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import MapView from './components/MapView.tsx';
import SearchPanel from './components/SearchPanel.tsx';
import { useRouteSearch } from './hooks/useRouteSearch.ts';
import type { LatLng, Place } from './types.ts';
import './App.css';

const RouteResults = lazy(() => import('./components/RouteResults.tsx'));

function coordLabel(latlng: LatLng): string {
  return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

interface AppState {
  origin: LatLng | null;
  destination: LatLng | null;
  originName: string;
  destName: string;
  originRadius: number;
  destRadius: number;
  linkedRadius: boolean;
  selectedLine: string | null;
  panelOpen: boolean;
}

type AppAction =
  | { type: 'SET_ORIGIN'; place: Place }
  | { type: 'SET_DEST'; place: Place }
  | { type: 'CLEAR_ORIGIN' }
  | { type: 'CLEAR_DEST' }
  | { type: 'MAP_CLICK'; latlng: LatLng }
  | { type: 'SET_ORIGIN_RADIUS'; value: number }
  | { type: 'SET_DEST_RADIUS'; value: number }
  | { type: 'TOGGLE_LINKED_RADIUS'; checked: boolean }
  | { type: 'SELECT_LINE'; line: string | null }
  | { type: 'CLEAR_SELECTED_LINE' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'RESET' };

const initialAppState: AppState = {
  origin: null,
  destination: null,
  originName: '',
  destName: '',
  originRadius: 600,
  destRadius: 600,
  linkedRadius: true,
  selectedLine: null,
  panelOpen: true,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ORIGIN':
      return {
        ...state,
        origin: { lat: action.place.lat, lng: action.place.lng },
        originName: action.place.displayName,
      };
    case 'SET_DEST':
      return {
        ...state,
        destination: { lat: action.place.lat, lng: action.place.lng },
        destName: action.place.displayName,
      };
    case 'CLEAR_ORIGIN':
      return { ...state, origin: null, originName: '', selectedLine: null };
    case 'CLEAR_DEST':
      return { ...state, destination: null, destName: '', selectedLine: null };
    case 'MAP_CLICK': {
      const { latlng } = action;
      if (!state.origin) {
        return { ...state, origin: latlng, originName: coordLabel(latlng) };
      }
      if (!state.destination) {
        return { ...state, destination: latlng, destName: coordLabel(latlng) };
      }
      return {
        ...state,
        origin: latlng,
        originName: coordLabel(latlng),
        destination: null,
        destName: '',
        selectedLine: null,
      };
    }
    case 'SET_ORIGIN_RADIUS':
      return {
        ...state,
        originRadius: action.value,
        destRadius: state.linkedRadius ? action.value : state.destRadius,
      };
    case 'SET_DEST_RADIUS':
      return {
        ...state,
        destRadius: action.value,
        originRadius: state.linkedRadius ? action.value : state.originRadius,
      };
    case 'TOGGLE_LINKED_RADIUS':
      return {
        ...state,
        linkedRadius: action.checked,
        destRadius: action.checked ? state.originRadius : state.destRadius,
      };
    case 'SELECT_LINE':
      return { ...state, selectedLine: action.line, panelOpen: false };
    case 'CLEAR_SELECTED_LINE':
      return { ...state, selectedLine: null };
    case 'TOGGLE_PANEL':
      return { ...state, panelOpen: !state.panelOpen };
    case 'RESET':
      return { ...initialAppState };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const {
    origin,
    destination,
    originName,
    destName,
    originRadius,
    destRadius,
    linkedRadius,
    selectedLine,
    panelOpen,
  } = state;

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [panelOpen]);

  const {
    search,
    routes,
    originStops: _originStops,
    destStops: _destStops,
    suggestion,
    loading,
    error,
    reset: resetSearch,
  } = useRouteSearch();

  const handleSetOrigin = useCallback((place: Place) => {
    dispatch({ type: 'SET_ORIGIN', place });
  }, []);

  const handleSetDest = useCallback((place: Place) => {
    dispatch({ type: 'SET_DEST', place });
  }, []);

  const handleClearOrigin = useCallback(() => {
    dispatch({ type: 'CLEAR_ORIGIN' });
    resetSearch();
  }, [resetSearch]);

  const handleClearDest = useCallback(() => {
    dispatch({ type: 'CLEAR_DEST' });
    resetSearch();
  }, [resetSearch]);

  const handleMapClick = useCallback(
    (latlng: LatLng) => {
      if (origin && destination) {
        resetSearch();
      }
      dispatch({ type: 'MAP_CLICK', latlng });
    },
    [origin, destination, resetSearch],
  );

  const handleSearch = useCallback(() => {
    if (!origin || !destination) return;
    dispatch({ type: 'CLEAR_SELECTED_LINE' });
    search({ origin, destination, originRadius, destRadius });
  }, [origin, destination, originRadius, destRadius, search]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    resetSearch();
  }, [resetSearch]);

  const routeCount = routes !== null ? routes.length : null;

  const handleApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    // Update radii to the suggested values
    dispatch({ type: 'SET_ORIGIN_RADIUS', value: suggestion.originRadius });
    if (!linkedRadius) {
      dispatch({ type: 'SET_DEST_RADIUS', value: suggestion.destRadius });
    }
    // Trigger a new search with the new radii
    if (origin && destination) {
      dispatch({ type: 'CLEAR_SELECTED_LINE' });
      search({
        origin,
        destination,
        originRadius: suggestion.originRadius,
        destRadius: linkedRadius ? suggestion.originRadius : suggestion.destRadius,
      });
    }
  }, [suggestion, linkedRadius, origin, destination, search]);

  const handleSelectLine = useCallback((line: string | null) => {
    dispatch({ type: 'SELECT_LINE', line });
  }, []);

  return (
    <div className="app">
      <div className="map-container">
        <MapView
          origin={origin}
          destination={destination}
          originRadius={originRadius}
          destRadius={destRadius}
          routes={routes || []}
          selectedLine={selectedLine}
          onMapClick={handleMapClick}
        />
      </div>

      <div ref={panelRef} className={`panel-container${panelOpen ? ' panel-open' : ''}`}>
        <SearchPanel
          panelOpen={panelOpen}
          onTogglePanel={() => dispatch({ type: 'TOGGLE_PANEL' })}
          originName={originName}
          destName={destName}
          originRadius={originRadius}
          destRadius={destRadius}
          linkedRadius={linkedRadius}
          onSetOrigin={handleSetOrigin}
          onSetDest={handleSetDest}
          onClearOrigin={handleClearOrigin}
          onClearDest={handleClearDest}
          onOriginRadiusChange={(value) => dispatch({ type: 'SET_ORIGIN_RADIUS', value })}
          onDestRadiusChange={(value) => dispatch({ type: 'SET_DEST_RADIUS', value })}
          onLinkedRadiusChange={(checked) => dispatch({ type: 'TOGGLE_LINKED_RADIUS', checked })}
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
          error={error}
          routeCount={routeCount}
          suggestion={suggestion}
          onApplySuggestion={handleApplySuggestion}
        />

        {routes && routes.length > 0 ? (
          <Suspense fallback={null}>
            <RouteResults
              routes={routes}
              selectedLine={selectedLine}
              onSelectLine={handleSelectLine}
            />
          </Suspense>
        ) : null}
      </div>

      {!origin ? (
        <div className="map-hint">
          Escribí una dirección o hacé clic en el mapa para marcar el{' '}
          <strong>origen</strong>
        </div>
      ) : !destination ? (
        <div className="map-hint">
          Ahora indicá el <strong>destino</strong>
        </div>
      ) : null}
    </div>
  );
}

export default App;
