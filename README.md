# CrimeOps — Intelligence Dashboard v3

A real-time GIS crime analysis dashboard powered by React, Vite, Zustand, React Query, and Leaflet. Data is fetched from a backend API — no CSV upload required.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Vite)                   │
│                                                      │
│  App.tsx                                             │
│    └─ useCrimesData (React Query)                    │
│         └─ fetchCrimes → GET /api/crimes             │
│              └─ transformApiRows → CrimeIncident[]   │
│                   └─ Zustand store.loadFromApi()     │
│                        └─ runFullAnalysis()          │
│                             ├─ computeStats          │
│                             ├─ detectHotspots (DBSCAN│
│                             ├─ generateTimePrediction│
│                             ├─ generateInsights      │
│                             └─ detectCorrelations    │
│                                                      │
│  Components read from Zustand:                       │
│    DashboardView · MapView · StatsView · InsightsView│
└─────────────────────────────────────────────────────┘
                        │  HTTP JSON
┌─────────────────────────────────────────────────────┐
│              Backend (Express / any server)          │
│  GET /api/crimes → JSON array                        │
│  { LATITUDE, LONGITUDE, CRIME_TYPE, DATE_TIME,       │
│    STATUS, DESCRIPTION?, LOCATION? }                 │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start the backend

```bash
cd backend
npm install
npm start
# → http://localhost:5000/api/crimes
```

### 2. Start the frontend

```bash
npm install
npm run dev
# → http://localhost:5173
```

### 3. Configure the API endpoint (optional)

Copy `.env.example` to `.env.local` and update the URL:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## API Contract

Your backend must expose:

### `GET /api/crimes`

Returns a JSON array. Every object must have:

| Field | Type | Required | Notes |
|---|---|---|---|
| `LATITUDE` | string \| number | ✅ | −90 to 90 |
| `LONGITUDE` | string \| number | ✅ | −180 to 180 |
| `CRIME_TYPE` | string | ✅ | See valid values below |
| `DATE_TIME` | string | ✅ | ISO 8601 or parseable |
| `STATUS` | string | ✅ | See valid values below |
| `DESCRIPTION` | string | ☐ | Free text |
| `LOCATION` | string | ☐ | Neighbourhood/area name |

**Valid `CRIME_TYPE` values:** `Theft` · `Assault` · `Robbery` · `Burglary` · `Vandalism` · `Drug Offense` · `Fraud` · `Other`

**Valid `STATUS` values:** `Open` · `Closed` · `Under Investigation`

#### Optional: time-range filter

```
GET /api/crimes?range=24h   # last 24 hours
GET /api/crimes?range=7d    # last 7 days
GET /api/crimes?range=30d   # last 30 days
GET /api/crimes             # all data (default)
```

---

## Data Flow Detail

```
API fetch (every 5 min via React Query)
  │
  ▼
src/services/api.ts
  fetchCrimes() ──► transformApiRows()
                         │
                         ▼
                    CrimeIncident[]  (validated, typed)
                         │
                         ▼
src/hooks/useCrimesData.ts
  useEffect ──► store.loadFromApi(incidents, timeRange)
                         │
                         ▼
src/store/appStore.ts
  loadFromApi()
    1. applyTimeRange()       → displayIncidents[]
    2. runFullAnalysis()      → stats, hotspots, predictions,
                                patrolRecommendations, insights
    3. set({ ...all })        → Zustand state updated
                         │
                         ▼
All components read from Zustand (no prop drilling)
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/services/api.ts` | API base URL, `fetchCrimes()`, `transformApiRows()` |
| `src/hooks/useCrimesData.ts` | React Query hook, seeds Zustand after fetch |
| `src/store/appStore.ts` | Global state: incidents, analysis results, actions |
| `src/types/index.ts` | All TypeScript interfaces |
| `src/utils/dataUtils.ts` | DBSCAN, stats, predictions, insights (pure functions) |
| `backend/server.js` | Example Express server with mock data |

---

## Features

- **Auto-fetch** on app load — no manual upload step
- **Background refresh** every 5 minutes via React Query
- **Manual refresh** button in sidebar and dashboard
- **Time-range filter** (24h / 7d / 30d / all) re-runs full analysis
- **DBSCAN hotspot detection** with risk scoring
- **AI patrol recommendations** with one-click deployment
- **5 map modes**: Heatmap · Incidents · Hotspots · Prediction · Patrol
- **Time scrubber** for animated 24h heatmap playback
- **Incident table** with sort, search, filter, multi-select export
- **Full-screen loading/error** states with retry button

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Backend API base URL |
