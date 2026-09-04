import type { LatLng, SavedSearch, WalkUnit } from '../types.ts';

export const SAVED_SEARCHES_KEY = 'cuanto-camino:saved-searches:v2';
/** v1 stored walk budgets in meters (originRadius / destRadius). */
const LEGACY_V1_KEY = 'cuanto-camino:saved-searches:v1';
const LEGACY_WALK_SPEED_MPS = 1.25;
const MIN_WALK_MINUTES = 2;
const MAX_WALK_MINUTES = 30;
export const MAX_SAVED_SEARCHES = 50;
export const MAX_NAME_LENGTH = 60;

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Number.isFinite(v.lat) && Number.isFinite(v.lng);
}

function isSavedSearch(value: unknown): value is SavedSearch {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isLatLng(v.origin) &&
    isLatLng(v.destination) &&
    typeof v.originName === 'string' &&
    typeof v.destName === 'string' &&
    (v.unit === 'minutes' || v.unit === 'meters') &&
    Number.isFinite(v.originBudget) &&
    Number.isFinite(v.destBudget) &&
    typeof v.linkedWalk === 'boolean' &&
    Number.isFinite(v.createdAt)
  );
}

function metersToMinutes(meters: number): number {
  const minutes = Math.round(meters / (60 * LEGACY_WALK_SPEED_MPS));
  return Math.min(MAX_WALK_MINUTES, Math.max(MIN_WALK_MINUTES, minutes));
}

/** Convert a v1 record (meters) to the current shape, or null when malformed. */
function migrateV1(value: unknown): SavedSearch | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!Number.isFinite(v.originRadius) || !Number.isFinite(v.destRadius)) return null;
  const { originRadius, destRadius, linkedRadius, ...rest } = v;
  const candidate = {
    ...rest,
    unit: 'minutes' as WalkUnit,
    originBudget: metersToMinutes(originRadius as number),
    destBudget: metersToMinutes(destRadius as number),
    linkedWalk: typeof linkedRadius === 'boolean' ? linkedRadius : true,
  };
  return isSavedSearch(candidate) ? candidate : null;
}

function loadLegacyV1(storage: Storage): SavedSearch[] {
  try {
    const raw = storage.getItem(LEGACY_V1_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateV1).filter((s): s is SavedSearch => s !== null);
  } catch {
    return [];
  }
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSavedSearches(): SavedSearch[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_SEARCHES_KEY);
    if (!raw) {
      // First load after the meters -> minutes change: carry v1 data over.
      const migrated = loadLegacyV1(storage);
      if (migrated.length) {
        storage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(migrated));
        storage.removeItem(LEGACY_V1_KEY);
      }
      return migrated;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedSearch);
  } catch {
    return [];
  }
}

export function persistSavedSearches(searches: SavedSearch[]): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
    return true;
  } catch {
    return false;
  }
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

const COORD_LABEL = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

/** First address segment ("Av. Corrientes 1234" from a full Nominatim name). Coordinate labels stay whole. */
export function shortPlace(name: string): string {
  const trimmed = name.trim();
  if (COORD_LABEL.test(trimmed)) return trimmed;
  const first = trimmed.split(',')[0]?.trim();
  return first || trimmed;
}

/** Default name for the save dialog: "Origen → Destino" using the first address segment. */
export function suggestName(originName: string, destName: string): string {
  return normalizeName(`${shortPlace(originName)} → ${shortPlace(destName)}`);
}

const COORD_EPSILON = 1e-6;

function sameLatLng(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lng - b.lng) < COORD_EPSILON;
}

export interface SearchSnapshot {
  origin: LatLng;
  destination: LatLng;
  unit: WalkUnit;
  originBudget: number;
  destBudget: number;
}

/** Returns the saved search that matches the given points and walk budgets, if any. */
export function findMatchingSearch(
  searches: SavedSearch[],
  snapshot: SearchSnapshot,
): SavedSearch | undefined {
  return searches.find(
    (s) =>
      sameLatLng(s.origin, snapshot.origin) &&
      sameLatLng(s.destination, snapshot.destination) &&
      s.unit === snapshot.unit &&
      s.originBudget === snapshot.originBudget &&
      s.destBudget === snapshot.destBudget,
  );
}
