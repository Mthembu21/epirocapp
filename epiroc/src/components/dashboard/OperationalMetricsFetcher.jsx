import React, { useEffect, useRef } from 'react';
import { format, startOfMonth, endOfMonth, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { base44 } from '@/api/apiClient';
import { normalizeKpis } from '@/utils/normalizeKpis';
import { guardRequires } from '@/utils/kpiUtils';

/**
 * Render-null component that drives KPI state for the supervisor dashboard.
 *
 * Owns the entire fetch → validate → normalize pipeline so no other component
 * needs to understand the raw API response shape.
 *
 * Props:
 *   supervisorKey         — required; aborts with a visible warning when absent
 *   technicians           — list of technician objects; aborts when empty
 *   timeView              — 'daily' | 'weekly' | 'monthly'
 *   selectedMonth         — 'YYYY-MM' string used for monthly view
 *   weekStart / weekEnd   — Date-like values used for weekly view
 *   onOperationalMetricsUpdate(normalized)  — receives the normalized KPI object
 *   onMonthlySummariesUpdate(series[])      — receives time-series data if present
 */
export default function OperationalMetricsFetcher({
  technicians,
  selectedMonth,
  timeView = 'monthly',
  onOperationalMetricsUpdate,
  onMonthlySummariesUpdate,
  weekStart,
  weekEnd,
  supervisorKey,
  refreshKey = 0,
}) {
  // Ref guard: prevents concurrent fetches without triggering re-renders
  // (using useState here would cause an infinite loop — state change → re-render
  //  → effect re-runs → fetch starts again).
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      // ── Observable guards (fail loudly, not silently) ──────────────────────
      if (!guardRequires(supervisorKey, 'supervisorKey', '[KPI Fetcher]')) return;
      if (!technicians || technicians.length === 0) {
        console.warn('[KPI Fetcher] technicians list is empty — fetch skipped');
        return;
      }
      if (isFetchingRef.current) {
        console.warn('[KPI Fetcher] fetch already in flight — skipped');
        return;
      }

      isFetchingRef.current = true;

      // ── Build date range from current time view ─────────────────────────────
      const today = new Date();
      let filters = {};

      if (timeView === 'daily') {
        const todayStr = format(today, 'yyyy-MM-dd');
        filters = { start_date: todayStr, end_date: todayStr };

      } else if (timeView === 'weekly') {
        const ws = weekStart ? new Date(weekStart) : startOfWeek(today, { weekStartsOn: 1 });
        const we = weekEnd   ? new Date(weekEnd)   : endOfWeek(today,   { weekStartsOn: 1 });
        filters = {
          start_date: format(ws, 'yyyy-MM-dd'),
          end_date:   format(we, 'yyyy-MM-dd'),
        };

      } else {
        const base = selectedMonth ? parseISO(`${selectedMonth}-01`) : today;
        filters = {
          start_date: format(startOfMonth(base), 'yyyy-MM-dd'),
          end_date:   format(endOfMonth(base),   'yyyy-MM-dd'),
        };
      }

      console.log('[KPI Fetcher] Requesting', timeView, filters);

      try {
        // ── API call ─────────────────────────────────────────────────────────
        const apiResponse = await base44.entities.KPI.dashboardOverview(supervisorKey, filters);
        console.log('[KPI TRACE] OperationalMetricsFetcher — API response:', apiResponse);

        // ── Centralized normalization (single place for shape logic) ──────────
        const normalized = normalizeKpis(apiResponse);
        console.log('[KPI TRACE] OperationalMetricsFetcher — after normalize:', normalized);

        if (!normalized._kpiShapeValid) {
          console.error('[KPI Fetcher] Response shape invalid — UI will show N/A for missing fields');
        }

        if (normalized.hasData === false) {
          console.info('[KPI Fetcher] No data available for selected period:', filters);
        }

        // ── Push to state ──────────────────────────────────────────────────────
        if (onOperationalMetricsUpdate) {
          console.log('[KPI TRACE] OperationalMetricsFetcher — calling onOperationalMetricsUpdate');
          onOperationalMetricsUpdate(normalized);
        }

        if (onMonthlySummariesUpdate) {
          const outer = apiResponse?.data || apiResponse || {};
          const series =
            outer?.series ||
            outer?.monthlySummaries ||
            outer?.timeseries ||
            [];
          onMonthlySummariesUpdate(Array.isArray(series) ? series : []);
        }

      } catch (error) {
        console.error('[KPI Fetcher] Fetch failed:', error, { supervisorKey, timeView, filters });
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchMetrics();
    // Re-run when any data-driving param changes.
    // refreshKey is incremented by Dashboard mutations (approve/delete/update time entries)
    // to force an immediate re-fetch without waiting for the next natural dep change.
    // Callback props are excluded intentionally: inline lambdas in Dashboard
    // are recreated every render and would cause an infinite loop if included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisorKey, timeView, selectedMonth, weekStart, weekEnd, technicians, refreshKey]);

  return null;
}
