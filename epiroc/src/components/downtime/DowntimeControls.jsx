import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Clock, Pause, Play } from 'lucide-react';

/**
 * NOTE:
 * This UI is intentionally endpoint-agnostic until the backend exposes downtime/pause-resume routes.
 * We keep it reusable once we wire base44.entities.Downtime.* methods.
 */

export default function DowntimeControls({
  isPaused,
  onPause,
  onResume,
  categories = [],
  onLog,
  isLogging,
  logDraft,
  setLogDraft,
  selectedContextLabel = 'Current job/stage'
}) {
  const safeCategories = useMemo(() => {
    return Array.isArray(categories) ? categories : [];
  }, [categories]);

  return (
    <Card className="border-0 shadow-lg bg-white/95">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
          <Clock className="w-5 h-5 text-yellow-500" />
          Downtime (Pause / Resume)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="text-sm text-slate-600">
            {selectedContextLabel}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isPaused ? 'outline' : 'default'}
              className={isPaused ? 'border-yellow-400 text-yellow-700' : 'bg-yellow-400 hover:bg-yellow-500 text-slate-800'}
              disabled={!!isLogging || isPaused}
              onClick={onPause}
            >
              <Pause className="w-4 h-4 mr-2" /> Pause
            </Button>
            <Button
              variant={isPaused ? 'default' : 'outline'}
              className={isPaused ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'border-slate-300 text-slate-700'}
              disabled={!!isLogging || !isPaused}
              onClick={onResume}
            >
              <Play className="w-4 h-4 mr-2" /> Resume
            </Button>
          </div>
        </div>

        {isPaused ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">Log downtime details</div>
                <div className="text-amber-800">Select category and enter duration/notes before saving.</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Category</label>
                  <Select
                    value={logDraft.category}
                    onValueChange={(v) => setLogDraft((p) => ({ ...p, category: v }))}
                    disabled={!!isLogging}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeCategories.map((c) => (
                        <SelectItem key={c.value || c} value={c.value || c}>
                          {c.label || c.value || c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Duration (hours)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-9"
                    value={logDraft.duration_hours}
                    onChange={(e) => setLogDraft((p) => ({ ...p, duration_hours: e.target.value }))}
                    disabled={!!isLogging}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <Textarea
                  className="h-24"
                  value={logDraft.note}
                  onChange={(e) => setLogDraft((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Explain why work is paused..."
                  disabled={!!isLogging}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                  disabled={!!isLogging || !logDraft.category || !logDraft.duration_hours}
                  onClick={onLog}
                >
                  {isLogging ? 'Saving...' : 'Save Downtime'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            Click <span className="font-semibold">Pause</span> when the technician stops work.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

