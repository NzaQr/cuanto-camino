export interface LatLng {
  lat: number;
  lng: number;
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

export interface BoardAlightStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  walkMeters: number;
}

export interface FoundRoute {
  line: string;
  routeName: string;
  routeDesc: string;
  boardStop: BoardAlightStop;
  alightStop: BoardAlightStop;
  shape: [number, number][];
}

export interface RouteSearchResult {
  routes: FoundRoute[];
  originStops: Stop[];
  destStops: Stop[];
}

export interface Place {
  lat: number;
  lng: number;
  displayName: string;
}

export interface RouteSearchParams {
  origin: LatLng;
  destination: LatLng;
  originRadius: number;
  destRadius: number;
}
