import React from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { HugeiconsIcon } from '@hugeicons/react';
import { Gps01Icon, Refresh03Icon } from '@hugeicons/core-free-icons';
import type { LocationStatus } from './UserLocation.tsx';

interface MapControlsProps {
  locationStatus: LocationStatus;
  locationError: string | null;
  onToggleLocation: () => void;
  /** Origin and destination are both set. Clicks on the map do nothing. */
  pointsLocked: boolean;
  onResetPoints: () => void;
}

/**
 * Buttons that live in Leaflet's top-right control corner, under the zoom
 * control, so they share its position and safe-area offset. Rendered through
 * a portal because the corner is a plain DOM node owned by Leaflet.
 */
function MapControls({
  locationStatus,
  locationError,
  onToggleLocation,
  pointsLocked,
  onResetPoints,
}: MapControlsProps) {
  const map = useMap();
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const corner = map.getContainer().querySelector<HTMLElement>('.leaflet-top.leaflet-right');
    if (!corner) return;
    const el = L.DomUtil.create('div', 'leaflet-control map-controls', corner);
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [map]);

  if (!host) return null;

  const locating = locationStatus === 'locating';
  const located = locationStatus === 'on';
  const locateLabel = located
    ? 'Ocultar mi ubicación'
    : locating
      ? 'Buscando tu ubicación'
      : 'Ver mi ubicación';

  // React listens on the portal host itself, so it runs before Leaflet's
  // listener on the map container. Without this stop, Leaflet still sees the
  // click, and by then React has removed the button, so Leaflet's own
  // "click disabled" check cannot find the host and treats it as a map tap.
  const stopClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div className="map-controls-inner" onClick={stopClick}>
      <button
        type="button"
        className={`map-ctl-btn${located ? ' is-active' : ''}${locating ? ' is-busy' : ''}`}
        onClick={onToggleLocation}
        aria-pressed={located}
        aria-label={locateLabel}
        title={locateLabel}
      >
        <HugeiconsIcon icon={Gps01Icon} size={20} color="currentColor" strokeWidth={1.75} />
      </button>
      {pointsLocked ? (
        <button
          type="button"
          className="map-ctl-btn map-ctl-btn--reset"
          onClick={onResetPoints}
          aria-label="Quitar origen y destino para marcar puntos nuevos"
          title="Quitar origen y destino para marcar puntos nuevos"
        >
          <HugeiconsIcon icon={Refresh03Icon} size={20} color="currentColor" strokeWidth={1.75} />
        </button>
      ) : null}
      {locationError ? (
        <div className="map-ctl-msg" role="status">
          {locationError}
        </div>
      ) : null}
    </div>,
    host,
  );
}

export default MapControls;
