import type { RouteSearchParams, RouteSearchResult } from '../types.ts';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchRoutes({
  origin,
  destination,
  originRadius,
  destRadius,
}: RouteSearchParams): Promise<{ data: RouteSearchResult }> {
  const res = await fetch(`${API_BASE}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, originRadius, destRadius }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: RouteSearchResult }>;
}
