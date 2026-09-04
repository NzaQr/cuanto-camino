import { pointInGeometry } from "./walk/geometry.js";

// Approximate degrees per meter at Buenos Aires latitude (~34°S)
const METERS_PER_DEG_LAT = 111_000;
const METERS_PER_DEG_LON = 90_000;

// Walk speed used when the walk provider gives no data: 4.5 km/h.
export const FALLBACK_WALK_SPEED_MPS = 1.25;
// Generous speed for the candidate bounding box around an isochrone.
const BBOX_WALK_SPEED_MPS = 1.6;

// Walk budget units and their limits. A budget is either minutes of walking
// or meters walked, both measured along the street network when a walk
// provider is on.
export const WALK_UNITS = ["minutes", "meters"];
export const WALK_LIMITS = {
  minutes: { min: 1, max: 30, step: 1, default: 8 },
  meters: { min: 50, max: 2500, step: 50, default: 600 },
};
// Suggestion contours: the requested budget plus three larger steps.
const CONTOUR_STEPS = [1, 1.25, 1.5, 2];

function metersToLatDelta(m) {
  return m / METERS_PER_DEG_LAT;
}

function metersToLonDelta(m) {
  return m / METERS_PER_DEG_LON;
}

export function minutesToMeters(minutes) {
  return Math.round(minutes * 60 * FALLBACK_WALK_SPEED_MPS);
}

