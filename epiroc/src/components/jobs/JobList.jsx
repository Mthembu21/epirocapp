import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Trash2, AlertTriangle, Clock, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react';

import JobReassignModal from './JobReassignModal';

const statusConfig = {
    pending_confirmation: { label: 'Pending', color: 'bg-slate-100 text-slate-700', icon: Clock },
    active: { label: 'Active', color: 'bg-blue-100 text-blue-700', icon: Briefcase },
    in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700', icon: Briefcase },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    at_risk: { label: 'At Risk', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    over_allocated: { label: 'Over-Allocated', color: 'bg-orange-100 text-orange-700', icon: XCircle }
};

export default function JobList({ jobs, onDelete, onReassign, technicians = [], showActions = true, isReassigning = false }) {
    const [reassignJob, setReassignJob] = useState(null);

    const handleReassign = (data) => {
        if (onReassign) {
            onReassign(data);
        }
        setReassignJob(null);
    };

    if (!jobs || jobs.length === 0) {
        return (
            <Card className="border-0 shadow-lg bg-white/95">
                <CardContent className="py-12 text-center text-slate-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No jobs found</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-lg bg-white/95">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Briefcase className="w-5 h-5 text-yellow-500" />
                    Jobs ({jobs.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead>Job #</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Technician</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Progress</TableHead>
                                <TableHead className="text-right">Allocated</TableHead>
                                <TableHead className="text-right">Consumed</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">Utilized</TableHead>
                                {showActions && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobs.map((job) => {
                                const config = statusConfig[job.status] || statusConfig.active;
                                const StatusIcon = config.icon;
                                
                                return (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-mono font-semibold">{job.job_number}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{job.description}</TableCell>
                                        <TableCell>{job.assigned_technician_name}</TableCell>
                                        <TableCell>
                                            <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {config.label}
                                            </Badge>
                                            {job.bottleneck_count > 0 && (
                                                <Badge variant="outline" className="ml-1 text-red-600 border-red-200">
                                                    {job.bottleneck_count} issues
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-24">
                                                <Progress value={job.progress_percentage || 0} className="h-2" />
                                                <p className="text-xs text-center mt-1">{(job.progress_percentage || 0).toFixed(0)}%</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{job.allocated_hours}h</TableCell>
                                        <TableCell className="text-right text-blue-600">{(job.consumed_hours || 0).toFixed(1)}h</TableCell>
                                        <TableCell className="text-right text-green-600">{(job.remaining_hours || job.allocated_hours).toFixed(1)}h</TableCell>
                                        <TableCell className="text-right text-purple-600 font-medium">
                                            {job.status === 'completed' ? `${(job.total_hours_utilized || job.consumed_hours || 0).toFixed(1)}h` : '-'}
                                        </TableCell>
                                        {showActions && (
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {job.status !== 'completed' && technicians.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setReassignJob(job)}
                                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                            title="Reassign Job"
                                                        >
                                                            <ArrowRightLeft className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onDelete(job.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {reassignJob && (
                <JobReassignModal
                    job={reassignJob}
                    technicians={technicians}
                    isOpen={!!reassignJob}
                    onClose={() => setReassignJob(null)}
                    onReassign={handleReassign}
                    isLoading={isReassigning}
                />
            )}
        </Card>
    );
}