import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createDb } from './db.js';
import { createRouting, FALLBACK_WALK_SPEED_MPS, WALK_LIMITS, WALK_UNITS } from './routing.js';
import { createWalkService } from './walk/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'gtfs.db');

const db = createDb(DB_PATH);
const walk = createWalkService();
const routing = createRouting(db, walk);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, walkProvider: walk.providerName });
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
app.post('/api/routes', async (req, res) => {
  const {
    origin, destination,
    unit: rawUnit, originBudget, destBudget,
    originMinutes, destMinutes, // previous shape
    originRadius, destRadius,   // legacy shape, straight-line meters
  } = req.body;

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return res.status(400).json({ error: 'origin and destination with lat/lng required' });
  }

  // Walk budget: { unit, origin, dest }. Older clients sent minutes, or meters
  // as a straight-line radius; both map onto the minutes unit.
  const metersToMinutes = (m) => (Number.isFinite(Number(m)) ? Number(m) / (60 * FALLBACK_WALK_SPEED_MPS) : NaN);
  const unit = WALK_UNITS.includes(rawUnit) ? rawUnit : 'minutes';
  const limits = WALK_LIMITS[unit];
  const clamp = (v) => {
    const n = Number(v);
    const snapped = Number.isFinite(n) && n > 0 ? Math.round(n / limits.step) * limits.step : limits.default;
    return Math.min(Math.max(snapped, limits.min), limits.max);
  };
  const budget = {
    unit,
    origin: clamp(originBudget ?? originMinutes ?? metersToMinutes(originRadius)),
    dest: clamp(destBudget ?? destMinutes ?? metersToMinutes(destRadius)),
  };

  try {
    const result = await routing.findRoutes(origin, destination, budget);
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
  console.log(`Walk provider: ${walk.providerName}`);
});
