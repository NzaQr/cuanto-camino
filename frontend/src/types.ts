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
  /** Walking distance. Along the street network when walkSource is "network". */
  walkMeters: number;
  /** Walking time in seconds. Null when no walk provider is configured. */
  walkSeconds: number | null;
  walkSource: 'network' | 'straight';
}

export interface FoundRoute {
  line: string;
  routeName: string;
  routeDesc: string;
  boardStop: BoardAlightStop;
  alightStop: BoardAlightStop;
  shape: [number, number][];
}

/** How a walk budget is expressed: minutes of walking or meters walked. */
export type WalkUnit = 'minutes' | 'meters';

export interface RouteSuggestion {
  count: number;
  unit: WalkUnit;
  originBudget: number;
  destBudget: number;
}

/**
 * The area a person can walk to from a point within a time budget.
 * With a walk provider it is a real street-network isochrone polygon.
 * Without one it is a straight-line circle of radiusMeters.
 */
export interface WalkArea {
  center: LatLng;
  unit: WalkUnit;
  budget: number;
  source: 'network' | 'straight';
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  radiusMeters: number | null;
}

export interface RouteSearchResult {
  routes: FoundRoute[];
  originStops: Stop[];
  destStops: Stop[];
  originArea: WalkArea;
  destArea: WalkArea;
  suggestion: RouteSuggestion | null;
}

export interface Place {
  lat: number;
  lng: number;
  displayName: string;
}

export interface RouteSearchParams {
  origin: LatLng;
  destination: LatLng;
  unit: WalkUnit;
  originBudget: number;
  destBudget: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  origin: LatLng;
  originName: string;
  destination: LatLng;
  destName: string;
  unit: WalkUnit;
  originBudget: number;
  destBudget: number;
  linkedWalk: boolean;
  createdAt: number;
}
