import useSWRMutation from "swr/mutation";
import { fetchRoutes } from "../api/transport.js";

async function searchRoutesMutator(_key, { arg }) {
  return fetchRoutes(arg);
}

export function useRouteSearch() {
  const { trigger, data, error, isMutating, reset } = useSWRMutation(
    "/api/routes",
    searchRoutesMutator,
  );

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
