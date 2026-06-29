import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Briefcase, Clock, Award, Users, Target, AlertCircle, Info } from 'lucide-react';
import { KPICard, getStatusColor } from './KPICard';

// null-safe float parser: returns null when the value is null/undefined/NaN.
// Returns a number (possibly 0) when the backend sends a real value.
const safeFloat = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * ManagementKPIHeader — 10-card KPI grid for supervisor / planner / PM dashboards.
 *
 * Props:
 *   metricsData   Flat KPI object from normalizeKpis() (via OperationalMetricsFetcher)
 *   hasData       true = data present, false = no records for period, null = unknown
 *   isLoading     true while the fetch is in flight
 *   selectedDate  Human-readable period label ("Today", "This Week", "June 2026")
 */
export default function ManagementKPIHeader({
  metricsData = {},
  isLoading = false,
  hasData = null,
  selectedDate = null,
  currentUser = null,
  onJobsAtRiskClick = null,
  onCompletedJobsClick = null,
  onOvertimeHoursClick = null,
  onProductiveHoursClick = null,
  onUtilizationClick = null,
  onNonProductiveClick = null,
  onEfficiencyClick = null,
  onAvailabilityClick = null,
}) {
  const metrics = useMemo(() => ({
    productive:       safeFloat(metricsData?.productive_percent),
    nonProductive:    safeFloat(metricsData?.non_productive_percent),
    idle:             safeFloat(metricsData?.idle_percent),
    efficiency:       safeFloat(metricsData?.efficiency_percent),
    availability:     safeFloat(metricsData?.availability_percent),
    utilization:      safeFloat(metricsData?.utilization_percent),
    // Count metrics always come from other state (never null)
    activeJobs:       parseInt(metricsData?.active_jobs)    || 0,
    completedJobs:    parseInt(metricsData?.completed_jobs) || 0,
    jobsAtRisk:       parseInt(metricsData?.jobs_at_risk)   || 0,
    overtimeHours:    parseFloat(metricsData?.overtime_hours)  || 0,
    totalTechnicians: parseInt(metricsData?.total_technicians) || 0,
  }), [metricsData]);

  console.log('[KPI TRACE] ManagementKPIHeader — rendering with metrics:', metrics, { hasData, isLoading });

  const getStatusBadge = (value, isNegative = false) => {
    if (value === null) return null;
    if (isNegative) {
      if (value <= 20) return 'Excellent';
      if (value <= 35) return 'Good';
      return 'Needs Attention';
    }
    if (value >= 85) return 'Excellent';
    if (value >= 70) return 'Good';
    return 'Needs Attention';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
        {[...Array(10)].map((_, i) => (
          <Card key={i} className="bg-slate-100 h-24" />
        ))}
      </div>
    );
  }

  // "No data yet" banner — shown when the backend explicitly reports no records
  // for the selected period.  Cards still render (they show N/A) so the layout
  // is stable and users understand why values are absent.
  const noDataBanner = hasData === false && (
    <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>
        No activity data recorded yet
        {selectedDate ? ` for ${selectedDate}` : ' for this period'}.
        KPIs will appear once work is logged.
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {noDataBanner}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Dashboard Metrics</h2>
          {currentUser?.name && (
            <Badge variant="outline" className="text-xs">
              {currentUser.name}
            </Badge>
          )}
        </div>
        {selectedDate && (
          <span className="text-sm text-slate-600 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {selectedDate}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Productive %"
          value={metrics.productive}
          unit="%"
          icon={TrendingUp}
          color={getStatusColor(metrics.productive, 'percentage', false)}
          showProgress={true}
          statusText={getStatusBadge(metrics.productive, false)}
          onClick={onProductiveHoursClick}
        />

        <KPICard
          title="Non-Productive %"
          value={metrics.nonProductive}
          unit="%"
          icon={Clock}
          color={getStatusColor(metrics.nonProductive, 'percentage', true)}
          showProgress={true}
          isNegative={true}
          statusText={getStatusBadge(metrics.nonProductive, true)}
          onClick={onNonProductiveClick}
        />

        <KPICard
          title="Efficiency %"
          value={metrics.efficiency}
          unit="%"
          icon={Award}
          color={getStatusColor(metrics.efficiency, 'percentage', false)}
          showProgress={true}
          statusText={getStatusBadge(metrics.efficiency, false)}
          onClick={onEfficiencyClick}
        />

        <KPICard
          title="Availability %"
          value={metrics.availability}
          unit="%"
          icon={Users}
          color={getStatusColor(metrics.availability, 'percentage', false)}
          showProgress={true}
          statusText={getStatusBadge(metrics.availability, false)}
          onClick={onAvailabilityClick}
        />

        <KPICard
          title="Utilization %"
          value={metrics.utilization}
          unit="%"
          icon={Briefcase}
          color={getStatusColor(metrics.utilization, 'percentage', false)}
          showProgress={true}
          statusText={getStatusBadge(metrics.utilization, false)}
          onClick={onUtilizationClick}
        />

        <KPICard
          title="Active Jobs"
          value={metrics.activeJobs}
          unit="jobs"
          icon={Target}
          color="bg-blue-50 border-blue-200"
          showProgress={false}
          isCount={true}
        />

        <KPICard
          title="Completed Jobs"
          value={metrics.completedJobs}
          unit="jobs"
          icon={Award}
          color="bg-green-50 border-green-200"
          showProgress={false}
          isCount={true}
          onClick={onCompletedJobsClick}
        />

        <KPICard
          title="Jobs at Risk"
          value={metrics.jobsAtRisk}
          unit="jobs"
          icon={AlertTriangle}
          color={metrics.jobsAtRisk > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}
          showProgress={false}
          isCount={true}
          onClick={onJobsAtRiskClick}
        />

        <KPICard
          title="Overtime Hours"
          value={metrics.overtimeHours}
          unit="hrs"
          icon={Clock}
          color="bg-orange-50 border-orange-200"
          showProgress={false}
          onClick={onOvertimeHoursClick}
        />
      </div>

      {currentUser?.name === 'Tsholo' && (
        <Card className="bg-indigo-50 border-indigo-200 mt-4">
          <CardContent className="pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-indigo-700">{metrics.totalTechnicians}</span>
              <span className="text-sm text-indigo-600">technicians</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-50 border-slate-200 mt-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-slate-600">Average Team Utilization</p>
              <p className="text-lg font-semibold text-slate-800">
                {metrics.utilization !== null ? `${metrics.utilization.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Team Efficiency</p>
              <p className="text-lg font-semibold text-slate-800">
                {metrics.efficiency !== null ? `${metrics.efficiency.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Risk Status</p>
              <Badge className={metrics.jobsAtRisk > 0 ? 'bg-red-600' : 'bg-green-600'}>
                {metrics.jobsAtRisk > 0 ? `${metrics.jobsAtRisk} at risk` : 'All Clear'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
