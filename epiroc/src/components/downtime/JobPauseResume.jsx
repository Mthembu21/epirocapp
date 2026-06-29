import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Pause, Play, Calendar, Briefcase } from 'lucide-react';
import { format } from 'date-fns';

export default function JobPauseResume({
  activeJobs = [],
  pausedJobs = {},
  onPauseJob,
  onResumeJob,
  isLoading = false,
  downtimeCategoryOptions = [],
}) {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [pauseDraft, setPauseDraft] = useState({
    pause_reason: '',
    description: '',
    expected_resume_time: '',
    duration_hours: '',
  });

  const selectedJob = activeJobs.find(j => String(j.id || j.job_number) === String(selectedJobId));
  const jobPauseStatus = selectedJob ? pausedJobs[selectedJob.id] : null;
  const isPaused = !!jobPauseStatus;

  const handlePause = async () => {
    if (!selectedJob || !pauseDraft.pause_reason || !pauseDraft.duration_hours) {
      alert('Please select a job, reason, and duration');
      return;
    }

    try {
      await onPauseJob({
        job_id: selectedJob.id || selectedJob.job_number,
        pause_reason: pauseDraft.pause_reason,
        description: pauseDraft.description,
        expected_resume_time: pauseDraft.expected_resume_time,
        duration_hours: Number(pauseDraft.duration_hours),
        paused_at: new Date().toISOString(),
      });

      // Reset form
      setPauseDraft({
        pause_reason: '',
        description: '',
        expected_resume_time: '',
        duration_hours: '',
      });
    } catch (error) {
      console.error('Error pausing job:', error);
      alert('Failed to pause job');
    }
  };

  const handleResume = async () => {
    if (!selectedJob) return;

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
      setPauseDraft({
        pause_reason: '',
        description: '',
        expected_resume_time: '',
        duration_hours: '',
      });
    } catch (error) {
      console.error('Error resuming job:', error);
      alert('Failed to resume job');
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
          <Briefcase className="w-5 h-5 text-yellow-500" />
          Pause / Resume Specific Job
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Job Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-800">
            Select Job to Manage
          </label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="border-slate-300">
              <SelectValue placeholder="Choose a job to pause/resume..." />
            </SelectTrigger>
            <SelectContent>
              {activeJobs.map((job) => {
                const jobKey = job.id || job.job_number;
                const isPausedJob = !!pausedJobs[jobKey];
                return (
                  <SelectItem key={jobKey} value={String(jobKey)}>
                    <div className="flex items-center gap-2">
                      {job.job_number}
                      {isPausedJob && <Badge className="bg-yellow-100 text-yellow-800 ml-2">Paused</Badge>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedJob && (
          <>
            {/* Job Details */}
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
                  <p className="font-semibold text-slate-800">{selectedJob.allocated_hours?.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-slate-600">Consumed Hours</p>
                  <p className="font-semibold text-slate-800">{selectedJob.consumed_hours?.toFixed(1)}h</p>
                </div>
              </div>
            </div>

            {/* Pause/Resume Controls */}
            {!isPaused ? (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-slate-800">Pause Job</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Reason for Pause *
                    </label>
                    <Select
                      value={pauseDraft.pause_reason}
                      onValueChange={(v) => setPauseDraft((p) => ({ ...p, pause_reason: v }))}
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Expected Pause Duration (hours) *
                    </label>
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={pauseDraft.duration_hours}
                      onChange={(e) => setPauseDraft((p) => ({ ...p, duration_hours: e.target.value }))}
                      placeholder="e.g., 2.5"
                      className="border-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Expected Resume Time (Optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={pauseDraft.expected_resume_time}
                    onChange={(e) => setPauseDraft((p) => ({ ...p, expected_resume_time: e.target.value }))}
                    className="border-slate-300"
                  />
                  <p className="text-xs text-slate-500">
                    📅 This helps track when work should resume
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Pause Description
                  </label>
                  <Textarea
                    value={pauseDraft.description}
                    onChange={(e) => setPauseDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Explain why this job is being paused..."
                    className="border-slate-300 h-20"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handlePause}
                    disabled={isLoading || !pauseDraft.pause_reason || !pauseDraft.duration_hours}
                    className="bg-yellow-400 hover:bg-yellow-500 text-slate-800 flex-1"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    {isLoading ? 'Pausing...' : 'Pause Job'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 border-t pt-4">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-2 text-yellow-900 mb-3">
                    <Clock className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="font-semibold">Job is Currently Paused</p>
                      <p className="text-sm text-yellow-800 mt-1">
                        Reason: <span className="font-medium">{jobPauseStatus?.pause_reason}</span>
                      </p>
                      <p className="text-sm text-yellow-800 mt-1">
                        Duration: <span className="font-medium">{jobPauseStatus?.duration_hours}h</span>
                      </p>
                      <p className="text-sm text-yellow-800 mt-1">
                        Expected Resume: <span className="font-medium">{getResumeTimeDisplay()}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {jobPauseStatus?.description && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-1">Pause Notes</p>
                    <p className="text-sm text-slate-700">{jobPauseStatus.description}</p>
                  </div>
                )}

                <Button
                  onClick={handleResume}
                  disabled={isLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Resuming...' : 'Resume Job'}
                </Button>
              </div>
            )}
          </>
        )}

        {!selectedJobId && (
          <div className="text-center py-8 text-slate-500">
            <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Select a job above to manage pause/resume</p>
          </div>
        )}

        {selectedJobId && !selectedJob && (
          <div className="text-center py-8 text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-600" />
            <p className="text-amber-700">Job not found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
