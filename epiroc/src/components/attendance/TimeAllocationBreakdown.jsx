import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pie, PieChart, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend as BarLegend, ResponsiveContainer as ResponsiveBarContainer } from 'recharts';
import { Loader, AlertCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function TimeAllocationBreakdown({ technicianId, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (technicianId && startDate && endDate) {
      fetchTimeAllocation();
    }
  }, [technicianId, startDate, endDate]);

  const fetchTimeAllocation = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/${technicianId}/performance?start_date=${startDate}&end_date=${endDate}`
      );

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else {
        setError('Failed to load time allocation data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-white/95">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader className="w-4 h-4 animate-spin" />
            Loading time allocation data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-white/95">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hours = data.hours_summary;
  const kpis = data.kpis;
  const absenceTracking = data.absence_tracking;

  // Prepare pie chart data
  const allocationData = [
    { name: 'Productive', value: hours.total_productive, color: '#3b82f6' },
    { name: 'Non-Productive', value: hours.total_non_productive, color: '#8b5cf6' },
    { name: 'Idle', value: hours.total_idle, color: '#f59e0b' },
    { name: 'Leave', value: hours.total_leave, color: '#ef4444' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg bg-white/95">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Time Allocation Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Productive</p>
              <p className="text-2xl font-bold text-blue-700">{hours.total_productive.toFixed(1)}h</p>
              <p className="text-xs text-blue-600 mt-1">{kpis.productive_percent.toFixed(1)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-xs text-purple-600 font-medium">Non-Productive</p>
              <p className="text-2xl font-bold text-purple-700">{hours.total_non_productive.toFixed(1)}h</p>
              <p className="text-xs text-purple-600 mt-1">{kpis.non_productive_percent.toFixed(1)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-xs text-yellow-600 font-medium">Idle</p>
              <p className="text-2xl font-bold text-yellow-700">{hours.total_idle.toFixed(1)}h</p>
              <p className="text-xs text-yellow-600 mt-1">{kpis.idle_percent.toFixed(1)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs text-red-600 font-medium">Leave/Sick</p>
              <p className="text-2xl font-bold text-red-700">{hours.total_leave.toFixed(1)}h</p>
              <p className="text-xs text-red-600 mt-1">{absenceTracking?.absence_days || 0} days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {allocationData.length > 0 && (
        <Card className="border-0 shadow-lg bg-white/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-800">Allocation Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(1)}h`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-lg bg-white/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800">KPI Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Availability</p>
              <p className="text-lg font-bold text-slate-800">{kpis.availability_percent.toFixed(1)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Utilization</p>
              <p className="text-lg font-bold text-slate-800">{kpis.utilization_percent.toFixed(1)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Working Days</p>
              <p className="text-lg font-bold text-slate-800">{absenceTracking?.working_days || 0}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Absence days (leave/sick) are completely excluded from KPI calculations.
              Working days shown above do not include absence days.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800">Hours Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              { label: 'Total Scheduled', value: hours.total_scheduled, color: 'bg-slate-100' },
              { label: 'Productive Hours', value: hours.total_productive, color: 'bg-blue-100' },
              { label: 'Non-Productive Hours', value: hours.total_non_productive, color: 'bg-purple-100' },
              { label: 'Idle Hours', value: hours.total_idle, color: 'bg-yellow-100' },
              { label: 'Leave/Sick Hours', value: hours.total_leave, color: 'bg-red-100' },
              { label: 'Available Hours', value: hours.available_hours, color: 'bg-green-100' }
            ].map((item, idx) => (
              <div key={idx} className={`flex justify-between items-center p-2 rounded ${item.color}`}>
                <span className="text-sm text-slate-700">{item.label}</span>
                <span className="text-sm font-semibold text-slate-800">{item.value.toFixed(2)}h</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
