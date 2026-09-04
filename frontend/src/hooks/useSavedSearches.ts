import { useCallback, useEffect, useState } from 'react';
import type { SavedSearch } from '../types.ts';
import {
  MAX_SAVED_SEARCHES,
  SAVED_SEARCHES_KEY,
  createId,
  loadSavedSearches,
  normalizeName,
  persistSavedSearches,
} from '../storage/savedSearches.ts';

export type NewSavedSearch = Omit<SavedSearch, 'id' | 'createdAt'>;

interface UseSavedSearchesReturn {
  searches: SavedSearch[];
  add: (input: NewSavedSearch) => SavedSearch | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

/**
 * Saved searches live in localStorage. State is the source of truth in React;
 * every change is persisted, and `storage` events keep other tabs in sync.
 */
export function useSavedSearches(): UseSavedSearchesReturn {
  const [searches, setSearches] = useState<SavedSearch[]>(loadSavedSearches);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === null || e.key === SAVED_SEARCHES_KEY) {
        setSearches(loadSavedSearches());
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const commit = useCallback((next: SavedSearch[]) => {
    setSearches(next);
    persistSavedSearches(next);
  }, []);

  const add = useCallback(
    (input: NewSavedSearch): SavedSearch | null => {
      const name = normalizeName(input.name);
      if (!name) return null;
      const entry: SavedSearch = { ...input, name, id: createId(), createdAt: Date.now() };
      // Newest first; cap the list so localStorage never grows without bound.
      const next = [entry, ...loadSavedSearches()].slice(0, MAX_SAVED_SEARCHES);
      commit(next);
      return entry;
    },
    [commit],
  );

  const rename = useCallback(
    (id: string, rawName: string) => {
      const name = normalizeName(rawName);
      if (!name) return;
      commit(loadSavedSearches().map((s) => (s.id === id ? { ...s, name } : s)));
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      commit(loadSavedSearches().filter((s) => s.id !== id));
    },
    [commit],
  );

  return { searches, add, rename, remove };
}
