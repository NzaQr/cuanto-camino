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

  function findRoutes(origin, destination, originRadius, destRadius) {
    const originStops = findStopsNear(origin.lat, origin.lng, originRadius);
    const destStops = findStopsNear(
      destination.lat,
      destination.lng,
      destRadius,
    );

    if (!originStops.length || !destStops.length) {
      return { routes: [], originStops, destStops };
    }

    const originIds = originStops.map((s) => s.stop_id);
    const destIds = destStops.map((s) => s.stop_id);

    // Build parameterized placeholders
    const oPlaceholders = originIds.map(() => "?").join(",");
    const dPlaceholders = destIds.map(() => "?").join(",");

    const sql = `
      SELECT
        r.route_id,
        r.route_short_name AS line,
        r.route_long_name,
        r.route_desc,
        t.shape_id,
        t.trip_id,
        st_o.stop_id AS board_stop_id,
        st_d.stop_id AS alight_stop_id
      FROM stop_times st_o
      JOIN stop_times st_d
        ON st_o.trip_id = st_d.trip_id
        AND st_d.stop_sequence > st_o.stop_sequence
      JOIN trips t ON st_o.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      WHERE st_o.stop_id IN (${oPlaceholders})
        AND st_d.stop_id IN (${dPlaceholders})
      GROUP BY r.route_short_name
      LIMIT 300
    `;

    const rows = db.prepare(sql).all(...originIds, ...destIds);

    if (!rows.length) {
      return { routes: [], originStops, destStops };
    }

    // Group by bus line (route_short_name), keep one representative per line
    const byLine = new Map();
    for (const row of rows) {
      if (!byLine.has(row.line)) {
        byLine.set(row.line, row);
      }
    }

    // Build stop lookup maps
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

    // Sort by total walk distance
    routes.sort(
      (a, b) =>
        a.boardStop.walkMeters +
        a.alightStop.walkMeters -
        (b.boardStop.walkMeters + b.alightStop.walkMeters),
    );

    return { routes, originStops, destStops };
  }

  function getStopsInBbox(south, west, north, east) {
    const stops = stopsInBbox.all(south, north, west, east);
    return stops.slice(0, 500);
  }

  return { findRoutes, getStopsInBbox };
}
