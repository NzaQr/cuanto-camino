import type { WalkUnit } from '../types.ts';

export const WALK_UNIT_KEY = 'cuanto-camino:walk-unit:v1';
export const DEFAULT_WALK_UNIT: WalkUnit = 'meters';

function isWalkUnit(value: unknown): value is WalkUnit {
  return value === 'minutes' || value === 'meters';
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The unit the user last picked in the toggle, or the default. */
export function loadWalkUnit(): WalkUnit {
  const storage = getStorage();
  if (!storage) return DEFAULT_WALK_UNIT;
  try {
    const raw = storage.getItem(WALK_UNIT_KEY);
    return isWalkUnit(raw) ? raw : DEFAULT_WALK_UNIT;
  } catch {
    return DEFAULT_WALK_UNIT;
  }
}

export function persistWalkUnit(unit: WalkUnit): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(WALK_UNIT_KEY, unit);
    return true;
  } catch {
    return false;
  }
}
