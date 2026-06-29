import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Pause, Play, Calendar, Briefcase, Calendar as CalendarIcon } from 'lucide-react';
import { format, differenceInHours, eachDayOfInterval, isWeekend } from 'date-fns';

/**
 * Unified Job Pause/Resume Form Component
 * 
 * Features:
 * - Select specific job to pause/resume
 * - Two pause modes:
 *   1. Manual hours entry (e.g., "2.5 hours")
 *   2. Date-range selection (automatically calculates working hours)
 * - Tracks pause reason, description, and timestamps
 * - Shows job details and pause status
 */
export default function JobPauseResumeForm({
  activeJobs = [],
  pausedJobs = {},
  onPauseJob,
  onResumeJob,
  isLoading = false,
}) {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [pauseMode, setPauseMode] = useState('manual'); // 'manual' or 'daterange'
  
  const [pauseDraft, setPauseDraft] = useState({
    pause_reason: '',
    description: '',
    // Manual mode
    duration_hours: '',
    // Date-range mode
    pause_start_date: '',
    pause_end_date: '',
    calculated_hours: 0,
  });

  const selectedJob = activeJobs.find(j => String(j.id || j.job_number) === String(selectedJobId));
  const jobPauseStatus = selectedJob ? pausedJobs[selectedJob.id] : null;
  const isPaused = !!jobPauseStatus;

  // Calculate working hours from date range (excludes weekends, considers business hours)
  const calculatedHours = useMemo(() => {
    if (pauseMode !== 'daterange' || !pauseDraft.pause_start_date || !pauseDraft.pause_end_date) {
      return 0;
    }

    try {
      const startDate = new Date(pauseDraft.pause_start_date);
      const endDate = new Date(pauseDraft.pause_end_date);

      if (startDate > endDate) return 0;

      const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
        .filter(day => !isWeekend(day));

      // Standard working hours per day
      // Monday-Thursday: 7.5 hours, Friday: 6 hours
      let totalHours = 0;
      workingDays.forEach(day => {
        const dayOfWeek = day.getDay();
        const isFriday = dayOfWeek === 5;
        totalHours += isFriday ? 6 : 7.5;
      });

      return totalHours;
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 0;
    }
  }, [pauseMode, pauseDraft.pause_start_date, pauseDraft.pause_end_date]);

  const handlePause = async () => {
    if (!selectedJob) {
      alert('Please select a job');
      return;
    }

    if (!pauseDraft.pause_reason) {
      alert('Please select a pause reason');
      return;
    }

    const durationHours = pauseMode === 'manual'
      ? Number(pauseDraft.duration_hours)
      : calculatedHours;

    if (!durationHours || durationHours <= 0) {
      alert('Please enter valid pause duration or select date range');
      return;
    }

    try {
      await onPauseJob({
        job_id: selectedJob.id || selectedJob.job_number,
        pause_reason: pauseDraft.pause_reason,
        description: pauseDraft.description,
        duration_hours: durationHours,
        pause_start_date: pauseMode === 'daterange' ? pauseDraft.pause_start_date : null,
        pause_end_date: pauseMode === 'daterange' ? pauseDraft.pause_end_date : null,
        paused_at: new Date().toISOString(),
      });

      // Reset form
      setPauseMode('manual');
      setPauseDraft({
        pause_reason: '',
        description: '',
        duration_hours: '',
        pause_start_date: '',
        pause_end_date: '',
        calculated_hours: 0,
      });
      setSelectedJobId('');

      alert('Job paused successfully');
    } catch (error) {
      console.error('Error pausing job:', error);
      alert(error?.message || 'Failed to pause job');
    }
  };

  const handleResume = async () => {
    if (!selectedJob) {
      alert('Please select a job');
      return;
    }

    try {
      const pauseData = jobPauseStatus || {};
      await onResumeJob({
        job_id: selectedJob.id || selectedJob.job_number,
        resumed_at: new Date().toISOString(),
        downtime_hours: pauseData.duration_hours || 0,
        pause_duration_actual: pauseData.duration_hours || 0,
      });

      // Reset form
      setSelectedJobId('');
      setPauseMode('manual');
      setPauseDraft({
        pause_reason: '',
        description: '',
        duration_hours: '',
        pause_start_date: '',
        pause_end_date: '',
        calculated_hours: 0,
      });

      alert('Job resumed successfully');
    } catch (error) {
      console.error('Error resuming job:', error);
      alert(error?.message || 'Failed to resume job');
    }
  };

  const getResumeTimeDisplay = () => {
    if (!jobPauseStatus) return null;
    const pausedAt = new Date(jobPauseStatus.paused_at);
    const durationHours = jobPauseStatus.duration_hours || 0;
    const resumeTime = new Date(pausedAt.getTime() + durationHours * 60 * 60 * 1000);
    return format(resumeTime, 'MMM dd, HH:mm');
  };

  return (
    <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Clock className="w-5 h-5 text-yellow-500" />
          Pause / Resume Job
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Job Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-800">
            Select Job to Manage *
          </label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={isLoading}>
            <SelectTrigger className="border-slate-300">
              <SelectValue placeholder="Choose a job to pause/resume..." />
            </SelectTrigger>
            <SelectContent>
              {activeJobs.length === 0 ? (
                <div className="p-2 text-sm text-slate-500">No active jobs</div>
              ) : (
                activeJobs.map((job) => {
                  const jobKey = job.id || job.job_number;
                  const isPausedJob = !!pausedJobs[jobKey];
                  return (
                    <SelectItem key={jobKey} value={String(jobKey)}>
                      <div className="flex items-center gap-2">
                        <span>{job.job_number}</span>
                        {isPausedJob && (
                          <Badge className="bg-yellow-100 text-yellow-800 text-xs">Paused</Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedJob && (
          <>
            {/* Job Details Display */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">Job Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Job Number</p>
                  <p className="font-semibold text-slate-800">{selectedJob.job_number}</p>
                </div>
                <div>
                  <p className="text-slate-600">Status</p>
                  <Badge className={
                    isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }>
                    {isPaused ? 'Paused' : 'Active'}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-600">Allocated Hours</p>
                  <p className="font-semibold text-slate-800">
                    {selectedJob.allocated_hours?.toFixed(1) || '0'}h
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Consumed Hours</p>
                  <p className="font-semibold text-slate-800">
                    {selectedJob.consumed_hours?.toFixed(1) || '0'}h
                  </p>
                </div>
                {isPaused && jobPauseStatus && (
                  <>
                    <div>
                      <p className="text-slate-600">Paused Since</p>
                      <p className="font-semibold text-slate-800">
                        {format(new Date(jobPauseStatus.paused_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Downtime Hours</p>
                      <p className="font-semibold text-slate-800">
                        {jobPauseStatus.duration_hours?.toFixed(1) || '0'}h
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pause/Resume Controls */}
            {!isPaused ? (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Pause className="w-4 h-4 text-yellow-500" />
                  Pause Job
                </h4>

                {/* Pause Reason */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Reason for Pause *
                  </label>
                  <Select
                    value={pauseDraft.pause_reason}
                    onValueChange={(v) => setPauseDraft((p) => ({ ...p, pause_reason: v }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="border-slate-300">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiting_parts">Waiting for Parts</SelectItem>
                      <SelectItem value="equipment_issue">Equipment Issue</SelectItem>
                      <SelectItem value="customer_delay">Customer Delay</SelectItem>
                      <SelectItem value="weather">Weather</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="safety">Safety Hold</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pause Mode Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    How to specify pause duration? *
                  </label>
                  <div className="flex gap-3">
                    <Button
                      variant={pauseMode === 'manual' ? 'default' : 'outline'}
                      className={`flex-1 ${pauseMode === 'manual' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setPauseMode('manual')}
                      disabled={isLoading}
                    >
                      Manual Hours
                    </Button>
                    <Button
                      variant={pauseMode === 'daterange' ? 'default' : 'outline'}
                      className={`flex-1 ${pauseMode === 'daterange' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setPauseMode('daterange')}
                      disabled={isLoading}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Date Range
                    </Button>
                  </div>
                </div>

                {/* Manual Mode - Duration Input */}
                {pauseMode === 'manual' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Pause Duration (hours) *
                    </label>
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={pauseDraft.duration_hours}
                      onChange={(e) => setPauseDraft((p) => ({ ...p, duration_hours: e.target.value }))}
                      placeholder="e.g., 2.5"
                      className="border-slate-300"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-slate-500">
                      Enter the number of hours the job will be paused
                    </p>
                  </div>
                )}

                {/* Date Range Mode */}
                {pauseMode === 'daterange' && (
                  <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong>Note:</strong> Pause hours will be calculated based on working days (Mon-Thu: 7.5h, Fri: 6h)
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Pause Start Date *
                        </label>
                        <Input
                          type="date"
                          value={pauseDraft.pause_start_date}
                          onChange={(e) => setPauseDraft((p) => ({ ...p, pause_start_date: e.target.value }))}
                          className="border-slate-300"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Pause End Date *
                        </label>
                        <Input
                          type="date"
                          value={pauseDraft.pause_end_date}
                          onChange={(e) => setPauseDraft((p) => ({ ...p, pause_end_date: e.target.value }))}
                          className="border-slate-300"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {pauseDraft.pause_start_date && pauseDraft.pause_end_date && (
                      <div className="bg-white p-3 rounded border border-blue-300">
                        <p className="text-sm text-slate-700">
                          <strong>Calculated Pause Duration:</strong>{' '}
                          <span className="text-lg font-semibold text-blue-600">
                            {calculatedHours.toFixed(1)} hours
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          From {format(new Date(pauseDraft.pause_start_date), 'MMM dd, yyyy')} to{' '}
                          {format(new Date(pauseDraft.pause_end_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Description / Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <Textarea
                    value={pauseDraft.description}
                    onChange={(e) => setPauseDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Add any additional details about why the job is paused..."
                    className="border-slate-300 h-20"
                    disabled={isLoading}
                  />
                </div>

                {/* Pause Button */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold"
                    disabled={
                      isLoading ||
                      !pauseDraft.pause_reason ||
                      (pauseMode === 'manual' && !pauseDraft.duration_hours) ||
                      (pauseMode === 'daterange' && !pauseDraft.pause_start_date) ||
                      (pauseMode === 'daterange' && !pauseDraft.pause_end_date) ||
                      (pauseMode === 'daterange' && calculatedHours <= 0)
                    }
                    onClick={handlePause}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    {isLoading ? 'Pausing...' : 'Pause Job'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Resume Section */
              <div className="space-y-4 border-t pt-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-yellow-900">Job is Currently Paused</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        Reason: <span className="font-medium">{jobPauseStatus?.pause_reason}</span>
                      </p>
                      {jobPauseStatus?.description && (
                        <p className="text-sm text-yellow-800 mt-1">
                          Description: <span className="font-medium">{jobPauseStatus.description}</span>
                        </p>
                      )}
                      <p className="text-sm text-yellow-800 mt-2">
                        Paused on: {format(new Date(jobPauseStatus.paused_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                      <p className="text-sm text-yellow-800">
                        Downtime: {jobPauseStatus.duration_hours?.toFixed(1)} hours
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                  disabled={isLoading}
                  onClick={handleResume}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Resuming...' : 'Resume Job'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
