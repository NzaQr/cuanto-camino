import { useSyncExternalStore } from 'react';

/** Viewport width, in px, at or below which the app uses the mobile bottom sheet. */
export const SHEET_MAX_WIDTH = 640;
export const MOBILE_MQ = `(max-width: ${SHEET_MAX_WIDTH}px)`;

function subscribe(query: string, onChange: () => void): () => void {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True while the media query matches. Re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
  );
}
