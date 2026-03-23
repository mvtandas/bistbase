"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Tiered portfolio data hooks.
 * Core loads fast (2-5s), analytics follows (5-15s), simulations on-demand.
 */

export const PORTFOLIO_QUERY_KEYS = {
  core: (timeframe: string) => ["portfolio-core", timeframe] as const,
  analytics: (timeframe: string) => ["portfolio-analytics", timeframe] as const,
  simulations: () => ["portfolio-simulations"] as const,
};

/**
 * Tier 1: Core portfolio data — verdict, holdings, metrics, allocation, sparklines.
 * This is the fastest tier and should be used for above-the-fold content.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePortfolioCore(timeframe = "daily") {
  return useQuery<any>({
    queryKey: PORTFOLIO_QUERY_KEYS.core(timeframe),
    queryFn: () => fetch(`/api/portfolio-intelligence/core?timeframe=${timeframe}`).then(r => {
      if (!r.ok) throw new Error("Core data failed");
      return r.json();
    }),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Tier 2: Analytics — equity curve, risk metrics, benchmark, attribution, drawdown.
 * Only fetches after core data is available.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePortfolioAnalytics(timeframe = "daily") {
  const core = usePortfolioCore(timeframe);
  return useQuery<any>({
    queryKey: PORTFOLIO_QUERY_KEYS.analytics(timeframe),
    queryFn: () => fetch(`/api/portfolio-intelligence/analytics?timeframe=${timeframe}`).then(r => {
      if (!r.ok) throw new Error("Analytics data failed");
      return r.json();
    }),
    staleTime: 15 * 60 * 1000,
    enabled: !!core.data && !core.data.error,
  });
}

/**
 * Tier 3: Simulations — Monte Carlo, stress test.
 * Only fetches when explicitly enabled (e.g., risk tab is active).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePortfolioSimulations(enabled: boolean, timeframe = "daily") {
  const core = usePortfolioCore(timeframe);
  return useQuery<any>({
    queryKey: PORTFOLIO_QUERY_KEYS.simulations(),
    queryFn: () => fetch(`/api/portfolio-intelligence/simulations?timeframe=${timeframe}`).then(r => {
      if (!r.ok) throw new Error("Simulations data failed");
      return r.json();
    }),
    staleTime: 30 * 60 * 1000,
    enabled: enabled && !!core.data && !core.data.error,
  });
}

/**
 * Combined hook that merges core + analytics for components that need both.
 * Core data renders immediately; analytics fields appear when ready.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePortfolioCombined(timeframe = "daily") {
  const core = usePortfolioCore(timeframe);
  const analytics = usePortfolioAnalytics(timeframe);

  // Merge analytics into core data when available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = core.data ? {
    ...core.data,
    ...(analytics.data ?? {}),
  } : undefined;

  return {
    data,
    isLoading: core.isLoading,
    isError: core.isError,
    error: core.error,
    // Additional status for progressive enhancement
    analyticsReady: !!analytics.data,
    analyticsLoading: analytics.isLoading,
  };
}
