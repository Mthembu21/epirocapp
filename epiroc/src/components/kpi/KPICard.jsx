import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// value === null means the field was missing in the API response → show "N/A".
// value === 0   means backend calculated zero       → show "0.0".
// isLoading     → show "—" (fetch in-flight).

const getStatusColor = (value, type = 'percentage', isNegative = false) => {
  if (value === null || value === undefined) return 'bg-slate-50 border-slate-200';
  if (type === 'percentage') {
    if (isNegative) {
      if (value <= 20) return 'bg-green-50 border-green-200';
      if (value <= 35) return 'bg-yellow-50 border-yellow-200';
      return 'bg-red-50 border-red-200';
    } else {
      if (value >= 85) return 'bg-green-50 border-green-200';
      if (value >= 70) return 'bg-yellow-50 border-yellow-200';
      return 'bg-red-50 border-red-200';
    }
  }
  return 'bg-slate-50 border-slate-200';
};

const getTextColor = (value, type = 'percentage', isNegative = false) => {
  if (value === null || value === undefined) return 'text-slate-400';
  if (type === 'percentage') {
    if (isNegative) {
      if (value <= 20) return 'text-green-700';
      if (value <= 35) return 'text-yellow-700';
      return 'text-red-700';
    } else {
      if (value >= 85) return 'text-green-700';
      if (value >= 70) return 'text-yellow-700';
      return 'text-red-700';
    }
  }
  return 'text-slate-700';
};

export function KPICard({
  title,
  value,          // null | number
  unit = '%',
  icon: Icon,
  color,
  showProgress = true,
  isCount = false,
  isNegative = false,
  isLoading = false,
  statusText = null,
  onClick = null,
}) {
  const isNull = value === null || value === undefined;
  const resolvedColor = color ?? getStatusColor(value, isCount ? 'count' : 'percentage', isNegative);

  const displayValue = () => {
    if (isLoading) return '—';
    if (isNull)    return 'N/A';
    return value.toFixed(isCount ? 0 : 1);
  };

  return (
    <Card
      className={`border shadow-sm ${resolvedColor} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-600" />}
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`text-2xl font-bold ${isNull ? 'text-slate-400' : getTextColor(value, isCount ? 'count' : 'percentage', isNegative)}`}>
              {displayValue()}
            </span>
            <span className="text-sm text-slate-600">{isNull ? '' : unit}</span>
          </div>

          {/* Progress bar: skip when loading, null, or count */}
          {showProgress && !isCount && !isLoading && !isNull && (
            <Progress
              value={Math.min(Math.max(value, 0), 100)}
              className="h-1.5"
            />
          )}

          {/* Status badge: skip when loading or null */}
          {!isCount && !isLoading && !isNull && statusText && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-600">{statusText}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { getStatusColor, getTextColor };
