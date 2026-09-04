// openrouteservice Matrix and Isochrones APIs, foot-walking profile.
// Matrix:     https://openrouteservice.org/dev/#/api-docs/v2/matrix/{profile}/post
//             3500 routes per request. 1 source x 50 targets is well inside.
// Isochrones: https://openrouteservice.org/dev/#/api-docs/v2/isochrones/{profile}/post
//             Up to 10 intervals. range_type "time" (seconds) or "distance" (meters).
// Free tier note: isochrones are limited to 500 requests per day.

const MATRIX = 'https://api.openrouteservice.org/v2/matrix/foot-walking';
const ISOCHRONE = 'https://api.openrouteservice.org/v2/isochrones/foot-walking';

function toLeg(seconds, meters) {
  if (seconds == null || meters == null) return null;
  return { meters: Math.round(meters), seconds: Math.round(seconds) };
}

export function createOrsProvider({ apiKey, timeoutMs }) {
  const headers = { Authorization: apiKey, 'Content-Type': 'application/json' };

  async function post(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    name: 'ors',
    maxTargets: 50,
    maxContours: 10,

    async matrix(origin, targets) {
      const body = await post(MATRIX, {
        locations: [origin, ...targets].map((p) => [p.lng, p.lat]),
        sources: [0],
        metrics: ['distance', 'duration'],
        units: 'm',
      });
      const durations = body.durations?.[0] ?? [];
      const distances = body.distances?.[0] ?? [];
      return targets.map((_, i) => toLeg(durations[i + 1], distances[i + 1]));
    },

    /**
     * Returns one GeoJSON geometry per requested value, same order.
     * `unit` is "minutes" or "meters"; values are ascending integers.
     */
    async isochrone(center, values, unit) {
      const meters = unit === 'meters';
      const body = await post(ISOCHRONE, {
        locations: [[center.lng, center.lat]],
        range: meters ? values : values.map((m) => m * 60),
        range_type: meters ? 'distance' : 'time',
      });
      // properties.value is in seconds for time and meters for distance.
      const byValue = new Map(
        (body.features ?? []).map((f) => [Number(f.properties?.value), f.geometry]),
      );
      return values.map((v) => byValue.get(meters ? v : v * 60) ?? null);
    },
  };
}
