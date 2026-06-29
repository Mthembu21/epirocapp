/**
 * Clamps a KPI percent value to [0, 100] for safe UI rendering.
 * Returns 0 (not null) so callers that expect a number never crash.
 * For null-safety before rendering, use normalizeKpis() instead.
 */
export const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(num, 100);
};

/**
 * Observable guard: logs a structured warning and returns false when a
 * required value is missing, making silent bail-outs visible.
 *
 * Usage:
 *   if (!guardRequires(supervisorKey, 'supervisorKey', '[KPI Fetcher]')) return;
 *
 * @param {*}      value    The value to check
 * @param {string} label    Human-readable name for log output
 * @param {string} context  Log prefix, e.g. '[KPI Fetcher]'
 * @returns {boolean}
 */
export function guardRequires(value, label, context = '[KPI]') {
  if (value === null || value === undefined || value === '') {
    console.warn(`${context} ${label} is missing — operation skipped`, { value });
    return false;
  }
  return true;
}

/**
 * Runtime KPI field checker: warns for every required field that is absent
 * from the supplied kpis object.  Call this after receiving a response to
 * surface contract violations early.
 *
 * @param {object} kpis     The kpis sub-object from the API response
 * @param {string} context  Log prefix
 */
export function checkKpiFields(kpis, context = '[KPI]') {
  const required = [
    'utilization_percent',
    'productivity_percent',
    'availability_percent',
    'idle_percent',
    'non_productive_percent',
    'training_percent',
  ];
  required.forEach(field => {
    if (!(field in (kpis || {}))) {
      console.warn(`${context} Missing field: ${field}`, { kpis });
    }
  });
}
