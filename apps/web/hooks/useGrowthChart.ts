'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientsApi } from '@/lib/queries';
import type { GrowthChartData } from '@/components/growth/GrowthChart';

interface UseGrowthChartResult {
  data: GrowthChartData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch a patient's growth chart data.
 *
 * Uses the existing `patientsApi.growthChart()` from lib/queries.ts rather than
 * a bare fetch(), so it inherits the shared api-client behaviour: base URL,
 * error shape (ApiError), and — after the SEC-001 fix — the HttpOnly cookie
 * credentials and 401-redirect handling.
 */
export function useGrowthChart(patientId: string): UseGrowthChartResult {
  const [data, setData]         = useState<GrowthChartData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tick, setTick]         = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    patientsApi
      .growthChart(patientId)
      .then(res => {
        if (!cancelled) setData(res as GrowthChartData);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? 'Failed to load growth data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patientId, tick]);

  return { data, isLoading, error, refetch };
}
