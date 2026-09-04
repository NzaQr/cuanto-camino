// Small bounded LRU cache keyed by string.
//
// Stops do not move and street networks change slowly, so an entry stays
// valid until it is evicted. The bound keeps a long-running server flat.

const MAX_ENTRIES = 20_000;

export function roundCoord(v) {
  return Math.round(v * 1e5) / 1e5; // ~1.1 m at the equator
}

export function pointKey(p) {
  if (p.id != null) return `id:${p.id}`;
  return `${roundCoord(p.lat)},${roundCoord(p.lng)}`;
}

export function createLruCache(maxEntries = MAX_ENTRIES) {
  const map = new Map();
  return {
    /** Returns the cached value (null is a valid cached value) or undefined on miss. */
    get(k) {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k); // refresh recency (Map keeps insertion order)
      map.set(k, v);
      return v;
    },
    set(k, v) {
      map.set(k, v);
      if (map.size > maxEntries) map.delete(map.keys().next().value);
    },
    get size() {
      return map.size;
    },
  };
}
