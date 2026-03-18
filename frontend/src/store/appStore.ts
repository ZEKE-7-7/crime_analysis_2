// src/store/appStore.ts
// Zustand store — analysis state only. Data fetching lives in useCrimesData.

import { create } from 'zustand';
import { AppState, AppView, CrimeIncident, MapMode } from '@/types';
import {
  generatePatrolUnits,
  computeStats,
  detectHotspots,
  generateTimePredictions,
  generatePredictionZones,
  generatePatrolRecommendations,
  generateInsights,
  detectCrimeCorrelations,
} from '@/utils/dataUtils';
import { toast } from 'sonner';

// ── Severity sort order ────────────────────────────────────────────────────
const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ── Core analysis pipeline (pure function, no side-effects) ───────────────
function runFullAnalysis(
  incidents: CrimeIncident[],
  patrolUnits = generatePatrolUnits(),
) {
  const stats                 = computeStats(incidents);
  const hotspots              = detectHotspots(incidents);
  const predictions           = generateTimePredictions(stats);
  const predictionZones       = generatePredictionZones(incidents, hotspots);
  const patrolRecommendations = generatePatrolRecommendations(hotspots, patrolUnits, stats);
  const baseInsights          = generateInsights(incidents, stats, hotspots, predictions, patrolRecommendations);
  const correlations          = detectCrimeCorrelations(incidents, hotspots);
  const insights              = [...baseInsights, ...correlations].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  );

  return { stats, hotspots, predictions, predictionZones, patrolRecommendations, insights };
}

// ── Filter helper ──────────────────────────────────────────────────────────
function applyTimeRange(
  incidents: CrimeIncident[],
  range: '24h' | '7d' | '30d' | 'all',
): CrimeIncident[] {
  if (range === 'all') return incidents;
  const cutoffDays = range === '24h' ? 1 : range === '7d' ? 7 : 30;
  const now = Date.now();
  return incidents.filter(
    (i) => (now - i.dateTime.getTime()) / 86_400_000 <= cutoffDays,
  );
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>((set, get) => ({
  // ── Navigation defaults ─────────────────────────────────────────────────
  view:    'dashboard',
  mapMode: 'heatmap',

  // ── Data defaults ────────────────────────────────────────────────────────
  incidents:        [],
  displayIncidents: [],
  patrolUnits:      generatePatrolUnits(),
  dataSource:       'none',

  // ── Analysis defaults ─────────────────────────────────────────────────
  hotspots:              [],
  predictions:           [],
  predictionZones:       [],
  patrolRecommendations: [],
  stats:                 null,
  insights:              [],

  // ── UI defaults ────────────────────────────────────────────────────────
  isAnalysing:       false,
  selectedTimeRange: '30d',
  activeHotspot:     null,

  // ── Simple setters ────────────────────────────────────────────────────
  setView:          (view: AppView)    => set({ view }),
  setMapMode:       (mapMode: MapMode) => set({ mapMode }),
  setActiveHotspot: (id)               => set({ activeHotspot: id }),

  // ── Time-range filter ─────────────────────────────────────────────────
  // Re-slices displayIncidents and re-runs analysis without re-fetching.
  setTimeRange: (range) => {
    const { incidents, patrolUnits } = get();
    set({ selectedTimeRange: range, isAnalysing: true });

    const displayIncidents = applyTimeRange(incidents, range);

    // Off main thread via setTimeout so the spinner renders first
    setTimeout(() => {
      const result = runFullAnalysis(displayIncidents, patrolUnits);
      set({ ...result, displayIncidents, isAnalysing: false });
    }, 0);
  },

  // ── Called by useCrimesData after a successful API fetch ───────────────
  loadFromApi: (incidents, range = '30d') => {
    const { patrolUnits } = get();
    set({ dataSource: 'refreshing', isAnalysing: true });

    const displayIncidents = applyTimeRange(incidents, range ?? get().selectedTimeRange);

    // Run analysis in a microtask to keep the UI responsive
    setTimeout(() => {
      const result = runFullAnalysis(displayIncidents, patrolUnits);
      set({
        incidents,
        displayIncidents,
        dataSource:       'api',
        isAnalysing:      false,
        selectedTimeRange: range ?? get().selectedTimeRange,
        ...result,
      });
      toast.success(
        `Loaded ${incidents.length} incidents · ${result.hotspots.length} hotspots detected`,
        { id: 'api-load' }, // deduplicate toasts on refetch
      );
    }, 0);
  },

  // ── Re-run analysis on current displayIncidents without re-fetching ────
  runAnalysis: () => {
    const { displayIncidents, patrolUnits } = get();
    if (displayIncidents.length === 0) {
      toast.error('No incident data available');
      return;
    }
    set({ isAnalysing: true });

    setTimeout(() => {
      const result = runFullAnalysis(displayIncidents, patrolUnits);
      set({ ...result, isAnalysing: false });
      toast.success(
        `Analysis complete · ${result.hotspots.length} hotspots · ${result.insights.length} insights`,
      );
    }, 0);
  },

  // ── AI patrol deployment ──────────────────────────────────────────────
  deployPatrolUnit: (hotspotId) => {
    const { hotspots, patrolUnits, incidents } = get();
    const hs = hotspots.find((h) => h.id === hotspotId);
    if (!hs) return;

    const available = patrolUnits.find(
      (p) => p.status === 'Standby' || p.status === 'Off Duty',
    );
    if (!available) {
      toast.error('No available units to deploy');
      return;
    }

    const updated = patrolUnits.map((p) =>
      p.id === available.id
        ? {
            ...p,
            lat:          hs.centroidLat + (Math.random() - 0.5) * 0.004,
            lng:          hs.centroidLng + (Math.random() - 0.5) * 0.005,
            status:       'Active' as const,
            assignedZone: hs.label,
            isAIDeployed: true,
            lastUpdate:   new Date(),
          }
        : p,
    );

    const patrolRecommendations = generatePatrolRecommendations(
      hotspots,
      updated,
      computeStats(incidents),
    );
    // Spread into new array so MapView's useEffect reference-checks fire
    set({ patrolUnits: [...updated], patrolRecommendations });
    toast.success(`${available.name} deployed to ${hs.label} by AI`);
  },
}));
