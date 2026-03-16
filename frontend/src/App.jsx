import React, { useState, useCallback, lazy, Suspense } from "react";
import MapView from "./components/MapView.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import { useRouteSearch } from "./hooks/useRouteSearch.js";
import "./App.css";

const RouteResults = lazy(() => import("./components/RouteResults.jsx"));

function coordLabel(latlng) {
  return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

function App() {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");
  const [originRadius, setOriginRadius] = useState(600);
  const [destRadius, setDestRadius] = useState(600);
  const [linkedRadius, setLinkedRadius] = useState(true);
  const [selectedLine, setSelectedLine] = useState(null);

  const handleOriginRadiusChange = useCallback(
    (value) => {
      setOriginRadius(value);
      if (linkedRadius) setDestRadius(value);
    },
    [linkedRadius],
  );

  const handleDestRadiusChange = useCallback(
    (value) => {
      setDestRadius(value);
      if (linkedRadius) setOriginRadius(value);
    },
    [linkedRadius],
  );

  const {
    search,
    routes,
    originStops,
    destStops,
    loading,
    error,
    reset: resetSearch,
  } = useRouteSearch();

  // Called by PlaceInput when a Nominatim suggestion is selected
  const handleSetOrigin = useCallback((place) => {
    setOrigin({ lat: place.lat, lng: place.lng });
    setOriginName(place.displayName);
  }, []);

  const handleSetDest = useCallback((place) => {
    setDestination({ lat: place.lat, lng: place.lng });
    setDestName(place.displayName);
  }, []);

  const handleClearOrigin = useCallback(() => {
    setOrigin(null);
    setOriginName("");
    setSelectedLine(null);
    resetSearch();
  }, [resetSearch]);

  const handleClearDest = useCallback(() => {
    setDestination(null);
    setDestName("");
    setSelectedLine(null);
    resetSearch();
  }, [resetSearch]);

  // Map click: first click = origin, second = destination, after that = restart
  const handleMapClick = useCallback(
    (latlng) => {
      if (!origin) {
        setOrigin(latlng);
        setOriginName(coordLabel(latlng));
      } else if (!destination) {
        setDestination(latlng);
        setDestName(coordLabel(latlng));
      } else {
        // Both already set: restart with new origin
        setOrigin(latlng);
        setOriginName(coordLabel(latlng));
        setDestination(null);
        setDestName("");
        setSelectedLine(null);
        resetSearch();
      }
    },
    [origin, destination, resetSearch],
  );

  const handleSearch = useCallback(() => {
    setSelectedLine(null);
    search({ origin, destination, originRadius, destRadius });
  }, [origin, destination, originRadius, destRadius, search]);

  const handleReset = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setOriginName("");
    setDestName("");
    setOriginRadius(600);
    setDestRadius(600);
    setLinkedRadius(true);
    setSelectedLine(null);
    resetSearch();
  }, [resetSearch]);

  const routeCount = routes !== null ? routes.length : null;

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

      <div className="panel-container">
        <SearchPanel
          originName={originName}
          destName={destName}
          originRadius={originRadius}
          destRadius={destRadius}
          linkedRadius={linkedRadius}
          onSetOrigin={handleSetOrigin}
          onSetDest={handleSetDest}
          onClearOrigin={handleClearOrigin}
          onClearDest={handleClearDest}
          onOriginRadiusChange={handleOriginRadiusChange}
          onDestRadiusChange={handleDestRadiusChange}
          onLinkedRadiusChange={setLinkedRadius}
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
          error={error}
          routeCount={routeCount}
        />

        {routes && routes.length > 0 ? (
          <Suspense fallback={null}>
            <RouteResults
              routes={routes}
              selectedLine={selectedLine}
              onSelectLine={setSelectedLine}
            />
          </Suspense>
        ) : null}
      </div>

      {!origin ? (
        <div className="map-hint">
          Escribí una dirección o hacé clic en el mapa para marcar el{" "}
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
