import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';

export default function AtRiskJobs({ jobs, jobReports, onSelectJob }) {
    // Filter at-risk and over-allocated jobs
    const riskyJobs = jobs.filter(j => 
        j.status === 'at_risk' || 
        j.status === 'over_allocated' ||
        j.bottleneck_count >= 2
    );

    if (riskyJobs.length === 0) {
        return null;
    }

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-orange-50 border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-700 text-lg">
                    <AlertTriangle className="w-5 h-5" />
                    Jobs Requiring Attention ({riskyJobs.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {riskyJobs.map(job => {
                        // Get recent bottlenecks for this job
                        const jobBottlenecks = jobReports?.filter(r => {
                            if (!r?.has_bottleneck) return false;
                            const rid = String(r?.job_id || '');
                            const jobId = String(job?.id || '');
                            const jobNumber = String(job?.job_number || '');
                            return (rid && jobId && rid === jobId) || (rid && jobNumber && rid === jobNumber);
                        }) || [];
                        
                        const latestBottleneck = jobBottlenecks[0];
                        const remainingDisplay = Number(
                            job.remaining_hours ?? (Number(job.allocated_hours || 0) - Number(job.consumed_hours || 0))
                        );
                        const canSelect = typeof onSelectJob === 'function';

                        return (
                            <div
                                key={job.id}
                                className={
                                    `bg-white rounded-lg p-4 shadow-sm ${canSelect ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`
                                }
                                role={canSelect ? 'button' : undefined}
                                tabIndex={canSelect ? 0 : undefined}
                                onClick={canSelect ? () => onSelectJob(job) : undefined}
                                onKeyDown={canSelect ? (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') onSelectJob(job);
                                } : undefined}
                                aria-label={canSelect ? `View details for job ${job.job_number}` : undefined}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-semibold text-slate-800">{job.job_number}</p>
                                        <p className="text-sm text-slate-600">
                                            {(job.technicians && job.technicians.length > 0)
                                                ? job.technicians.map(t => t.technician_name).filter(Boolean).join(', ')
                                                : (job.assigned_technician_name || '')}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {job.status === 'over_allocated' && (
                                            <Badge className="bg-orange-100 text-orange-700">
                                                <TrendingDown className="w-3 h-3 mr-1" />
                                                Over Hours
                                            </Badge>
                                        )}
                                        {job.bottleneck_count >= 2 && (
                                            <Badge className="bg-red-100 text-red-700">
                                                {job.bottleneck_count} Bottlenecks
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-slate-500">Progress</p>
                                        <p className="font-medium">{(job.aggregated_progress_percentage ?? job.progress_percentage ?? 0).toFixed(0)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Consumed</p>
                                        <p className="font-medium">{(job.consumed_hours || 0).toFixed(1)}h / {job.allocated_hours}h</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Remaining</p>
                                        <p className="font-medium text-green-600">{remainingDisplay.toFixed(1)}h</p>
                                    </div>
                                </div>

                                {latestBottleneck && (
                                    <div className="mt-3 p-2 bg-red-50 rounded text-sm">
                                        <p className="text-red-700 font-medium">Latest Issue:</p>
                                        <p className="text-red-600">
                                            {latestBottleneck.bottleneck_category?.replace(/_/g, ' ')} - {latestBottleneck.bottleneck_description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}