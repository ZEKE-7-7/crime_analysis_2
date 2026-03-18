// backend/server.js

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
}));
app.use(express.json());

// ── Load your dataset ────────────────────────────────
let crimeData = [];

try {
  const rawData = fs.readFileSync('./finalData.json');
  crimeData = JSON.parse(rawData);
  console.log(`Loaded ${crimeData.length} records ✅`);
} catch (err) {
  console.error("Error loading data ❌", err);
}

// ── Routes ───────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

/**
 * GET /api/crimes
 * Returns your dataset
 */
app.get('/api/crimes', (req, res) => {
  let data = crimeData;

  // Optional filter by status
  if (req.query.status) {
    data = data.filter(item => item.STATUS === req.query.status);
  }

  // Optional filter by crime type
  if (req.query.type) {
    data = data.filter(item => item.CRIME_TYPE === req.query.type);
  }

  res.json(data);
});

// ── Start server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚔 Crime API running at http://localhost:${PORT}`);
  console.log(`   GET http://localhost:${PORT}/api/crimes\n`);
});