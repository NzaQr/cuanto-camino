import React from 'react';
import { Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { loadShowLocation, persistShowLocation } from '../storage/userLocation.ts';
import { BUS_ICON_ANCHOR, BUS_ICON_SIZE, renderBusModel } from './markers/busModel.ts';

export type LocationStatus = 'off' | 'locating' | 'on' | 'error';

export interface UserPosition {
  lat: number;
  lng: number;
  /** Radius of the 95% confidence circle, in meters. */
  accuracy: number;
  /** Ground speed in m/s. From the device, or derived from the last fix. */
  speed: number | null;
  /** Direction of travel in degrees clockwise from north. */
  heading: number | null;
  /** True while the user travels at vehicle speed. See RIDE_ENTER_MPS. */
  riding: boolean;
}

const LOCATE_ZOOM = 16;
const ERROR_TTL_MS = 4000;
/** Below this the accuracy ring is smaller than the dot; do not draw it. */
const MIN_RING_METERS = 25;
/**
 * Speed band that switches the marker between the dot and the bus.
 * A brisk walk is ~1.7 m/s, a run ~3 m/s, a colectivo between stops 4-8 m/s.
 * The gap between enter and leave stops the icon from flickering at a stop.
 */
const RIDE_ENTER_MPS = 4;
const RIDE_LEAVE_MPS = 1.5;
/** Fixes closer than this are noise; do not derive a heading from them. */
const MIN_HEADING_METERS = 6;

const userDotIcon = L.divIcon({
  className: 'user-dot',
  html: '<span class="user-dot-pulse"></span><span class="user-dot-core"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** A custom 3D bus projected at the current travel heading. */
function createBusIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: 'user-bus',
    html: renderBusModel(heading),
    iconSize: [BUS_ICON_SIZE, BUS_ICON_SIZE],
    iconAnchor: BUS_ICON_ANCHOR,
  });
}

const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

interface FixMemory {
  lat: number;
  lng: number;
  time: number;
  heading: number | null;
  riding: boolean;
}

/**
 * Turns a raw fix into a UserPosition. Devices without a compass or a
 * Doppler speed report null; those come from the distance to the last fix.
 */
function readFix(fix: GeolocationPosition, prev: FixMemory | null): UserPosition {
  const { coords } = fix;
  const here = { lat: coords.latitude, lng: coords.longitude };
  const moved = prev ? distanceMeters(prev, here) : 0;
  const elapsed = prev ? (fix.timestamp - prev.time) / 1000 : 0;

  let speed: number | null =
    typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0
      ? coords.speed
      : null;
  if (speed === null && prev && elapsed > 0.5) speed = moved / elapsed;

  let heading: number | null =
    typeof coords.heading === 'number' && Number.isFinite(coords.heading) ? coords.heading : null;
  if (heading === null) {
    heading = prev && moved >= MIN_HEADING_METERS ? bearingDegrees(prev, here) : (prev?.heading ?? null);
  }

  let riding = prev?.riding ?? false;
  if (speed !== null) {
    if (!riding && speed >= RIDE_ENTER_MPS) riding = true;
    else if (riding && speed < RIDE_LEAVE_MPS) riding = false;
  }

  return { ...here, accuracy: coords.accuracy, speed, heading, riding };
}

function errorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Sin permiso para usar tu ubicación';
  if (err.code === err.POSITION_UNAVAILABLE) return 'No se pudo obtener tu ubicación';
  return 'La ubicación tardó demasiado';
}

/**
 * Follows the device position with the browser Geolocation API.
 * `toggle()` starts or stops the watch from the locate button. The choice
 * survives a reload, so a returning user sees their dot without a click.
 */
export function useUserLocation() {
  const map = useMap();
  const [status, setStatus] = React.useState<LocationStatus>(() =>
    loadShowLocation() && typeof navigator !== 'undefined' && 'geolocation' in navigator
      ? 'locating'
      : 'off',
  );
  const [position, setPosition] = React.useState<UserPosition | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /** Fly to the first fix only when the user pressed the button just now. */
  const flyOnFix = React.useRef(false);
  const lastFix = React.useRef<FixMemory | null>(null);

  const active = status === 'locating' || status === 'on';

  React.useEffect(() => {
    if (!active) {
      setPosition(null);
      lastFix.current = null;
      return;
    }
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setError('Tu navegador no ofrece ubicación');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (fix) => {
        const next = readFix(fix, lastFix.current);
        lastFix.current = {
          lat: next.lat,
          lng: next.lng,
          time: fix.timestamp,
          heading: next.heading,
          riding: next.riding,
        };
        setPosition(next);
        setStatus('on');
        setError(null);
        if (flyOnFix.current) {
          flyOnFix.current = false;
          map.flyTo([next.lat, next.lng], Math.max(map.getZoom(), LOCATE_ZOOM), {
            duration: 0.8,
          });
        }
      },
      (err) => {
        setStatus('error');
        setError(errorMessage(err));
        persistShowLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // `active` is the only input that starts or stops the watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, map]);

  React.useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => {
      setError(null);
      setStatus((s) => (s === 'error' ? 'off' : s));
    }, ERROR_TTL_MS);
    return () => window.clearTimeout(t);
  }, [error]);

  const toggle = React.useCallback(() => {
    if (status === 'on' && position) {
      const inView = map.getBounds().contains([position.lat, position.lng]);
      if (!inView) {
        map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), LOCATE_ZOOM), {
          duration: 0.8,
        });
        return;
      }
      setStatus('off');
      persistShowLocation(false);
      return;
    }
    if (status === 'locating') {
      setStatus('off');
      persistShowLocation(false);
      return;
    }
    flyOnFix.current = true;
    setError(null);
    setStatus('locating');
    persistShowLocation(true);
  }, [status, position, map]);

  return { status, position, error, toggle };
}

interface UserLocationLayerProps {
  position: UserPosition | null;
}

/**
 * The blue dot and, when the fix is coarse, its accuracy ring. At vehicle
 * speed the dot becomes a 3D bus that points where the user travels.
 */
export function UserLocationLayer({ position }: UserLocationLayerProps) {
  const heading = position?.riding ? Math.round(position.heading ?? 0) : null;
  const busIcon = React.useMemo(
    () => (heading === null ? null : createBusIcon(heading)),
    [heading],
  );
  if (!position) return null;
  const center: [number, number] = [position.lat, position.lng];
  return (
    <>
      {position.accuracy > MIN_RING_METERS && !position.riding ? (
        <Circle
          center={center}
          radius={position.accuracy}
          interactive={false}
          pathOptions={{
            color: '#2563eb',
            weight: 1,
            opacity: 0.35,
            fillColor: '#2563eb',
            fillOpacity: 0.1,
          }}
        />
      ) : null}
      <Marker
        position={center}
        icon={busIcon ?? userDotIcon}
        interactive={false}
        zIndexOffset={300}
        keyboard={false}
      />
    </>
  );
}
