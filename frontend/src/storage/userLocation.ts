/** Whether the user asked to see their own position on the map. */
export const USER_LOCATION_KEY = 'cuanto-camino:show-location:v1';

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadShowLocation(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(USER_LOCATION_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistShowLocation(show: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (show) storage.setItem(USER_LOCATION_KEY, '1');
    else storage.removeItem(USER_LOCATION_KEY);
  } catch {
    /* storage can be full or blocked; the preference is a nicety */
  }
}
