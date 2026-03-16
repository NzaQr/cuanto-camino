import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GTFS_PATH = process.env.GTFS_PATH || '/Users/naza/Downloads/colectivos-gtfs';
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'gtfs.db');

function stripQuotes(s) {
  if (!s) return '';
  return s.replace(/^"|"$/g, '').trim();
}

async function parseCSV(filePath, onRow) {
  if (!existsSync(filePath)) {
    console.error(`  File not found: ${filePath}`);
    return 0;
  }
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const values = line.split(',');
    if (!headers) {
      headers = values.map(stripQuotes);
      continue;
    }
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = stripQuotes(values[i] || '');
    }
    onRow(row);
    count++;
    if (count % 500_000 === 0) {
      process.stdout.write(`\r  ${count.toLocaleString()} rows...`);
    }
  }
  return count;
}

async function importStops(db) {
  console.log('\nImporting stops...');
  const insert = db.prepare(
    'INSERT OR REPLACE INTO stops (stop_id, stop_name, stop_lat, stop_lon) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.stop_id, r.stop_name, Number(r.stop_lat), Number(r.stop_lon));
  });

  const batch = [];
  const count = await parseCSV(join(GTFS_PATH, 'stops.txt'), (row) => {
    batch.push(row);
    if (batch.length >= 5_000) {
      insertMany(batch.splice(0));
    }
  });
  if (batch.length) insertMany(batch);
  console.log(`\n  Done: ${count.toLocaleString()} stops`);
}

async function importRoutes(db) {
  console.log('\nImporting routes...');
  const insert = db.prepare(
    'INSERT OR REPLACE INTO routes (route_id, route_short_name, route_long_name, route_desc) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.route_id, r.route_short_name, r.route_long_name, r.route_desc);
  });

  const batch = [];
  const count = await parseCSV(join(GTFS_PATH, 'routes.txt'), (row) => {
    batch.push(row);
    if (batch.length >= 1_000) insertMany(batch.splice(0));
  });
  if (batch.length) insertMany(batch);
  console.log(`\n  Done: ${count.toLocaleString()} routes`);
}

async function importTrips(db) {
  console.log('\nImporting trips...');
  const insert = db.prepare(
    'INSERT OR REPLACE INTO trips (trip_id, route_id, shape_id, direction_id) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows)
      insert.run(r.trip_id, r.route_id, r.shape_id || null, Number(r.direction_id) || 0);
  });

  const batch = [];
  const count = await parseCSV(join(GTFS_PATH, 'trips.txt'), (row) => {
    batch.push(row);
    if (batch.length >= 10_000) insertMany(batch.splice(0));
  });
  if (batch.length) insertMany(batch);
  console.log(`\n  Done: ${count.toLocaleString()} trips`);
}

async function importStopTimes(db) {
  console.log('\nImporting stop_times (this will take several minutes)...');
  const insert = db.prepare(
    'INSERT INTO stop_times (trip_id, stop_id, stop_sequence) VALUES (?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.trip_id, r.stop_id, Number(r.stop_sequence));
  });

  const batch = [];
  const count = await parseCSV(join(GTFS_PATH, 'stop_times.txt'), (row) => {
    batch.push(row);
    if (batch.length >= 50_000) insertMany(batch.splice(0));
  });
  if (batch.length) insertMany(batch);
  console.log(`\n  Done: ${count.toLocaleString()} stop_times`);
}

async function importShapes(db) {
  console.log('\nImporting shapes...');
  const insert = db.prepare(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows)
      insert.run(r.shape_id, Number(r.shape_pt_lat), Number(r.shape_pt_lon), Number(r.shape_pt_sequence));
  });

  const batch = [];
  const count = await parseCSV(join(GTFS_PATH, 'shapes.txt'), (row) => {
    batch.push(row);
    if (batch.length >= 50_000) insertMany(batch.splice(0));
  });
  if (batch.length) insertMany(batch);
  console.log(`\n  Done: ${count.toLocaleString()} shape points`);
}

function buildIndexes(db) {
  console.log('\nBuilding indexes (may take a few minutes)...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(stop_id)',
    'CREATE INDEX IF NOT EXISTS idx_stop_times_trip_seq ON stop_times(trip_id, stop_sequence)',
    'CREATE INDEX IF NOT EXISTS idx_stops_coords ON stops(stop_lat, stop_lon)',
    'CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id)',
    'CREATE INDEX IF NOT EXISTS idx_shapes_id ON shapes(shape_id, shape_pt_sequence)',
  ];
  for (const sql of indexes) {
    const name = sql.match(/idx_\w+/)[0];
    process.stdout.write(`  ${name}...`);
    db.exec(sql);
    console.log(' done');
  }
}

async function main() {
  console.log('=== GTFS Import ===');
  console.log(`Source: ${GTFS_PATH}`);
  console.log(`DB:     ${DB_PATH}\n`);

  const db = createDb(DB_PATH);

  // Clear existing data for a fresh import
  db.exec('DELETE FROM stop_times');
  db.exec('DELETE FROM shapes');
  db.exec('DELETE FROM trips');
  db.exec('DELETE FROM routes');
  db.exec('DELETE FROM stops');

  const start = Date.now();

  await importStops(db);
  await importRoutes(db);
  await importTrips(db);
  await importStopTimes(db);
  await importShapes(db);
  buildIndexes(db);

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n✓ Import complete in ${elapsed} minutes`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
