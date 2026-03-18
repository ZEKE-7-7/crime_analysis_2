// src/types/index.ts

export type CrimeType =
  | 'Theft'
  | 'Assault'
  | 'Robbery'
  | 'Burglary'
  | 'Vandalism'
  | 'Drug Offense'
  | 'Fraud'
  | 'Other';

export type CrimeStatus = 'Open' | 'Closed' | 'Under Investigation';

export interface CrimeIncident {
  id:          string;
  type:        CrimeType;
  lat:         number;
  lng:         number;
  dateTime:    Date;
  status:      CrimeStatus;
  description: string;
  location:    string;
  severity:    number; // 1–10
}

export type PatrolStatus = 'Active' | 'Responding' | 'Off Duty' | 'Standby';

export interface PatrolUnit {
  id:           string;
  name:         string;
  lat:          number;
  lng:          number;
  status:       PatrolStatus;
  assignedZone?: string;
  officerCount: number;
  lastUpdate:   Date;
  isAIDeployed?: boolean;
}

export interface HotspotCluster {
  id:                 string;
  centroidLat:        number;
  centroidLng:        number;
  radius:             number;
  incidentCount:      number;
  dominantType:       CrimeType;
  riskScore:          number;
  label:              string;
  incidents:          string[];
  recommendedPatrols: number;
}

export interface TimePrediction {
  hour:           number;
  predictedCount: number;
  lower:          number;
  upper:          number;
  confidence:     number;
  riskLevel:      'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PredictionZone {
  location:           string;
  lat:                number;
  lng:                number;
  nextPeakHour:       number;
  predictedIncidents: number;
  riskScore:          number;
}

export interface PatrolRecommendation {
  hotspotId:       string;
  location:        string;
  lat:             number;
  lng:             number;
  unitsRequired:   number;
  currentCoverage: number;
  urgency:         'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason:          string;
  timeWindow:      string;
  crimeTypes:      CrimeType[];
}

export interface CrimeStats {
  total:              number;
  open:               number;
  closed:             number;
  underInvestigation: number;
  byType:             Record<CrimeType, number>;
  byHour:             number[];
  byDay:              { date: string; count: number }[];
  topLocations:       { location: string; count: number }[];
  byDayOfWeek:        number[];
  averageSeverity:    number;
  violentCrimePct:    number;
  resolutionRate:     number;
}

export type InsightSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InsightType =
  | 'hotspot'
  | 'temporal'
  | 'alert'
  | 'resource'
  | 'prediction'
  | 'patrol';

export interface AIInsight {
  id:              string;
  type:            InsightType;
  severity:        InsightSeverity;
  title:           string;
  description:     string;
  recommendation:  string;
  affectedArea?:   string;
  metrics?:        Record<string, string | number>;
  relatedHotspot?: string;
}

// 'upload' view removed — replaced with 'dashboard' as the default landing
export type AppView = 'dashboard' | 'map' | 'stats' | 'insights' | 'settings';
export type MapMode = 'incidents' | 'heatmap' | 'hotspots' | 'prediction' | 'patrol';

/** Where the incident data originates */
export type DataSource = 'none' | 'api' | 'refreshing';

export interface AppState {
  // ── Navigation ──────────────────────────────────────────────────────────
  view:    AppView;
  mapMode: MapMode;

  // ── Data ────────────────────────────────────────────────────────────────
  incidents:        CrimeIncident[];
  /** Time-range-filtered slice — what the map and charts render */
  displayIncidents: CrimeIncident[];
  patrolUnits:      PatrolUnit[];
  dataSource:       DataSource;

  // ── Analysis outputs ─────────────────────────────────────────────────────
  hotspots:               HotspotCluster[];
  predictions:            TimePrediction[];
  predictionZones:        PredictionZone[];
  patrolRecommendations:  PatrolRecommendation[];
  stats:                  CrimeStats | null;
  insights:               AIInsight[];

  // ── UI state ──────────────────────────────────────────────────────────────
  isAnalysing:       boolean;   // analysis pipeline running
  selectedTimeRange: '24h' | '7d' | '30d' | 'all';
  activeHotspot:     string | null;

  // ── Actions ────────────────────────────────────────────────────────────
  setView:          (view: AppView)    => void;
  setMapMode:       (mode: MapMode)    => void;
  setActiveHotspot: (id: string | null) => void;
  setTimeRange:     (range: '24h' | '7d' | '30d' | 'all') => void;

  /** Called by useCrimesData after a successful API fetch */
  loadFromApi:      (incidents: CrimeIncident[], range?: '24h' | '7d' | '30d' | 'all') => void;

  /** Re-run analysis on the current displayIncidents without re-fetching */
  runAnalysis:      () => void;

  /** AI patrol deployment */
  deployPatrolUnit: (hotspotId: string) => void;
}
