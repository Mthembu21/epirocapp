import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function ScheduleConfiguration() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/schedule/config');
      if (response.ok) {
        const data = await response.json();
        setSchedules(Array.isArray(data) ? data : [data]);
      } else {
        setError('Failed to load schedules');
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
            <div className="animate-spin">⏳</div>
            Loading schedule configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/95">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
          <Settings className="w-5 h-5 text-purple-500" />
          Working Day Schedule Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule._id || schedule.day_type} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 capitalize">
                  {schedule.day_type?.replace(/_/g, ' ')}
                </h3>
                {schedule.is_active && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Total Scheduled</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {schedule.total_scheduled_hours}h
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Fixed Hours</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {schedule.total_fixed_hours}h
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Productive Hours</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {schedule.available_productive_hours}h
                  </p>
                </div>
              </div>

              {schedule.fixed_non_productive_blocks && schedule.fixed_non_productive_blocks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-medium mb-2">Fixed Non-Productive Blocks</p>
                  <div className="space-y-2">
                    {schedule.fixed_non_productive_blocks.map((block, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                        <span className="text-slate-700">{block.name}</span>
                        <span className="text-slate-600 font-medium">{block.duration_hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>1.5 hours</strong> automatically reserved for fixed activities
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-800 text-sm mb-2">About Time Allocation</h4>
          <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
            <li>Fixed allocation: 15min meeting + 15min tea + 30min lunch + 30min housekeeping</li>
            <li>Remaining hours are available for productive work</li>
            <li>Absence days (leave/sick) are completely excluded from KPI calculations</li>
            <li>Time entries cannot be logged on absence days</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