/** Straight-line radius that stands in for a budget when there is no provider. */
function budgetToMeters(unit, value) {
  return unit === "meters" ? value : minutesToMeters(value);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function walkCostSeconds(stop) {
  return stop.walkSeconds ?? stop.walkMeters / FALLBACK_WALK_SPEED_MPS;
}

/**
 * Ascending, unique budget values in the given unit: the requested budget
 * first, then larger steps used only to build a suggestion when nothing is
 * found. Values snap to the unit step so a suggestion is selectable.
 */
export function contourPlan(unit, budget, maxContours = CONTOUR_STEPS.length) {
  const { min, max, step } = WALK_LIMITS[unit];
  const values = [];
  for (const factor of CONTOUR_STEPS) {
    const raw = Math.round((budget * factor) / step) * step;
    const v = Math.min(max, Math.max(min, raw));
    if (!values.includes(v)) values.push(v);
  }
  return values.slice(0, maxContours);
}

// Resolve real walking legs from a point to a set of stops (deduped by id).
// Returns a Map stop_id -> WalkLeg | null.
async function walkLegsByStopId(walk, from, stops) {
  const unique = new Map();
  for (const s of stops) if (!unique.has(s.stop_id)) unique.set(s.stop_id, s);
  const targets = [...unique.values()].map((s) => ({
    id: s.stop_id,
    lat: s.stop_lat,
    lng: s.stop_lon,
  }));
  const legs = await walk.walkLegs(from, targets);
  return new Map(targets.map((t, i) => [t.id, legs[i]]));
}

function toStopSummary(stop, straightMeters, leg) {
  return {
    id: stop.stop_id,
    name: stop.stop_name,
    lat: stop.stop_lat,
    lng: stop.stop_lon,
    walkMeters: leg ? leg.meters : straightMeters,
    walkSeconds: leg ? leg.seconds : null,
    walkSource: leg ? "network" : "straight",
  };
}

export function createRouting(db, walk) {
  const stopsInBbox = db.prepare(`
    SELECT stop_id, stop_name, stop_lat, stop_lon
    FROM stops
    WHERE stop_lat BETWEEN ? AND ?
      AND stop_lon BETWEEN ? AND ?
  `);

  const stopById = db.prepare(
    "SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_id = ?",
  );

  const shapePoints = db.prepare(`
    SELECT shape_pt_lat, shape_pt_lon
    FROM shapes
    WHERE shape_id = ?
    ORDER BY shape_pt_sequence
  `);

  function stopsInBboxAround(lat, lon, radiusMeters) {
    const dLat = metersToLatDelta(radiusMeters);
    const dLon = metersToLonDelta(radiusMeters);
    return stopsInBbox.all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);
  }

  /**
   * Walk area around a point, one level per contour value.
   *
   * Each level holds the stops reachable within that budget. Level 0 is the
   * requested budget; later levels feed the suggestion. With a walk provider
   * the levels are real isochrones; otherwise they are straight-line circles.
   */
  async function resolveArea(center, unit, budget) {
    const plan = contourPlan(unit, budget, walk.maxContours);
    const maxValue = plan[plan.length - 1];

    const geometries = await walk.isochrones(center, plan, unit);
    if (geometries) {
      const bboxMeters =
        (unit === "meters" ? maxValue : maxValue * 60 * BBOX_WALK_SPEED_MPS) + 100;
      const candidates = stopsInBboxAround(center.lat, center.lng, bboxMeters);
      return {
        source: "network",
        levels: plan.map((v, i) => ({
          budget: v,
          polygon: geometries[i],
          radiusMeters: null,
          stops: candidates.filter((s) =>
            pointInGeometry(s.stop_lat, s.stop_lon, geometries[i]),
          ),
        })),
      };
    }

    const maxMeters = budgetToMeters(unit, maxValue);
    const candidates = stopsInBboxAround(center.lat, center.lng, maxMeters).map(
      (s) => ({
        ...s,
        dist: haversineMeters(center.lat, center.lng, s.stop_lat, s.stop_lon),
      }),
    );
    return {
      source: "straight",
      levels: plan.map((v) => {
        const r = budgetToMeters(unit, v);
        return {
          budget: v,
          polygon: null,
          radiusMeters: r,
          stops: candidates.filter((s) => s.dist <= r),
        };
      }),
    };
  }

  function toAreaSummary(center, unit, budget, area) {
    const level = area.levels[0];
    return {
      center: { lat: center.lat, lng: center.lng },
      unit,
      budget,
      source: area.source,
      polygon: level.polygon,
      radiusMeters: level.radiusMeters,
    };
  }

  const ROUTE_JOIN = `
    FROM route_stops rs_o
    JOIN route_stops rs_d
      ON rs_o.route_id = rs_d.route_id
      AND rs_o.direction_id = rs_d.direction_id
      AND rs_d.stop_sequence > rs_o.stop_sequence
    JOIN routes r ON rs_o.route_id = r.route_id
  `;

  function placeholders(ids) {
    return ids.map(() => "?").join(",");
  }

  // COUNT-only query for the suggestion.
  function countRoutesForStops(originStops, destStops) {
    const originIds = originStops.map((s) => s.stop_id);
    const destIds = destStops.map((s) => s.stop_id);
    const sql = `
      SELECT COUNT(DISTINCT r.route_short_name) as count
      ${ROUTE_JOIN}
      WHERE rs_o.stop_id IN (${placeholders(originIds)})
        AND rs_d.stop_id IN (${placeholders(destIds)})
    `;
    return db.prepare(sql).get(...originIds, ...destIds)?.count || 0;
  }

  // First larger level pair with at least one direct line, or null.
  function findSuggestion(unit, originArea, destArea) {
    const depth = Math.max(originArea.levels.length, destArea.levels.length);
    for (let i = 1; i < depth; i++) {
      const o = originArea.levels[Math.min(i, originArea.levels.length - 1)];
      const d = destArea.levels[Math.min(i, destArea.levels.length - 1)];
      if (!o.stops.length || !d.stops.length) continue;
      const count = countRoutesForStops(o.stops, d.stops);
      if (count > 0) {
        return { count, unit, originBudget: o.budget, destBudget: d.budget };
      }
    }
    return null;
  }

  /**
   * @param {{lat:number,lng:number}} origin
   * @param {{lat:number,lng:number}} destination
   * @param {{unit:"minutes"|"meters", origin:number, dest:number}} budget
   */
  async function findRoutes(origin, destination, budget) {
    const { unit } = budget;
    const [originArea, destArea] = await Promise.all([
      resolveArea(origin, unit, budget.origin),
      resolveArea(destination, unit, budget.dest),
    ]);
    const originStops = originArea.levels[0].stops;
    const destStops = destArea.levels[0].stops;

    const base = {
      originStops,
      destStops,
      originArea: toAreaSummary(origin, unit, budget.origin, originArea),
      destArea: toAreaSummary(destination, unit, budget.dest, destArea),
    };

    if (!originStops.length || !destStops.length) {
      return {
        ...base,
        routes: [],
        suggestion: findSuggestion(unit, originArea, destArea),
      };
    }

    const originIds = originStops.map((s) => s.stop_id);
    const destIds = destStops.map((s) => s.stop_id);

    const sql = `
      SELECT
        r.route_short_name AS line,
        r.route_long_name,
        r.route_desc,
        rs_o.shape_id,
        rs_o.trip_id,
        rs_o.stop_id  AS board_stop_id,
        rs_d.stop_id  AS alight_stop_id
      ${ROUTE_JOIN}
      WHERE rs_o.stop_id IN (${placeholders(originIds)})
        AND rs_d.stop_id IN (${placeholders(destIds)})
      GROUP BY r.route_short_name
      LIMIT 300
    `;

    const rows = db.prepare(sql).all(...originIds, ...destIds);

    if (!rows.length) {
      return {
        ...base,
        routes: [],
        suggestion: findSuggestion(unit, originArea, destArea),
      };
    }

    const byLine = new Map();
    for (const row of rows) {
      if (!byLine.has(row.line)) byLine.set(row.line, row);
    }

    const originStopMap = new Map(originStops.map((s) => [s.stop_id, s]));
    const destStopMap = new Map(destStops.map((s) => [s.stop_id, s]));

    // Resolve stops first so the walk provider gets one deduped batch per side.
    const resolved = [];
    for (const [, row] of byLine) {
      const boardStop =
        originStopMap.get(row.board_stop_id) || stopById.get(row.board_stop_id);
      const alightStop =
        destStopMap.get(row.alight_stop_id) || stopById.get(row.alight_stop_id);
      if (!boardStop || !alightStop) continue;
      resolved.push({ row, boardStop, alightStop });
    }

    const [boardLegs, alightLegs] = await Promise.all([
      walkLegsByStopId(walk, origin, resolved.map((r) => r.boardStop)),
      walkLegsByStopId(walk, destination, resolved.map((r) => r.alightStop)),
    ]);

    const routes = [];
    for (const { row, boardStop, alightStop } of resolved) {
      const shape = row.shape_id
        ? shapePoints
            .all(row.shape_id)
            .map((p) => [p.shape_pt_lat, p.shape_pt_lon])
        : [];

      const boardDist = Math.round(
        haversineMeters(origin.lat, origin.lng, boardStop.stop_lat, boardStop.stop_lon),
      );
      const alightDist = Math.round(
        haversineMeters(
          destination.lat,
          destination.lng,
          alightStop.stop_lat,
          alightStop.stop_lon,
        ),
      );

      routes.push({
        line: row.line,
        routeName: row.route_long_name || row.line,
        routeDesc: row.route_desc || "",
        boardStop: toStopSummary(boardStop, boardDist, boardLegs.get(boardStop.stop_id)),
        alightStop: toStopSummary(
          alightStop,
          alightDist,
          alightLegs.get(alightStop.stop_id),
        ),
        shape,
      });
    }

    // Less total walking first. Uses real walk time when the provider gave
    // it, and a straight-line estimate otherwise, so mixed rows still order.
    routes.sort(
      (a, b) =>
        walkCostSeconds(a.boardStop) +
        walkCostSeconds(a.alightStop) -
        (walkCostSeconds(b.boardStop) + walkCostSeconds(b.alightStop)),
    );

    return { ...base, routes, suggestion: null };
  }

  function getStopsInBbox(south, west, north, east) {
    const stops = stopsInBbox.all(south, north, west, east);
    return stops.slice(0, 500);
  }

  return { findRoutes, getStopsInBbox };
}
