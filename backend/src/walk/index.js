// Walk provider adapter.
//
// A walk provider answers two questions along the real street network:
//   matrix(origin, targets)     -> walking distance and time to each target
//   isochrone(center, values, unit) -> the area reachable within each budget,
//                                      in minutes of walking or meters walked
//
// Select the provider with WALK_PROVIDER: "mapbox" | "ors" | "none" (default).
// With "none" the app keeps straight-line circles and no walk time.

import { createMapboxProvider } from './mapbox.js';
import { createOrsProvider } from './ors.js';
import { createLruCache, pointKey, roundCoord } from './cache.js';

/**
 * @typedef {{ lat: number, lng: number, id?: string }} Point
 * @typedef {{ meters: number, seconds: number }} WalkLeg
 */

const REQUEST_TIMEOUT_MS = 5000;

function buildProvider(env) {
  const name = (env.WALK_PROVIDER || 'none').toLowerCase();
  if (name === 'mapbox') {
    if (!env.MAPBOX_TOKEN) throw new Error('WALK_PROVIDER=mapbox needs MAPBOX_TOKEN');
    return createMapboxProvider({ token: env.MAPBOX_TOKEN, timeoutMs: REQUEST_TIMEOUT_MS });
  }
  if (name === 'ors') {
    if (!env.ORS_API_KEY) throw new Error('WALK_PROVIDER=ors needs ORS_API_KEY');
    return createOrsProvider({ apiKey: env.ORS_API_KEY, timeoutMs: REQUEST_TIMEOUT_MS });
  }
  if (name === 'none') return null;
  throw new Error(`Unknown WALK_PROVIDER "${name}". Use mapbox, ors or none.`);
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function originKey(p) {
  return `${roundCoord(p.lat)},${roundCoord(p.lng)}`;
}

/**
 * Create the walk service used by routing. Every method degrades to "no
 * data" (null) on provider off, timeout, quota error or unreachable target.
 * Callers must fall back to straight-line data; a search never fails
 * because of the walk provider.
 */
export function createWalkService(env = process.env) {
  const provider = buildProvider(env);
  const legCache = createLruCache();
  const areaCache = createLruCache(2000);

  /** One WalkLeg or null per target, same order. */
  async function walkLegs(origin, targets) {
    if (!provider || !targets.length) return targets.map(() => null);

    const results = new Array(targets.length).fill(null);
    const missing = [];
    targets.forEach((t, i) => {
      const hit = legCache.get(`${provider.name}|${originKey(origin)}|${pointKey(t)}`);
      if (hit !== undefined) results[i] = hit;
      else missing.push(i);
    });
    if (!missing.length) return results;

    await Promise.all(
      chunk(missing, provider.maxTargets).map(async (indexes) => {
        let legs;
        try {
          legs = await provider.matrix(origin, indexes.map((i) => targets[i]));
        } catch (err) {
          console.warn(`[walk:${provider.name}] matrix failed:`, err.message);
          return;
        }
        indexes.forEach((targetIndex, k) => {
          const leg = legs[k] ?? null;
          results[targetIndex] = leg;
          legCache.set(
            `${provider.name}|${originKey(origin)}|${pointKey(targets[targetIndex])}`,
            leg,
          );
        });
      }),
    );
    return results;
  }

  /**
   * One GeoJSON geometry per budget value, same order, or null for the whole
   * list when the provider is off or the request failed. `values` must be
   * ascending integers within the provider limits; `unit` is "minutes" or
   * "meters".
   */
  async function isochrones(center, values, unit) {
    if (!provider || !values.length) return null;
    if (values.length > provider.maxContours) {
      throw new Error(`${provider.name} allows at most ${provider.maxContours} contours`);
    }
    const key = `${provider.name}|${originKey(center)}|${unit}|${values.join(',')}`;
    const hit = areaCache.get(key);
    if (hit !== undefined) return hit;

    let geometries;
    try {
      geometries = await provider.isochrone(center, values, unit);
    } catch (err) {
      console.warn(`[walk:${provider.name}] isochrone failed:`, err.message);
      return null;
    }
    // A missing contour makes the whole answer unusable for filtering.
    const result = geometries.every(Boolean) ? geometries : null;
    areaCache.set(key, result);
    return result;
  }

  return {
    enabled: Boolean(provider),
    providerName: provider?.name ?? 'none',
    maxContours: provider?.maxContours ?? Infinity,
    walkLegs,
    isochrones,
  };
}
