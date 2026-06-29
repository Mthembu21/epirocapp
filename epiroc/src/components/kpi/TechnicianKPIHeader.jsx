import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Briefcase, Clock, AlertCircle, Award, Calendar, Users, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// null-safe float parser: null = missing field, number = backend value (may be 0).
const safeFloat = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const getStatusColor = (value) => {
  if (value === null) return 'bg-slate-50 border-slate-200';
  if (value >= 85) return 'bg-green-50 border-green-200';
  if (value >= 70) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

const getTextColor = (value) => {
  if (value === null) return 'text-slate-400';
  if (value >= 85) return 'text-green-700';
  if (value >= 70) return 'text-yellow-700';
  return 'text-red-700';
};

const getTrend = (value) => {
  if (value === null) return null;
  if (value >= 85) return <TrendingUp  className="w-4 h-4 text-green-600" />;
  if (value >= 70) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
  return                  <TrendingDown className="w-4 h-4 text-red-600" />;
};

/**
 * Local KPICard for TechnicianKPIHeader.
 * value === null  → "N/A"
 * isLoading       → "—"
 * otherwise       → formatted number
 */
const KPICard = ({ title, value, unit = '%', icon: Icon, color, showProgress = true, trend = null, isLoading = false }) => {
  const isNull = value === null || value === undefined;

  return (
    <Card className={`border shadow-sm ${color}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-slate-600" />}
            {title}
          </CardTitle>
          {trend && <span className="text-xs text-slate-500">{trend}</span>}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${isNull ? 'text-slate-400' : getTextColor(value)}`}>
              {isLoading ? '—' : isNull ? 'N/A' : value.toFixed(1)}
            </span>
            <span className="text-sm text-slate-600">{isNull ? '' : unit}</span>
          </div>

          {/* Progress bar: only show when we have a real number */}
          {showProgress && unit === '%' && !isLoading && !isNull && (
            <Progress value={Math.min(value, 100)} className="h-1.5" />
          )}

          {/* Status label: only show when we have a real number */}
          {!isLoading && !isNull && (
            <div className="flex items-center gap-2 pt-1">
              {getTrend(value)}
              <span className="text-xs text-slate-600">
                {value >= 85 ? 'On Track' : value >= 70 ? 'Needs Attention' : 'Critical'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * TechnicianKPIHeader — 7-card KPI grid for the technician self-service portal.
 *
 * Props:
 *   metricsData   Normalized KPI object from normalizeKpis()
 *   hasData       true / false / null (null = unknown)
 *   isLoading     true while the fetch is in flight
 *   selectedDate  Human-readable date label
 */
export default function TechnicianKPIHeader({
  metricsData = {},
  isLoading = false,
  hasData = null,
  selectedDate = null,
}) {
  const metrics = useMemo(() => ({
    utilization:   safeFloat(metricsData?.utilization_percent),
    productivity:  safeFloat(metricsData?.productivity_percent),
    efficiency:    safeFloat(metricsData?.efficiency_percent),
    nonProductive: safeFloat(metricsData?.non_productive_percent),
    idle:          safeFloat(metricsData?.idle_percent),
    trainingHours: safeFloat(metricsData?.training_hours),
    leaveDays:     safeFloat(metricsData?.leave_days),
    sickDays:      safeFloat(metricsData?.sick_days),
  }), [metricsData]);

  console.log('[KPI TRACE] TechnicianKPIHeader — rendering with metrics:', metrics, { hasData, isLoading });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="bg-slate-100 h-28" />
        ))}
      </div>
    );
  }

  const noDataBanner = hasData === false && (
    <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>
        {selectedDate
          ? `No activity data recorded for ${selectedDate} yet. Log your time to see KPIs.`
          : 'No activity data recorded yet. Log your time to see KPIs.'
        }
      </span>
    </div>
  );

  // Safe sum for the summary row — treat null as 0 for the total display
  const safeSum = (...vals) => vals.reduce((acc, v) => acc + (v ?? 0), 0);

  return (
    <div className="space-y-4">
      {noDataBanner}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-slate-800">Performance Metrics</h2>
        {selectedDate && (
          <span className="text-sm text-slate-600 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {selectedDate}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Utilization"
          value={metrics.utilization}
          unit="%"
          icon={Briefcase}
          color={getStatusColor(metrics.utilization)}
          showProgress={true}
        />

        <KPICard
          title="Productivity"
          value={metrics.productivity}
          unit="%"
          icon={TrendingUp}
          color={getStatusColor(metrics.productivity)}
          showProgress={true}
        />

        <KPICard
          title="Efficiency"
          value={metrics.efficiency}
          unit="%"
          icon={Award}
          color={getStatusColor(metrics.efficiency)}
          showProgress={true}
        />

        <KPICard
          title="Non-Productive"
          value={metrics.nonProductive}
          unit="%"
          icon={Clock}
          color={getStatusColor(metrics.nonProductive)}
          showProgress={true}
        />

        <KPICard
          title="Training Hours"
          value={metrics.trainingHours}
          unit="hrs"
          icon={Award}
          color="bg-blue-50 border-blue-200"
          showProgress={false}
        />

        <KPICard
          title="Leave Days"
          value={metrics.leaveDays}
          unit="days"
          icon={Calendar}
          color="bg-indigo-50 border-indigo-200"
          showProgress={false}
        />

        <KPICard
          title="Sick Days"
          value={metrics.sickDays}
          unit="days"
          icon={AlertCircle}
          color="bg-orange-50 border-orange-200"
          showProgress={false}
        />
      </div>

      <Card className="bg-slate-50 border-slate-200 mt-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-slate-600">Total Time Used</p>
              <p className="text-lg font-semibold text-slate-800">
                {hasData === false
                  ? 'N/A'
                  : `${safeSum(metrics.productivity, metrics.nonProductive, metrics.idle).toFixed(1)}%`
                }
              </p>
            </div>
            <div>
              <p className="text-slate-600">Productive Time</p>
              <p className="text-lg font-semibold text-green-700">
                {metrics.productivity !== null ? `${metrics.productivity.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Performance Grade</p>
              {metrics.efficiency !== null
                ? (
                  <Badge className={metrics.efficiency >= 85 ? 'bg-green-600' : metrics.efficiency >= 70 ? 'bg-yellow-600' : 'bg-red-600'}>
                    {metrics.efficiency >= 85 ? 'Excellent' : metrics.efficiency >= 70 ? 'Good' : 'Needs Help'}
                  </Badge>
                )
                : <span className="text-slate-400 text-sm">N/A</span>
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
