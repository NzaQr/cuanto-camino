// Approximate degrees per meter at Buenos Aires latitude (~34°S)
const METERS_PER_DEG_LAT = 111_000;
const METERS_PER_DEG_LON = 90_000;

function metersToLatDelta(m) {
  return m / METERS_PER_DEG_LAT;
}

function metersToLonDelta(m) {
  return m / METERS_PER_DEG_LON;
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

export function createRouting(db) {
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

  function findStopsNear(lat, lon, radiusMeters) {
    const dLat = metersToLatDelta(radiusMeters);
    const dLon = metersToLonDelta(radiusMeters);
    const candidates = stopsInBbox.all(
      lat - dLat,
      lat + dLat,
      lon - dLon,
      lon + dLon,
    );
    // Refine with actual distance (bbox overshoots corners)
    return candidates.filter(
      (s) => haversineMeters(lat, lon, s.stop_lat, s.stop_lon) <= radiusMeters,
    );
  }

  // COUNT-only query for suggestion logic - accepts pre-resolved stop arrays
  function countRoutesForStops(originStops, destStops) {
    const originIds = originStops.map((s) => s.stop_id);
    const destIds = destStops.map((s) => s.stop_id);

    const oPlaceholders = originIds.map(() => "?").join(",");
    const dPlaceholders = destIds.map(() => "?").join(",");

    const sql = `
      SELECT COUNT(DISTINCT r.route_short_name) as count
      FROM route_stops rs_o
      JOIN route_stops rs_d
        ON rs_o.route_id = rs_d.route_id
        AND rs_o.direction_id = rs_d.direction_id
        AND rs_d.stop_sequence > rs_o.stop_sequence
      JOIN routes r ON rs_o.route_id = r.route_id
      WHERE rs_o.stop_id IN (${oPlaceholders})
        AND rs_d.stop_id IN (${dPlaceholders})
    `;

    const result = db.prepare(sql).get(...originIds, ...destIds);
    return result?.count || 0;
  }

  // Find minimum radius with routes by incrementing 25% each step.
  // Fetches stops at MAX_RADIUS once and filters in memory each iteration
  // to avoid repeated bbox queries against SQLite.
  function findSuggestionRadius(origin, destination, initialOriginRadius, initialDestRadius) {
    const MAX_RADIUS = 2000;
    const INCREMENT = 1.25; // 25% increase

    // Fetch all candidate stops once at the maximum possible radius and
    // pre-compute each stop's distance so the loop only does comparisons.
    const allOriginStops = findStopsNear(origin.lat, origin.lng, MAX_RADIUS)
      .map((s) => ({ ...s, dist: haversineMeters(origin.lat, origin.lng, s.stop_lat, s.stop_lon) }));
    const allDestStops = findStopsNear(destination.lat, destination.lng, MAX_RADIUS)
      .map((s) => ({ ...s, dist: haversineMeters(destination.lat, destination.lng, s.stop_lat, s.stop_lon) }));

    if (!allOriginStops.length || !allDestStops.length) return null;

    let testOriginR = Math.round(initialOriginRadius * INCREMENT);
    let testDestR = Math.round(initialDestRadius * INCREMENT);

    while (testOriginR <= MAX_RADIUS || testDestR <= MAX_RADIUS) {
      const oR = Math.min(testOriginR, MAX_RADIUS);
      const dR = Math.min(testDestR, MAX_RADIUS);

      // Filter in memory using pre-computed distances — no SQLite bbox query
      const oStops = allOriginStops.filter((s) => s.dist <= oR);
      const dStops = allDestStops.filter((s) => s.dist <= dR);

      if (oStops.length && dStops.length) {
        const count = countRoutesForStops(oStops, dStops);
        if (count > 0) return { count, originRadius: oR, destRadius: dR };
      }

      testOriginR = Math.round(testOriginR * INCREMENT);
      testDestR = Math.round(testDestR * INCREMENT);

      if (testOriginR > MAX_RADIUS && testDestR > MAX_RADIUS) break;
    }

    return null;
  }

  function findRoutes(origin, destination, originRadius, destRadius) {
    const originStops = findStopsNear(origin.lat, origin.lng, originRadius);
    const destStops = findStopsNear(
      destination.lat,
      destination.lng,
      destRadius,
    );

    if (!originStops.length || !destStops.length) {
      // Try to find a suggestion even when no stops in range
      const suggestion = findSuggestionRadius(origin, destination, originRadius, destRadius);
      return { routes: [], originStops, destStops, suggestion };
    }

    const originIds = originStops.map((s) => s.stop_id);
    const destIds = destStops.map((s) => s.stop_id);

    const oPlaceholders = originIds.map(() => "?").join(",");
    const dPlaceholders = destIds.map(() => "?").join(",");

    const sql = `
      SELECT
        r.route_short_name AS line,
        r.route_long_name,
        r.route_desc,
        rs_o.shape_id,
        rs_o.trip_id,
        rs_o.stop_id  AS board_stop_id,
        rs_d.stop_id  AS alight_stop_id
      FROM route_stops rs_o
      JOIN route_stops rs_d
        ON rs_o.route_id = rs_d.route_id
        AND rs_o.direction_id = rs_d.direction_id
        AND rs_d.stop_sequence > rs_o.stop_sequence
      JOIN routes r ON rs_o.route_id = r.route_id
      WHERE rs_o.stop_id IN (${oPlaceholders})
        AND rs_d.stop_id IN (${dPlaceholders})
      GROUP BY r.route_short_name
      LIMIT 300
    `;

    const rows = db.prepare(sql).all(...originIds, ...destIds);

    if (!rows.length) {
      // No routes at current radius - find suggestion with larger radius
      const suggestion = findSuggestionRadius(origin, destination, originRadius, destRadius);
      return { routes: [], originStops, destStops, suggestion };
    }

    const byLine = new Map();
    for (const row of rows) {
      if (!byLine.has(row.line)) {
        byLine.set(row.line, row);
      }
    }

    const originStopMap = new Map(originStops.map((s) => [s.stop_id, s]));
    const destStopMap = new Map(destStops.map((s) => [s.stop_id, s]));

    const routes = [];
    for (const [, row] of byLine) {
      const boardStop =
        originStopMap.get(row.board_stop_id) || stopById.get(row.board_stop_id);
      const alightStop =
        destStopMap.get(row.alight_stop_id) || stopById.get(row.alight_stop_id);

      if (!boardStop || !alightStop) continue;

      const shape = row.shape_id
        ? shapePoints
            .all(row.shape_id)
            .map((p) => [p.shape_pt_lat, p.shape_pt_lon])
        : [];

      const boardDist = Math.round(
        haversineMeters(
          origin.lat,
          origin.lng,
          boardStop.stop_lat,
          boardStop.stop_lon,
        ),
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
        boardStop: {
          id: boardStop.stop_id,
          name: boardStop.stop_name,
          lat: boardStop.stop_lat,
          lng: boardStop.stop_lon,
          walkMeters: boardDist,
        },
        alightStop: {
          id: alightStop.stop_id,
          name: alightStop.stop_name,
          lat: alightStop.stop_lat,
          lng: alightStop.stop_lon,
          walkMeters: alightDist,
        },
        shape,
      });
    }

    routes.sort(
      (a, b) =>
        a.boardStop.walkMeters +
        a.alightStop.walkMeters -
        (b.boardStop.walkMeters + b.alightStop.walkMeters),
    );

    // Routes found - no need for suggestion
    return { routes, originStops, destStops, suggestion: null };
  }

  function getStopsInBbox(south, west, north, east) {
    const stops = stopsInBbox.all(south, north, west, east);
    return stops.slice(0, 500);
  }

  return { findRoutes, getStopsInBbox };
}
