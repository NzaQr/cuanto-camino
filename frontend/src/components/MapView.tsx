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
import type { LatLng, FoundRoute } from "../types.ts";

const BA_CENTER: [number, number] = [-34.6037, -58.3816];
const ZOOM = 13;

function ZoomControlToTopRight() {
  const map = useMap();
  React.useEffect(() => {
    const zoomControl = L.control.zoom({ position: "topright" });
    zoomControl.addTo(map);
    return () => {
      map.removeControl(zoomControl);
    };
  }, [map]);
  return null;
}

/**
 * Leaflet measures container size once at init. If fonts, 100dvh, or the mobile
 * sheet settle after that, vector layers (Circle SVG paths / markers) can paint
 * at wrong pixel coords until a remount. Invalidate after layout + sheet motion.
 */
function MapLayoutSync({ panelOpen }: { panelOpen: boolean }) {
  const map = useMap();

  const syncSize = React.useCallback(() => {
    const container = map.getContainer();
    if (!container.clientWidth || !container.clientHeight) return;
    map.invalidateSize({ animate: false });
  }, [map]);

  React.useEffect(() => {
    syncSize();
    const raf = requestAnimationFrame(() => {
      syncSize();
      requestAnimationFrame(syncSize);
    });

    window.addEventListener("resize", syncSize);
    window.addEventListener("orientationchange", syncSize);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncSize);

    void document.fonts?.ready?.then(() => {
      syncSize();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncSize);
      window.removeEventListener("orientationchange", syncSize);
      vv?.removeEventListener("resize", syncSize);
    };
  }, [map, syncSize]);

  React.useEffect(() => {
    const t1 = window.setTimeout(syncSize, 40);
    const t2 = window.setTimeout(syncSize, 280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [panelOpen, syncSize]);

  return null;
}

const ORIGIN_COLOR = "#0d9488";
const DEST_COLOR = "#e11d48";
const ROUTE_COLOR = "#171717";

function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "map-pin",
    html: `<svg class="map-pin-glyph" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path fill="${color}" d="M14 0C7.373 0 2 5.373 2 12c0 8.25 12 24 12 24s12-15.75 12-24C26 5.373 20.627 0 14 0z"/><circle cx="14" cy="12" r="4.5" fill="#fff"/></svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -30],
  });
}

const originIcon = createColoredIcon(ORIGIN_COLOR);
const destIcon = createColoredIcon(DEST_COLOR);

interface ClickHandlerProps {
  onMapClick: (latlng: LatLng) => void;
}

function ClickHandler({ onMapClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

interface FitBoundsProps {
  origin: LatLng | null;
  destination: LatLng | null;
  selectedRoute: FoundRoute | null;
}

function FitBounds({ origin, destination, selectedRoute }: FitBoundsProps) {
  const map = useMap();

  React.useEffect(() => {
    if (origin && destination) {
      map.fitBounds(
        [
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ],
        {
          padding: [48, 72],
          maxZoom: 17,
        },
      );
      // fitBounds can leave SVG overlays one frame stale on first pairing
      requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute?.line, origin, destination]);

  return null;
}

interface RoutePolylinesProps {
  routes: FoundRoute[];
  selectedLine: string | null;
}

function RoutePolylines({ routes, selectedLine }: RoutePolylinesProps) {
  const selected = selectedLine
    ? routes.find((r) => r.line === selectedLine)
    : null;
  if (!selected || selected.shape.length === 0) return null;
  return (
    <Polyline
      key={selected.line}
      positions={selected.shape}
      pathOptions={{ color: ROUTE_COLOR, weight: 5, opacity: 0.9 }}
    />
  );
}

interface MapViewProps {
  origin: LatLng | null;
  destination: LatLng | null;
  originRadius: number;
  destRadius: number;
  routes: FoundRoute[];
  selectedLine: string | null;
  panelOpen: boolean;
  onMapClick: (latlng: LatLng) => void;
}

function MapView({
  origin,
  destination,
  originRadius,
  destRadius,
  routes,
  selectedLine,
  panelOpen,
  onMapClick,
}: MapViewProps) {
  const hasRoutes = routes && routes.length > 0;
  const selectedRoute = hasRoutes
    ? (routes.find((r) => r.line === selectedLine) ?? null)
    : null;

  const foundBoardStops = hasRoutes
    ? [...new Map(routes.map((r) => [r.boardStop.id, r.boardStop])).values()]
    : [];
  const foundAlightStops = hasRoutes
    ? [...new Map(routes.map((r) => [r.alightStop.id, r.alightStop])).values()]
    : [];

  const tileUrl = import.meta.env.VITE_STADIAMAPS_API_KEY
    ? `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIAMAPS_API_KEY}`
    : "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={BA_CENTER}
      zoom={ZOOM}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      <ZoomControlToTopRight />
      <MapLayoutSync panelOpen={panelOpen} />
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url={tileUrl}
      />
      <ClickHandler onMapClick={onMapClick} />
      <FitBounds
        origin={origin}
        destination={destination}
        selectedRoute={selectedRoute}
      />

      {origin ? (
        <>
          <Marker
            position={[origin.lat, origin.lng]}
            icon={originIcon}
            zIndexOffset={200}
          >
            <Popup>
              <strong>Origen</strong>
              <br />
              {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
            </Popup>
          </Marker>
          <Circle
            key={`origin-circle-${origin.lat}-${origin.lng}-${originRadius}`}
            center={[origin.lat, origin.lng]}
            radius={originRadius}
            pathOptions={{
              color: ORIGIN_COLOR,
              fillColor: ORIGIN_COLOR,
              fillOpacity: 0.1,
              weight: 2,
              opacity: 0.85,
            }}
          />
        </>
      ) : null}

      {destination ? (
        <>
          <Marker
            position={[destination.lat, destination.lng]}
            icon={destIcon}
            zIndexOffset={210}
          >
            <Popup>
              <strong>Destino</strong>
              <br />
              {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
            </Popup>
          </Marker>
          <Circle
            key={`dest-circle-${destination.lat}-${destination.lng}-${destRadius}`}
            center={[destination.lat, destination.lng]}
            radius={destRadius}
            pathOptions={{
              color: DEST_COLOR,
              fillColor: DEST_COLOR,
              fillOpacity: 0.1,
              weight: 2,
              opacity: 0.85,
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
            color: ORIGIN_COLOR,
            fillColor: ORIGIN_COLOR,
            fillOpacity: 0.75,
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
            color: DEST_COLOR,
            fillColor: DEST_COLOR,
            fillOpacity: 0.75,
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
              color: ROUTE_COLOR,
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
              color: ROUTE_COLOR,
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
