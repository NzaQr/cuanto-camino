import Database from 'better-sqlite3';

export function createDb(path) {
  const db = new Database(path);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB page cache
  db.pragma('temp_store = MEMORY');

  db.exec(`
    CREATE TABLE IF NOT EXISTS stops (
      stop_id   TEXT PRIMARY KEY,
      stop_name TEXT,
      stop_lat  REAL NOT NULL,
      stop_lon  REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routes (
      route_id         TEXT PRIMARY KEY,
      route_short_name TEXT,
      route_long_name  TEXT,
      route_desc       TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      trip_id      TEXT PRIMARY KEY,
      route_id     TEXT NOT NULL,
      shape_id     TEXT,
      direction_id INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      route_id      TEXT    NOT NULL,
      direction_id  INTEGER NOT NULL,
      stop_id       TEXT    NOT NULL,
      stop_sequence INTEGER NOT NULL,
      trip_id       TEXT    NOT NULL,
      shape_id      TEXT
    );

    CREATE TABLE IF NOT EXISTS shapes (
      shape_id          TEXT NOT NULL,
      shape_pt_lat      REAL NOT NULL,
      shape_pt_lon      REAL NOT NULL,
      shape_pt_sequence INTEGER NOT NULL
    );
  `);

  return db;
}
