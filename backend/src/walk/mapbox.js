// Mapbox Matrix and Isochrone APIs, walking profile.
// Matrix:    https://docs.mapbox.com/api/navigation/matrix/
//            25 coordinates per request for walking (origin + 24 targets).
// Isochrone: https://docs.mapbox.com/api/navigation/isochrone/
//            Up to 4 contours per request: contours_minutes (1..60) or
//            contours_meters (1..100000). A request uses one of the two.

const MATRIX = 'https://api.mapbox.com/directions-matrix/v1/mapbox/walking';
const ISOCHRONE = 'https://api.mapbox.com/isochrone/v1/mapbox/walking';

function toLeg(seconds, meters) {
  if (seconds == null || meters == null) return null;
  return { meters: Math.round(meters), seconds: Math.round(seconds) };
}

export function createMapboxProvider({ token, timeoutMs }) {
  return {
    name: 'mapbox',
    maxTargets: 24,
    maxContours: 4,

    async matrix(origin, targets) {
      const coords = [origin, ...targets].map((p) => `${p.lng},${p.lat}`).join(';');
      const params = new URLSearchParams({
        sources: '0',
        annotations: 'distance,duration',
        access_token: token,
      });
      const res = await fetch(`${MATRIX}/${coords}?${params}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.code !== 'Ok') throw new Error(body.message || body.code || 'bad response');

      const durations = body.durations?.[0] ?? [];
      const distances = body.distances?.[0] ?? [];
      // Index 0 is the origin itself; targets start at 1.
      return targets.map((_, i) => toLeg(durations[i + 1], distances[i + 1]));
    },

    /**
     * Returns one GeoJSON geometry per requested value, same order.
     * `unit` is "minutes" or "meters"; values are ascending integers.
     */
    async isochrone(center, values, unit) {
      const params = new URLSearchParams({
        [unit === 'meters' ? 'contours_meters' : 'contours_minutes']: values.join(','),
        polygons: 'true',
        access_token: token,
      });
      const res = await fetch(`${ISOCHRONE}/${center.lng},${center.lat}?${params}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.code && body.code !== 'Ok') throw new Error(body.message || body.code);

      // properties.contour carries the requested value in the requested unit.
      const byValue = new Map(
        (body.features ?? []).map((f) => [Number(f.properties?.contour), f.geometry]),
      );
      return values.map((v) => byValue.get(v) ?? null);
    },
  };
}
