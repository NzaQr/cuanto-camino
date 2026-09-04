import React, { useReducer, useCallback, lazy, Suspense } from 'react';
import MapView from './components/MapView.tsx';
import SearchPanel from './components/SearchPanel.tsx';
import PanelBrand from './components/PanelBrand.tsx';
import MobileSheet from './components/MobileSheet.tsx';
import { useRouteSearch } from './hooks/useRouteSearch.ts';
import { useMediaQuery, MOBILE_MQ } from './hooks/useMediaQuery.ts';
import { useSavedSearches } from './hooks/useSavedSearches.ts';
import SavedSearches from './components/SavedSearches.tsx';
import InstallPrompt from './components/InstallPrompt.tsx';
import { findMatchingSearch, suggestName } from './storage/savedSearches.ts';
import { loadWalkUnit, persistWalkUnit } from './storage/walkUnit.ts';
import type { LatLng, Place, SavedSearch, WalkUnit } from './types.ts';
import { WALK_LIMITS, convertBudget } from './walk.ts';
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
  walkUnit: WalkUnit;
  originBudget: number;
  destBudget: number;
  linkedWalk: boolean;
  selectedLine: string | null;
  panelOpen: boolean;
}

type AppAction =
  | { type: 'SET_ORIGIN'; place: Place }
  | { type: 'SET_DEST'; place: Place }
  | { type: 'CLEAR_ORIGIN' }
  | { type: 'CLEAR_DEST' }
  | { type: 'MAP_CLICK'; latlng: LatLng }
  | { type: 'SET_WALK_UNIT'; unit: WalkUnit }
  | { type: 'SET_ORIGIN_BUDGET'; value: number }
  | { type: 'SET_DEST_BUDGET'; value: number }
  | { type: 'TOGGLE_LINKED_WALK'; checked: boolean }
  | { type: 'SELECT_LINE'; line: string | null }
  | { type: 'CLEAR_SELECTED_LINE' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SET_PANEL_OPEN'; open: boolean }
  | { type: 'LOAD_SAVED'; saved: SavedSearch }
  | { type: 'RESET' };

/** Fresh state in the unit the user last picked (see storage/walkUnit). */
function createInitialState(walkUnit: WalkUnit): AppState {
  return {
    origin: null,
    destination: null,
    originName: '',
    destName: '',
    walkUnit,
    originBudget: WALK_LIMITS[walkUnit].default,
    destBudget: WALK_LIMITS[walkUnit].default,
    linkedWalk: true,
    selectedLine: null,
    panelOpen: true,
  };
}

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
    case 'SET_WALK_UNIT': {
      if (action.unit === state.walkUnit) return state;
      return {
        ...state,
        walkUnit: action.unit,
        originBudget: convertBudget(state.walkUnit, action.unit, state.originBudget),
        destBudget: convertBudget(state.walkUnit, action.unit, state.destBudget),
      };
    }
    case 'SET_ORIGIN_BUDGET':
      return {
        ...state,
        originBudget: action.value,
        destBudget: state.linkedWalk ? action.value : state.destBudget,
      };
    case 'SET_DEST_BUDGET':
      return {
        ...state,
        destBudget: action.value,
        originBudget: state.linkedWalk ? action.value : state.originBudget,
      };
    case 'TOGGLE_LINKED_WALK':
      return {
        ...state,
        linkedWalk: action.checked,
        destBudget: action.checked ? state.originBudget : state.destBudget,
      };
    case 'SELECT_LINE':
      return { ...state, selectedLine: action.line, panelOpen: false };
    case 'CLEAR_SELECTED_LINE':
      return { ...state, selectedLine: null };
    case 'TOGGLE_PANEL':
      return { ...state, panelOpen: !state.panelOpen };
    case 'SET_PANEL_OPEN':
      return { ...state, panelOpen: action.open };
    case 'LOAD_SAVED': {
      const { saved } = action;
      return {
        ...state,
        origin: { ...saved.origin },
        originName: saved.originName,
        destination: { ...saved.destination },
        destName: saved.destName,
        walkUnit: saved.unit,
        originBudget: saved.originBudget,
        destBudget: saved.destBudget,
        linkedWalk: saved.linkedWalk,
        selectedLine: null,
        panelOpen: true,
      };
    }
    case 'RESET':
      return createInitialState(loadWalkUnit());
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState(loadWalkUnit()));
  const {
    origin,
    destination,
    originName,
    destName,
    walkUnit,
    originBudget,
    destBudget,
    linkedWalk,
    selectedLine,
    panelOpen,
  } = state;

  const isMobile = useMediaQuery(MOBILE_MQ);

  const setPanelOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_PANEL_OPEN', open });
  }, []);

  const {
    search,
    routes,
    originStops: _originStops,
    destStops: _destStops,
    originArea,
    destArea,
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
    search({ origin, destination, unit: walkUnit, originBudget, destBudget });
  }, [origin, destination, walkUnit, originBudget, destBudget, search]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    resetSearch();
  }, [resetSearch]);

  const routeCount = routes !== null ? routes.length : null;

  const handleApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    // Update walk budgets to the suggested values
    dispatch({ type: 'SET_ORIGIN_BUDGET', value: suggestion.originBudget });
    if (!linkedWalk) {
      dispatch({ type: 'SET_DEST_BUDGET', value: suggestion.destBudget });
    }
    // Trigger a new search with the new budgets
    if (origin && destination) {
      dispatch({ type: 'CLEAR_SELECTED_LINE' });
      search({
        origin,
        destination,
        unit: suggestion.unit,
        originBudget: suggestion.originBudget,
        destBudget: linkedWalk ? suggestion.originBudget : suggestion.destBudget,
      });
    }
  }, [suggestion, linkedWalk, origin, destination, search]);

  const handleSelectLine = useCallback((line: string | null) => {
    dispatch({ type: 'SELECT_LINE', line });
  }, []);

  const { searches: savedSearches, add: addSaved, rename: renameSaved, remove: removeSaved } =
    useSavedSearches();

  const canSave = Boolean(origin && destination);
  const activeSaved =
    origin && destination
      ? findMatchingSearch(savedSearches, { origin, destination, unit: walkUnit, originBudget, destBudget })
      : undefined;

  const handleSaveSearch = useCallback(
    (name: string) => {
      if (!origin || !destination) return;
      addSaved({
        name,
        origin,
        originName,
        destination,
        destName,
        unit: walkUnit,
        originBudget,
        destBudget,
        linkedWalk,
      });
    },
    [origin, destination, originName, destName, walkUnit, originBudget, destBudget, linkedWalk, addSaved],
  );

  const handleLoadSaved = useCallback(
    (saved: SavedSearch) => {
      dispatch({ type: 'LOAD_SAVED', saved });
      search({
        origin: saved.origin,
        destination: saved.destination,
        unit: saved.unit,
        originBudget: saved.originBudget,
        destBudget: saved.destBudget,
      });
    },
    [search],
  );

  const panelContent = (
    <>
      <SearchPanel
        originName={originName}
        destName={destName}
        walkUnit={walkUnit}
        originBudget={originBudget}
        destBudget={destBudget}
        linkedWalk={linkedWalk}
        onSetOrigin={handleSetOrigin}
        onSetDest={handleSetDest}
        onClearOrigin={handleClearOrigin}
        onClearDest={handleClearDest}
        onWalkUnitChange={(unit) => {
          // Only an explicit pick in the toggle is a preference. A saved
          // search that loads its own unit does not change it.
          persistWalkUnit(unit);
          dispatch({ type: 'SET_WALK_UNIT', unit });
        }}
        onOriginBudgetChange={(value) => dispatch({ type: 'SET_ORIGIN_BUDGET', value })}
        onDestBudgetChange={(value) => dispatch({ type: 'SET_DEST_BUDGET', value })}
        onLinkedWalkChange={(checked) => dispatch({ type: 'TOGGLE_LINKED_WALK', checked })}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
        error={error}
        routeCount={routeCount}
        suggestion={suggestion}
        onApplySuggestion={handleApplySuggestion}
        canSave={canSave}
        savedName={activeSaved?.name ?? null}
        suggestedName={suggestName(originName, destName)}
        onSave={handleSaveSearch}
      />

      <SavedSearches
        searches={savedSearches}
        activeId={activeSaved?.id ?? null}
        onLoad={handleLoadSaved}
        onRename={renameSaved}
        onRemove={removeSaved}
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

      <InstallPrompt />
    </>
  );

  return (
    <div className="app">
      <div className="map-container">
        <MapView
          origin={origin}
          destination={destination}
          walkUnit={walkUnit}
          originBudget={originBudget}
          destBudget={destBudget}
          originArea={originArea}
          destArea={destArea}
          routes={routes || []}
          selectedLine={selectedLine}
          panelOpen={panelOpen}
          onMapClick={handleMapClick}
        />
      </div>

      {isMobile ? (
        <MobileSheet open={panelOpen} onOpenChange={setPanelOpen}>
          {panelContent}
        </MobileSheet>
      ) : (
        <div className="panel-container">
          <div className="panel-header">
            <PanelBrand heading />
          </div>
          {panelContent}
        </div>
      )}

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
