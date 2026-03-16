import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createDb } from './db.js';
import { createRouting } from './routing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'gtfs.db');

const db = createDb(DB_PATH);
const routing = createRouting(db);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// GET /api/stops?south=&west=&north=&east=
app.get('/api/stops', (req, res) => {
  const { south, west, north, east } = req.query;
  if (!south || !west || !north || !east) {
    return res.status(400).json({ error: 'Missing bounding box: south, west, north, east required' });
  }
  const stops = routing.getStopsInBbox(
    Number(south),
    Number(west),
    Number(north),
    Number(east)
  );
  res.json({ data: stops });
});

// POST /api/routes
app.post('/api/routes', (req, res) => {
  const { origin, destination, originRadius, destRadius, walkRadius } = req.body;

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return res.status(400).json({ error: 'origin and destination with lat/lng required' });
  }

  const clamp = (v, def) => Math.min(Math.max(Number(v) || def, 50), 3000);
  const originR = clamp(originRadius ?? walkRadius, 500);
  const destR = clamp(destRadius ?? walkRadius, 500);

  try {
    const result = routing.findRoutes(origin, destination, originR, destR);
    res.json({ data: result });
  } catch (err) {
    console.error('Route search error:', err);
    res.status(500).json({ error: 'Failed to find routes' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
