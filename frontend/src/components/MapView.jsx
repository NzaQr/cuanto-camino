import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const BA_CENTER = [-34.6037, -58.3816];
const ZOOM = 13;

// SVG-based colored markers (no external CDN needed)
function createColoredIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"
      fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.85"/>
  </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const originIcon = createColoredIcon("#1e8e3e");
const destIcon = createColoredIcon("#d93025");

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function FitBounds({ origin, destination, selectedRoute }) {
  const map = useMap();

  React.useEffect(() => {
    if (origin && destination) {
      map.fitBounds(
        [
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ],
        {
          padding: [40, 60],
          maxZoom: 17,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute?.line, origin, destination]);

  return null;
}

function RoutePolylines({ routes, selectedLine }) {
  const selected = selectedLine
    ? routes.find((r) => r.line === selectedLine)
    : null;
  if (!selected || selected.shape.length === 0) return null;
  return (
    <Polyline
      key={selected.line}
      positions={selected.shape}
      pathOptions={{ color: "#1a73e8", weight: 5, opacity: 0.9 }}
    />
  );
}

function MapView({
  origin,
  destination,
  originRadius,
  destRadius,
  routes,
  selectedLine,
  onMapClick,
}) {
  const hasRoutes = routes && routes.length > 0;
  const selectedRoute = hasRoutes
    ? routes.find((r) => r.line === selectedLine)
    : null;

  // Derive unique found stops from route results (board = origin side, alight = dest side)
  const foundBoardStops = hasRoutes
    ? [...new Map(routes.map((r) => [r.boardStop.id, r.boardStop])).values()]
    : [];
  const foundAlightStops = hasRoutes
    ? [...new Map(routes.map((r) => [r.alightStop.id, r.alightStop])).values()]
    : [];

  return (
    <MapContainer
      center={BA_CENTER}
      zoom={ZOOM}
      style={{ width: "100%", height: "100%" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <FitBounds
        origin={origin}
        destination={destination}
        selectedRoute={selectedRoute}
      />

      {origin ? (
        <>
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <strong>Origen</strong>
              <br />
              {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
            </Popup>
          </Marker>
          <Circle
            center={[origin.lat, origin.lng]}
            radius={originRadius}
            pathOptions={{
              color: "#1e8e3e",
              fillColor: "#1e8e3e",
              fillOpacity: 0.07,
              weight: 1.5,
            }}
          />
        </>
      ) : null}

      {destination ? (
        <>
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>
              <strong>Destino</strong>
              <br />
              {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
            </Popup>
          </Marker>
          <Circle
            center={[destination.lat, destination.lng]}
            radius={destRadius}
            pathOptions={{
              color: "#d93025",
              fillColor: "#d93025",
              fillOpacity: 0.07,
              weight: 1.5,
            }}
          />
        </>
      ) : null}

      {hasRoutes ? (
        <RoutePolylines routes={routes} selectedLine={selectedLine} />
      ) : null}

      {foundBoardStops.map((s) => (
        <CircleMarker
          key={`board-${s.id}`}
          center={[s.lat, s.lng]}
          radius={4}
          pathOptions={{
            color: "#1e8e3e",
            fillColor: "#1e8e3e",
            fillOpacity: 0.7,
            weight: 1,
          }}
        >
          <Popup>
            {s.name}
            <br />
            <small>Subida — a {s.walkMeters}m del origen</small>
          </Popup>
        </CircleMarker>
      ))}

      {foundAlightStops.map((s) => (
        <CircleMarker
          key={`alight-${s.id}`}
          center={[s.lat, s.lng]}
          radius={4}
          pathOptions={{
            color: "#d93025",
            fillColor: "#d93025",
            fillOpacity: 0.7,
            weight: 1,
          }}
        >
          <Popup>
            {s.name}
            <br />
            <small>Bajada — a {s.walkMeters}m del destino</small>
          </Popup>
        </CircleMarker>
      ))}

      {selectedRoute ? (
        <>
          <CircleMarker
            center={[selectedRoute.boardStop.lat, selectedRoute.boardStop.lng]}
            radius={8}
            pathOptions={{
              color: "#1a73e8",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <strong>Subida — Línea {selectedRoute.line}</strong>
              <br />
              {selectedRoute.boardStop.name}
              <br />
              <small>
                A {selectedRoute.boardStop.walkMeters}m de tu origen
              </small>
            </Popup>
          </CircleMarker>
          <CircleMarker
            center={[
              selectedRoute.alightStop.lat,
              selectedRoute.alightStop.lng,
            ]}
            radius={8}
            pathOptions={{
              color: "#1a73e8",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <strong>Bajada — Línea {selectedRoute.line}</strong>
              <br />
              {selectedRoute.alightStop.name}
              <br />
              <small>
                A {selectedRoute.alightStop.walkMeters}m de tu destino
              </small>
            </Popup>
          </CircleMarker>
        </>
      ) : null}
    </MapContainer>
  );
}

export default MapView;
