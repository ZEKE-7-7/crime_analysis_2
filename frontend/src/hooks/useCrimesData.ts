// src/hooks/useCrimesData.ts
// React Query hook — single entry point for all crime data in the app.
// Automatically feeds Zustand after a successful fetch so every component
// that needs the analysed state (hotspots, insights, patrols…) still works.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchCrimes, QUERY_CONFIG } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { CrimeIncident } from '@/types';

// ── Query key factory — keeps keys consistent across the app ──────────────
export const crimeQueryKeys = {
  all:   ['crimes'] as const,
  range: (r: string) => ['crimes', r] as const,
};

// ── Primary hook ──────────────────────────────────────────────────────────
/**
 * Fetches all crime incidents from the backend and automatically
 * seeds the Zustand store for analysis. Components can read from
 * the store (hotspots, stats, insights…) or directly from this hook.
 *
 * @example
 * const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useCrimesData()
 */
export function useCrimesData() {
  const queryClient  = useQueryClient();
  const { loadFromApi, selectedTimeRange } = useAppStore();

  // Track whether we have already seeded the store for this fetch result
  const seededRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey:    crimeQueryKeys.all,
    queryFn:     ({ signal }) => fetchCrimes(signal),
    staleTime:   QUERY_CONFIG.staleTime,
    gcTime:      QUERY_CONFIG.gcTime,
    retry:       QUERY_CONFIG.retry,
    retryDelay:  QUERY_CONFIG.retryDelay,
    // Keep previous data visible while a background refetch runs
    placeholderData: (prev) => prev,
  });

  // Seed the Zustand store whenever new data arrives
  useEffect(() => {
    if (!query.data || query.isLoading) return;

    // Use the dataUpdatedAt timestamp as a stable fingerprint
    const fingerprint = String(query.dataUpdatedAt);
    if (seededRef.current === fingerprint) return;
    seededRef.current = fingerprint;

    loadFromApi(query.data, selectedTimeRange);
  }, [query.data, query.isLoading, query.dataUpdatedAt, selectedTimeRange, loadFromApi]);

  return {
    /** Raw typed incidents from the API */
    data:           query.data,
    isLoading:      query.isLoading,
    /** True during a background refetch (data is stale but present) */
    isFetching:     query.isFetching,
    isError:        query.isError,
    error:          query.error,
    /** Timestamp of last successful fetch */
    dataUpdatedAt:  query.dataUpdatedAt,
    /** Manually trigger a refetch */
    refetch:        query.refetch,
    /** Invalidate & refetch (use in settings "refresh" button) */
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: crimeQueryKeys.all }),
  };
}

// ── Utility: prefetch crimes (call in route loaders or app bootstrap) ─────
export function prefetchCrimes(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.prefetchQuery({
    queryKey:  crimeQueryKeys.all,
    queryFn:   () => fetchCrimes(),
    staleTime: QUERY_CONFIG.staleTime,
  });
}
