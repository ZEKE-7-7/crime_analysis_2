// src/services/api.ts
// Central API service — all backend communication lives here.
// Swap BASE_URL or add auth headers once without touching components.

import { CrimeType, CrimeStatus, CrimeIncident } from '@/types';

// ── Configuration ──────────────────────────────────────────────────────────
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api';

// Stale-while-revalidate: 60 s before background refetch, 5 min before hard expiry
export const QUERY_CONFIG = {
  staleTime:  60_000,
  gcTime:     5 * 60_000,
  retry:      2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
} as const;

// ── Wire format from the backend ──────────────────────────────────────────
export interface CrimeApiRow {
  LATITUDE:    string | number;
  LONGITUDE:   string | number;
  CRIME_TYPE:  string;
  DATE_TIME:   string;
  STATUS:      string;
  DESCRIPTION?: string;
  LOCATION?:   string;
}

// Severity weights — kept here so the transformer is self-contained
const SEVERITY_MAP: Record<string, number> = {
  Assault:         9,
  Robbery:         8,
  Burglary:        7,
  'Drug Offense':  6,
  Theft:           5,
  Fraud:           5,
  Vandalism:       3,
  Other:           2,
};

const VALID_TYPES = new Set([
  'Theft', 'Assault', 'Robbery', 'Burglary',
  'Vandalism', 'Drug Offense', 'Fraud', 'Other',
]);

const VALID_STATUSES = new Set(['Open', 'Closed', 'Under Investigation']);

// ── Transform raw API rows → typed CrimeIncident objects ──────────────────
export function transformApiRows(rows: CrimeApiRow[]): CrimeIncident[] {
  const incidents: CrimeIncident[] = [];

  rows.forEach((row, i) => {
    const lat = Number(row.LATITUDE);
    const lng = Number(row.LONGITUDE);

    // Skip rows with invalid coordinates
    if (!Number.isFinite(lat) || lat < -90  || lat > 90)  return;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return;

    const dt = new Date(row.DATE_TIME);
    if (isNaN(dt.getTime())) return;

    const type = VALID_TYPES.has(row.CRIME_TYPE)
      ? (row.CRIME_TYPE as CrimeType)
      : 'Other';

    const status = VALID_STATUSES.has(row.STATUS)
      ? (row.STATUS as CrimeStatus)
      : 'Open';

    incidents.push({
      id:          `INC-${String(i + 1).padStart(5, '0')}`,
      type,
      lat,
      lng,
      dateTime:    dt,
      status,
      description: row.DESCRIPTION ?? 'No description',
      location:    row.LOCATION    ?? 'Unknown',
      severity:    SEVERITY_MAP[type] ?? 5,
    });
  });

  return incidents;
}

// ── API functions ──────────────────────────────────────────────────────────

/**
 * Fetch all crime incidents from the backend.
 * Returns typed, validated CrimeIncident[].
 * Throws on non-2xx responses so React Query can surface the error.
 */
export async function fetchCrimes(signal?: AbortSignal): Promise<CrimeIncident[]> {
  const url = `${API_BASE_URL}/crimes`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  const json: CrimeApiRow[] = await res.json();

  if (!Array.isArray(json)) {
    throw new Error('API response is not an array');
  }

  return transformApiRows(json);
}

/**
 * Fetch crimes filtered by time range from the backend.
 * Falls back to client-side filtering if the endpoint is not supported.
 */
export async function fetchCrimesByRange(
  range: '24h' | '7d' | '30d' | 'all',
  signal?: AbortSignal,
): Promise<CrimeIncident[]> {
  // Try the ranged endpoint first
  const url = `${API_BASE_URL}/crimes${range !== 'all' ? `?range=${range}` : ''}`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  const json: CrimeApiRow[] = await res.json();
  if (!Array.isArray(json)) throw new Error('API response is not an array');
  return transformApiRows(json);
}
