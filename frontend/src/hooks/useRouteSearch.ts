import useSWRMutation from 'swr/mutation';
import { fetchRoutes } from '../api/transport.ts';
import type { FoundRoute, RouteSearchParams, RouteSearchResult, Stop } from '../types.ts';

async function searchRoutesMutator(
  _key: string,
  { arg }: { arg: RouteSearchParams },
): Promise<{ data: RouteSearchResult }> {
  return fetchRoutes(arg);
}

interface UseRouteSearchReturn {
  search: (arg: RouteSearchParams) => Promise<{ data: RouteSearchResult } | undefined>;
  routes: FoundRoute[] | null;
  originStops: Stop[];
  destStops: Stop[];
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useRouteSearch(): UseRouteSearchReturn {
  const { trigger, data, error, isMutating, reset } = useSWRMutation<
    { data: RouteSearchResult },
    Error,
    string,
    RouteSearchParams
  >('/api/routes', searchRoutesMutator);

  const routes = data?.data?.routes ?? null;
  const originStops = data?.data?.originStops ?? [];
  const destStops = data?.data?.destStops ?? [];

  return {
    search: trigger,
    routes,
    originStops,
    destStops,
    loading: isMutating,
    error: error?.message ?? null,
    reset,
  };
}
