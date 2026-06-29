// Single source of truth for KPI response parsing and field normalization.
// All frontend consumers MUST use normalizeKpis() instead of hand-rolling their
// own unwrapping logic.  This guarantees a consistent object shape and makes
// backend contract changes detectable in one place.

export const REQUIRED_KPI_FIELDS = [
  'utilization_percent',
  'productivity_percent',
  'availability_percent',
  'idle_percent',
  'non_productive_percent',
  'training_percent',
];

/**
 * Validates that `data` (i.e. response.data from the API) contains a `kpis`
 * object with all required fields.  Logs structured errors/warnings but does
 * NOT throw — callers must decide how to handle validation failures.
 *
 * @returns {boolean} true when the shape is fully valid
 */
export function assertKpiShape(data) {
  if (!data) {
    console.error('[KPI] assertKpiShape: data is null/undefined', { data });
    return false;
  }
  if (!data.kpis || typeof data.kpis !== 'object') {
    console.error('[KPI] assertKpiShape: data.kpis is missing or not an object', { data });
    return false;
  }
  const missing = REQUIRED_KPI_FIELDS.filter(f => !(f in data.kpis));
  if (missing.length > 0) {
    missing.forEach(f => console.warn(`[KPI] Missing field: ${f}`));
    return false;
  }
  return true;
}

/**
 * Converts a raw API response from /kpi/:key/dashboard/overview into a flat,
 * null-safe object suitable for KPI card components.
 *
 * Contract:
 *   input  → { success, data: { hasData, kpis: { utilization_percent, … } } }
 *   output → { hasData, utilization_percent, productivity_percent, … }
 *
 * Rules:
 *   - A missing field becomes null (not 0) so the UI can distinguish
 *     "no data" from a genuine 0%.
 *   - hasData falls back to a heuristic (any non-zero KPI) when the backend
 *     does not supply the flag (backwards compatibility with older deployments).
 *   - Any extra top-level fields in the inner response are preserved via spread.
 *
 * @param {object} apiResponse  Raw return value from base44.entities.KPI.dashboardOverview()
 * @returns {object}
 */
export function normalizeKpis(apiResponse) {
  console.log('[KPI TRACE] normalizeKpis — raw apiResponse:', apiResponse);

  // Navigate nested shapes:  { data: { kpis } }  or  { data: { data: { kpis } } }
  const outer = apiResponse?.data || apiResponse || {};
  const inner = outer?.data || outer;
  const kpis  = inner?.kpis || {};

  // Prefer explicit hasData from backend; fall back to heuristic for old backends.
  const hasData =
    inner?.hasData  ??
    outer?.hasData  ??
    REQUIRED_KPI_FIELDS.some(f => (kpis[f] ?? 0) > 0);

  const valid = assertKpiShape(inner);

  const normalized = {
    // Preserve any non-KPI fields that may be at the inner level.
    ...inner,
    // Explicit null-safe mapping for every required KPI field.
    // null = field missing in response; 0 = backend calculated zero.
    utilization_percent:    kpis.utilization_percent    ?? null,
    productivity_percent:   kpis.productivity_percent   ?? null,
    availability_percent:   kpis.availability_percent   ?? null,
    idle_percent:           kpis.idle_percent           ?? null,
    non_productive_percent: kpis.non_productive_percent ?? null,
    training_percent:       kpis.training_percent       ?? null,
    efficiency_percent:     kpis.efficiency_percent     ?? null,
    hasData,
    _kpiShapeValid: valid,
  };

  console.log('[KPI TRACE] normalizeKpis — output:', { hasData, valid, normalized });
  return normalized;
}
