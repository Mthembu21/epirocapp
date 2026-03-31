import React, { useState } from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock, Users, Wrench, LogOut, Briefcase, TrendingUp, AlertTriangle, Pencil, Trash2, Save, X } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

import StatsCard from '../components/timesheet/StatsCard';
import ExportButton from '../components/timesheet/ExportButton';
import TechnicianModal from '../components/technician/TechnicianModal';
import GlobalTechnicianSelector from '../components/technician/GlobalTechnicianSelector';
import TechnicianList from '../components/technician/TechnicianList';
import JobAllocationModal from '../components/jobs/JobAllocationModal';
import JobList from '../components/jobs/JobList';
import AtRiskJobs from '../components/jobs/AtRiskJobs';
import TechnicianPerformance from '../components/dashboard/TechnicianPerformance';
import PerformanceCharts from '../components/dashboard/PerformanceCharts';
import HRExportButton from '../components/dashboard/HRExportButton';
import MonthlyArchiveManager from '../components/dashboard/MonthlyArchiveManager';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hours are now calculated per entry, not constants

export default function Dashboard() {
    const [techModalOpen, setTechModalOpen] = useState(false);
    const [globalTechSelectorOpen, setGlobalTechSelectorOpen] = useState(false);
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [editingLogId, setEditingLogId] = useState(null);
    const [editLogDraft, setEditLogDraft] = useState({ hours_logged: '', category: '', category_detail: '' });
    const [selectedJobDetails, setSelectedJobDetails] = useState(null);
    const [isEditingJob, setIsEditingJob] = useState(false);
    const [jobEditDraft, setJobEditDraft] = useState({ job_number: '', description: '', allocated_hours: '', status: '' });
    const [jobAddTechnicianId, setJobAddTechnicianId] = useState('');
    const [selectedJobTechnicianId, setSelectedJobTechnicianId] = useState('');
    const [techStageAllocDraft, setTechStageAllocDraft] = useState({});
    const [approvalHoursDraft, setApprovalHoursDraft] = useState({});
    const [completedDialogOpen, setCompletedDialogOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const queryClient = useQueryClient();

    React.useEffect(() => {
        const validateSession = async () => {
            const storedUser = localStorage.getItem('epiroc_user');
            if (!storedUser) {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            const parsed = JSON.parse(storedUser);
            if (parsed.type !== 'supervisor') {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            setCurrentUser(parsed);
            try {
                const me = await base44.auth.me();
                if (me?.user) {
                    setCurrentUser(me.user);
                    localStorage.setItem('epiroc_user', JSON.stringify(me.user));
                }
                setIsAuthenticated(true);
            } catch {
                // Session expired — redirect to login
                localStorage.removeItem('epiroc_user');
                window.location.href = createPageUrl('WorkshopLogin');
            }
        };
        validateSession();
    }, []);

    const supervisorKey = currentUser?.supervisor_key || 'component';
    const supervisorRole = currentUser?.role || 'supervisor';
    const supervisorAccess = Array.isArray(currentUser?.access) ? currentUser.access : [];

    const workshopButtons = [
        { key: 'component', label: 'Components', accessKey: 'components' },
        { key: 'pdis', label: 'PDI', accessKey: 'pdi' },
        { key: 'rebuild', label: 'Rebuild', accessKey: 'rebuild' }
    ].filter((w) => supervisorAccess.includes(w.accessKey));

    const handleSwitchWorkshop = async (nextKey) => {
        if (!nextKey || nextKey === currentUser?.supervisor_key) return;
        try {
            const result = await base44.auth.switchTenant(nextKey);
            if (result?.user) {
                setCurrentUser(result.user);
                localStorage.setItem('epiroc_user', JSON.stringify(result.user));
            }
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobReports'] });
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
        } catch (e) {
            alert(e?.message || 'Could not switch workshop');
        }
    };
    const dashboardLabel = supervisorKey === 'rebuild'
        ? 'REBUILD DASHBOARD'
        : supervisorKey === 'pdis'
            ? 'PDIS DASHBOARD'
            : 'COMPONENT DASHBOARD';

    const handleLogout = async () => {
        try { await base44.auth.logout(); } catch {}
        localStorage.removeItem('epiroc_user');
        window.location.href = createPageUrl('WorkshopLogin');
    };

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => base44.entities.Technician.list(),
        enabled: isAuthenticated
    });

    const updateSubtaskMutation = useMutation({
        mutationFn: async ({ jobNumber, subtaskId, data }) => base44.entities.Job.subtasks.update(jobNumber, subtaskId, data),
        onSuccess: async (_updatedSubtask, vars) => {
            const latest = await base44.entities.Job.getByJobNumber(vars.jobNumber);
            setSelectedJobDetails(latest);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
        onError: (e) => {
            alert(e?.message || 'Failed to update stage allocation');
        }
    });

    const { data: jobs = [] } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => base44.entities.Job.list('-created_date', 200),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 5000 : false
    });

    const { data: timeLogs = [] } = useQuery({
        queryKey: ['timeLogs'],
        queryFn: () => base44.entities.DailyTimeEntry.list('-log_date', 500),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 10000 : false
    });

    const { data: idleInfo } = useQuery({
        queryKey: ['idleCategories'],
        queryFn: () => base44.entities.DailyTimeEntry.idleCategories(),
        enabled: isAuthenticated
    });

    const { data: jobReports = [] } = useQuery({
        queryKey: ['jobReports'],
        queryFn: () => base44.entities.JobReport.list('-date', 200),
        enabled: isAuthenticated
    });

    const isForeman = currentUser?.type === 'supervisor' && ['foreman', 'manager'].includes(currentUser?.role);
    const isComponentSupervisor = currentUser?.type === 'supervisor' && currentUser?.supervisor_key === 'component';
    
    // Enable approvals for component supervisors and foreman (but different scopes)
    const approvalEnabled = isAuthenticated && (isComponentSupervisor || isForeman);

    const { data: pendingApprovals = [], error: approvalError } = useQuery({
        queryKey: ['pendingApprovals', currentUser?.supervisor_key],
        queryFn: () => base44.entities.DailyTimeEntry.approvals.pending(),
        enabled: approvalEnabled,
        refetchInterval: approvalEnabled ? 10000 : false,
        retry: (failureCount, error) => {
            // Don't retry on 401 errors (session expired)
            if (error?.response?.status === 401) {
                return false;
            }
            return failureCount < 3;
        },
        // Ensure we always have an array to prevent React errors
        select: (data) => {
            console.log('Raw API response:', data);
            // Always return an array, even if data is malformed
            if (Array.isArray(data)) {
                return data;
            }
            // If data is an object with keys, convert to array
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                console.log('Converting object to array:', Object.keys(data));
                return Object.values(data || {});
            }
            // Fallback to empty array
            console.log('Returning fallback array');
            return [];
        }
    });

    const createTechnicianMutation = useMutation({
        mutationFn: (data) => base44.entities.Technician.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicians'] })
    });

    const updateTechnicianMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Technician.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicians'] })
    });

    const deleteTechnicianMutation = useMutation({
        mutationFn: async (id) => {
            // Delete all time entries for this technician
            const techEntries = timeLogs.filter(e => e.technician_id === id);
            for (const entry of techEntries) {
                await base44.entities.DailyTimeEntry.delete(entry.id);
            }
            // Delete the technician
            await base44.entities.Technician.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const createJobMutation = useMutation({
        mutationFn: (data) => base44.entities.Job.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const deleteJobMutation = useMutation({
        mutationFn: (id) => base44.entities.Job.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const updateTimeLogMutation = useMutation({
        mutationFn: ({ id, timeLog }) => base44.entities.DailyTimeEntry.update(id, { timeLog }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setEditingLogId(null);
            setEditLogDraft({ hours_logged: '', category: '', category_detail: '' });
        }
    });

    const deleteTimeLogMutation = useMutation({
        mutationFn: (id) => base44.entities.DailyTimeEntry.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
    });

    const approveTimeLogMutation = useMutation({
        mutationFn: ({ id, approved_hours, note }) => base44.entities.DailyTimeEntry.approvals.approve(id, { approved_hours, note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const declineTimeLogMutation = useMutation({
        mutationFn: ({ id, note }) => base44.entities.DailyTimeEntry.approvals.decline(id, { note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const recoverTechnicalComplexityMutation = useMutation({
        mutationFn: async (jobNumber) => base44.entities.Job.recoverTechnicalComplexity(jobNumber),
        onSuccess: (updatedJob) => {
            setSelectedJobDetails(updatedJob);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobReports'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const updateJobByNumberMutation = useMutation({
        mutationFn: async ({ jobNumber, data }) => base44.entities.Job.updateByJobNumber(jobNumber, data),
        onSuccess: (updatedJob, variables) => {
            setSelectedJobDetails(updatedJob);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });

            if (!variables?.keepEditing) {
                setIsEditingJob(false);
                setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '' });
                setJobAddTechnicianId('');
            }
        },
        onError: (e) => {
            alert(e?.message || 'Failed to update job');
        }
    });

    const openJobDetails = async (job) => {
        try {
            const jobNumber = job?.job_number;
            if (!jobNumber) return;
            const latest = await base44.entities.Job.getByJobNumber(jobNumber);
            setSelectedJobDetails(latest);
        } catch (e) {
            alert(e?.message || 'Could not load job details');
        }
    };

    const reassignJobMutation = useMutation({
        mutationFn: async ({ jobId, newTechnicianId, newTechnicianName, previousTechnicianId, previousTechnicianName, reason, subtask_allocations }) => {
            const job = jobs.find(j => j.id === jobId);
            const reassignmentHistory = job?.reassignment_history || [];
            
            reassignmentHistory.push({
                from_technician_id: previousTechnicianId,
                from_technician_name: previousTechnicianName,
                to_technician_id: newTechnicianId,
  
                to_technician_name: newTechnicianName,
                reassigned_date: new Date().toISOString(),
                reason: reason || ''
            });

            await base44.entities.Job.update(jobId, { reassignment_history: reassignmentHistory });

            // Assign an additional technician to the same job (do not create a new job)
            await base44.entities.Job.assignTechnicianByJobNumber(
                job?.job_number,
                newTechnicianId,
                newTechnicianName
            );

            const allocations = Array.isArray(subtask_allocations) ? subtask_allocations : [];
            if (allocations.length) {
                const latest = await base44.entities.Job.getByJobNumber(job?.job_number);
                for (const a of allocations) {
                    const st = (latest?.subtasks || []).find((s) => String(s?._id || s?.id) === String(a.subtaskId));
                    if (!st) continue;
                    const assigned = Array.isArray(st.assigned_technicians) ? st.assigned_technicians : [];
                    const exists = assigned.some((x) => String(x?.technician_id) === String(newTechnicianId));
                    const nextAssigned = exists
                        ? assigned.map((x) => String(x?.technician_id) === String(newTechnicianId)
                            ? { ...x, allocated_hours: Number(a.allocated_hours || 0) }
                            : x
                        )
                        : [...assigned, { technician_id: newTechnicianId, technician_name: newTechnicianName, allocated_hours: Number(a.allocated_hours || 0) }];
                    await base44.entities.Job.subtasks.update(job?.job_number, String(st?._id || st?.id), { assigned_technicians: nextAssigned });
                }
            }

            const latestAfter = await base44.entities.Job.getByJobNumber(job?.job_number);
            return latestAfter;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const addTechnicianMutation = useMutation({
        mutationFn: async ({ jobId, jobNumber, technicianId, technicianName, allocated_hours, subtask_allocations }) => {
            await base44.entities.Job.assignTechnicianByJobNumber(
                jobNumber,
                technicianId,
                technicianName
            );

            const allocations = Array.isArray(subtask_allocations) ? subtask_allocations : [];
            if (allocations.length) {
                const latest = await base44.entities.Job.getByJobNumber(jobNumber);
                for (const a of allocations) {
                    const st = (latest?.subtasks || []).find((s) => String(s?._id || s?.id) === String(a.subtaskId));
                    if (!st) continue;
                    const assigned = Array.isArray(st.assigned_technicians) ? st.assigned_technicians : [];
                    const exists = assigned.some((x) => String(x?.technician_id) === String(technicianId));
                    const nextAssigned = exists
                        ? assigned.map((x) => String(x?.technician_id) === String(technicianId)
                            ? { ...x, allocated_hours: Number(a.allocated_hours || 0) }
                            : x
                        )
                        : [...assigned, { technician_id: technicianId, technician_name: technicianName, allocated_hours: Number(a.allocated_hours || 0) }];
                    await base44.entities.Job.subtasks.update(jobNumber, String(st?._id || st?.id), { assigned_technicians: nextAssigned });
                }
            }

            const desiredAllocated = allocated_hours === '' || typeof allocated_hours === 'undefined' || allocated_hours === null
                ? null
                : Number(allocated_hours);

            if (desiredAllocated !== null && !Number.isNaN(desiredAllocated)) {
                const current = jobs.find(j => j.id === jobId);
                const currentAllocated = Number(current?.allocated_hours);
                if (!Number.isNaN(currentAllocated) && desiredAllocated !== currentAllocated) {
                    await base44.entities.Job.update(jobId, { allocated_hours: desiredAllocated });
                }
            }

            const latestAfter = await base44.entities.Job.getByJobNumber(jobNumber);
            return latestAfter;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const activeJobs = jobs.filter(j =>
        ['pending_confirmation', 'active', 'in_progress', 'at_risk'].includes(j.status)
        || Number(j.bottleneck_count || 0) >= 2
    );
    const atRiskJobs = jobs.filter(j => j.status === 'at_risk' || j.bottleneck_count >= 2);
    const completedJobs = jobs.filter(j => j.status === 'completed');

    const technicianNameById = (technicians || []).reduce((acc, t) => {
        const id = String(t?.id || t?._id || t?.technician_id || '');
        if (!id) return acc;
        acc[id] = t?.name || t?.technician_name || acc[id];
        return acc;
    }, {});

    const completedStageRows = React.useMemo(() => {
        const rows = [];
        for (const j of (completedJobs || [])) {
            const jobNumber = j?.job_number || '';
            const jobCompletedAt = j?.actual_completion_date ? new Date(j.actual_completion_date) : null;

            for (const st of (j?.subtasks || [])) {
                const stageTitle = st?.title || '';
                const progressEntries = Array.isArray(st?.progress_by_technician) ? st.progress_by_technician : [];
                for (const p of progressEntries) {
                    const pct = Number(p?.progress_percentage || 0);
                    const completed = Boolean(p?.completed) || pct >= 100 - 1e-9;
                    if (!completed) continue;

                    const completionTime = p?.completed_at ? new Date(p.completed_at) : jobCompletedAt;
                    rows.push({
                        job_number: jobNumber,
                        technician_id: p?.technician_id,
                        stage: stageTitle,
                        completed_at: completionTime
                    });
                }
            }

            if (!rows.some((r) => String(r.job_number) === String(jobNumber)) && jobCompletedAt) {
                const techNames = (j?.technicians || []).map((t) => t?.technician_name).filter(Boolean).join(', ');
                rows.push({
                    job_number: jobNumber,
                    technician_id: techNames || null,
                    stage: '- ',
                    completed_at: jobCompletedAt
                });
            }
        }

        return rows
            .filter((r) => r.job_number)
            .sort((a, b) => {
                const at = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                const bt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                return bt - at;
            });
    }, [completedJobs, technicians]);
    
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
    const timeLogsForMonth = (timeLogs || []).filter((e) => {
        if (!e?.log_date) return false;
        const d = parseISO(e.log_date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    const totalHours = timeLogsForMonth.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    const totalOvertimeHours = timeLogsForMonth.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const totalProductiveHours = timeLogsForMonth.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const totalNonProductiveHours = timeLogsForMonth.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);

    const selectedJobIssues = selectedJobDetails
        ? (jobReports || []).filter((r) => {
            if (!r?.has_bottleneck) return false;
            const rid = String(r?.job_id || '');
            const jobId = String(selectedJobDetails?.id || '');
            const jobNumber = String(selectedJobDetails?.job_number || '');
            return (rid && jobId && rid === jobId) || (rid && jobNumber && rid === jobNumber);
        })
        : [];

    const selectedJobWorkLogs = selectedJobDetails
        ? (timeLogs || []).filter((l) => !l?.is_idle && String(l?.job_id) === String(selectedJobDetails?.job_number))
        : [];

    const getSubtaskTitle = (subtaskId) => {
        if (!selectedJobDetails || !subtaskId) return '';
        const st = (selectedJobDetails.subtasks || []).find((s) => String(s?._id || s?.id) === String(subtaskId));
        return st?.title || '';
    };

    const productivityRaw = totalHours > 0 ? (totalProductiveHours / totalHours) * 100 : 0;
    const productivity = Math.max(0, Math.min(100, productivityRaw));

    const getStandardProductiveHoursForDate = (dateObj) => {
        const dayIndex = dateObj.getDay();
        if (dayIndex === 5) return 6;
        return 7;
    };

    const utilizationDenom = totalProductiveHours + totalNonProductiveHours;
    const labourUtilizationRaw = utilizationDenom > 0
        ? (totalProductiveHours / utilizationDenom) * 100
        : 0;
    const labourUtilization = Math.max(0, Math.min(100, labourUtilizationRaw));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-400 p-3 rounded-xl shadow-lg">
                                    <Wrench className="w-8 h-8 text-slate-800" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-yellow-400 tracking-tight">EPIROC</h1>
                                    <p className="text-slate-400 text-xs tracking-widest">{dashboardLabel}</p>
                                    {currentUser?.email && (
                                        <p className="text-slate-500 text-xs">{currentUser.email}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {supervisorRole === 'manager' && supervisorAccess.includes('workshop_overview') && (
                                <Button
                                    variant="outline"
                                    className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
                                    onClick={() => { window.location.href = createPageUrl('WorkshopOverview'); }}
                                >
                                    Workshop Overview
                                </Button>
                            )}

                            {workshopButtons.map((w) => (
                                <Button
                                    key={w.key}
                                    variant={supervisorKey === w.key ? 'default' : 'outline'}
                                    className={
                                        supervisorKey === w.key
                                            ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold'
                                            : 'border-slate-600 text-slate-200 hover:bg-slate-700/40'
                                    }
                                    onClick={() => handleSwitchWorkshop(w.key)}
                                >
                                    {w.label}
                                </Button>
                            ))}

                            <HRExportButton timeEntries={timeLogsForMonth} technicians={technicians} />
                            <ExportButton entries={timeLogsForMonth} technicians={technicians} filename="epiroc_timesheet" />
                            <JobAllocationModal 
                                technicians={technicians}
                                existingJobs={jobs}
                                onSubmit={createJobMutation.mutateAsync}
                                isOpen={jobModalOpen}
                                setIsOpen={setJobModalOpen}
                            />
                            <GlobalTechnicianSelector
                                isOpen={globalTechSelectorOpen}
                                setIsOpen={setGlobalTechSelectorOpen}
                                onTechnicianSelect={(technician) => {
                                    // Handle technician selection - could assign to job, etc.
                                    console.log('Selected technician:', technician);
                                    // For now, just close the selector
                                    setGlobalTechSelectorOpen(false);
                                }}
                                currentSupervisorKey={currentUser?.supervisor_key}
                            />
                            <TechnicianModal 
                                onAdd={createTechnicianMutation.mutate}
                                isOpen={techModalOpen}
                                setIsOpen={setTechModalOpen}
                            />
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <MonthlyArchiveManager timeEntries={timeLogs} technicians={technicians} />
                    <div className="flex items-center gap-2">
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => {
                                const next = e.target.value;
                                if (!next) return;
                                setSelectedMonth(next);
                            }}
                            className="w-44 bg-white"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <StatsCard
                        title="Technicians"
                        value={technicians.filter(t => t.status === 'active').length}
                        subtitle="Active workers"
                        icon={Users}
                        color="slate"
                    />
                    <StatsCard
                        title="Active Jobs"
                        value={activeJobs.length}
                        subtitle="In progress"
                        icon={Briefcase}
                        color="blue"
                    />
                    <StatsCard
                        title="At Risk"
                        value={atRiskJobs.length}
                        subtitle="Need attention"
                        icon={AlertTriangle}
                        color="red"
                    />
                    <StatsCard
                        title="Completed"
                        value={completedJobs.length}
                        subtitle="This period"
                        icon={TrendingUp}
                        color="green"
                        onClick={() => setCompletedDialogOpen(true)}
                    />
                    <StatsCard
                        title="Total Hours"
                        value={`${totalHours.toFixed(0)}h`}
                        subtitle="All logged"
                        icon={Clock}
                        color="blue"
                    />
                    <StatsCard
                        title="Productive"
                        value={`${totalProductiveHours.toFixed(0)}h`}
                        subtitle="Workshop jobs"
                        icon={Clock}
                        color="green"
                    />
                    <StatsCard
                        title="Non-Prod"
                        value={`${totalNonProductiveHours.toFixed(0)}h`}
                        subtitle="IDLE categories"
                        icon={Clock}
                        color="slate"
                    />
                    <StatsCard
                        title="Overtime"
                        value={`${totalOvertimeHours.toFixed(0)}h`}
                        subtitle="Above daily limit"
                        icon={Clock}
                        color="yellow"
                    />
                    <StatsCard
                        title="Productivity"
                        value={`${productivity.toFixed(0)}%`}
                        subtitle="Productive / Total"
                        icon={TrendingUp}
                        color="green"
                    />
                    <StatsCard
                        title="Utilization"
                        value={`${labourUtilization.toFixed(0)}%`}
                        subtitle="This month (Target 85%)"
                        icon={TrendingUp}
                        color="yellow"
                    />
                </div>

                {atRiskJobs.length > 0 && (
                    <div className="mb-8">
                        <AtRiskJobs jobs={jobs} jobReports={jobReports} onSelectJob={setSelectedJobDetails} />
                    </div>
                )}

                <Tabs defaultValue="jobs" className="space-y-6">
                    <TabsList className="bg-slate-700/50 p-1 rounded-xl border border-slate-600">
                        <TabsTrigger 
                            value="jobs" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Briefcase className="w-4 h-4" />
                            Jobs
                        </TabsTrigger>
                        <TabsTrigger 
                            value="performance" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Performance
                        </TabsTrigger>
                        <TabsTrigger 
                            value="technicians" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Users className="w-4 h-4" />
                            Technicians
                        </TabsTrigger>
                        <TabsTrigger 
                            value="timeLogs" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Clock className="w-4 h-4" />
                            Time Logs
                        </TabsTrigger>

                        {isForeman && approvalEnabled && (
                            <TabsTrigger
                                value="approvals"
                                className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                            >
                                <Clock className="w-4 h-4" />
                                Approvals
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="jobs" className="mt-6">
                        <JobList 
                            jobs={activeJobs}
                            technicians={technicians}
                            onDelete={deleteJobMutation.mutate}
                            onReassign={reassignJobMutation.mutate}
                            onAddTechnician={addTechnicianMutation.mutate}
                            onSelectJob={openJobDetails}
                            isReassigning={reassignJobMutation.isPending}
                            isAddingTechnician={addTechnicianMutation.isPending}
                        />
                    </TabsContent>

                    <Dialog open={completedDialogOpen} onOpenChange={setCompletedDialogOpen}>
                        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
                            <DialogHeader>
                                <DialogTitle className="text-slate-800">Completed Jobs</DialogTitle>
                                <DialogDescription className="sr-only">
                                    Completed job and stage list.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="max-h-[65vh] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                <TableHead>Job #</TableHead>
                                                <TableHead>Technician</TableHead>
                                                <TableHead>Stage</TableHead>
                                                <TableHead>Completion Time</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {completedStageRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                                                        No completed jobs found
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                completedStageRows.map((r, idx) => {
                                                    const techLabel = technicianNameById[String(r.technician_id)]
                                                        || (typeof r.technician_id === 'string' ? r.technician_id : '')
                                                        || '-';
                                                    const timeLabel = r.completed_at ? new Date(r.completed_at).toLocaleString() : '-';
                                                    return (
                                                        <TableRow key={`${r.job_number}-${idx}`}>
                                                            <TableCell className="font-mono font-semibold">{r.job_number}</TableCell>
                                                            <TableCell>{techLabel}</TableCell>
                                                            <TableCell>{r.stage || '-'}</TableCell>
                                                            <TableCell>{timeLabel}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <TabsContent value="performance" className="mt-6">
                        <div className="space-y-6">
                            <PerformanceCharts 
                                technicians={technicians}
                                jobs={jobs}
                                timeEntries={timeLogsForMonth}
                            />
                            <TechnicianPerformance 
                                technicians={technicians}
                                jobs={jobs}
                                timeEntries={timeLogsForMonth}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="technicians" className="mt-6">
                        <div className="flex gap-3 mb-4">
                            <Button 
                                onClick={() => setTechModalOpen(true)}
                                className="bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Add My Technician
                            </Button>
                            <Button 
                                onClick={() => setGlobalTechSelectorOpen(true)}
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Search All Technicians
                            </Button>
                        </div>
                        <TechnicianList 
                            technicians={technicians}
                            onDelete={deleteTechnicianMutation.mutate}
                            onUpdate={updateTechnicianMutation.mutate}
                            isUpdating={updateTechnicianMutation.isPending}
                        />
                    </TabsContent>

                    <TabsContent value="timeLogs" className="mt-6">
                        <div className="bg-white/95 rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800">Time Logs</h3>
                                    <p className="text-xs text-slate-500">Edit or delete technician logs. This updates job hours and progress.</p>
                                </div>
                                <div className="text-xs text-slate-500">{timeLogsForMonth.length} logs</div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Technician</TableHead>
                                            <TableHead>Job</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Holiday</TableHead>
                                            <TableHead className="text-right">Multiplier</TableHead>
                                            <TableHead className="text-right">Hours</TableHead>
                                            <TableHead className="text-right">OT</TableHead>
                                            <TableHead className="text-right">Payable</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {timeLogsForMonth.map((log) => {
                                            const isEditing = editingLogId === log.id;
                                            const isIdle = !!log.is_idle;
                                            const showOtherDetail = isIdle && (editLogDraft.category === 'Other' || log.category === 'Other');
                                            const techName = log.technician_name
                                                || technicianNameById[String(log.technician_id)]
                                                || log.technician_id;
                                            const multiplier = Number(log.overtime_multiplier || 1);
                                            const payable = Number(log.payable_hours || (Number(log.hours_logged || 0) * multiplier));
                                            return (
                                                <TableRow key={log.id}>
                                                    <TableCell>{log.log_date ? parseISO(log.log_date).toLocaleDateString() : '-'}</TableCell>
                                                    <TableCell>{techName}</TableCell>
                                                    <TableCell className="font-mono text-sm">{log.job_id}</TableCell>
                                                    <TableCell>
                                                        {isIdle ? (
                                                            isEditing ? (
                                                                <div className="space-y-2 min-w-[180px]">
                                                                    <Select
                                                                        value={String(editLogDraft.category ?? '')}
                                                                        onValueChange={(value) => setEditLogDraft(prev => ({ ...prev, category: value }))}
                                                                    >
                                                                        <SelectTrigger className="h-8">
                                                                            <SelectValue placeholder="Category" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {(idleInfo?.categories || []).map(cat => (
                                                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {showOtherDetail && (
                                                                        <Input
                                                                            className="h-8"
                                                                            value={editLogDraft.category_detail}
                                                                            onChange={(e) => setEditLogDraft(prev => ({ ...prev, category_detail: e.target.value }))}
                                                                            placeholder="Other details"
                                                                        />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm">Idle: {log.category}{log.category === 'Other' && log.category_detail ? ` (${log.category_detail})` : ''}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-sm">Job</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.is_public_holiday ? (
                                                            <span className="text-xs font-semibold text-amber-700">
                                                                {log.public_holiday_name || 'Public Holiday'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-slate-700">
                                                        {multiplier.toFixed(1)}×
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.25"
                                                                className="h-8 w-24 ml-auto text-right"
                                                                value={editLogDraft.hours_logged}
                                                                onChange={(e) => setEditLogDraft(prev => ({ ...prev, hours_logged: e.target.value }))}
                                                            />
                                                        ) : (
                                                            `${Number(log.hours_logged || 0).toFixed(1)}h`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {`${Number(log.overtime_hours || 0).toFixed(1)}h`}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-slate-800">
                                                        {payable.toFixed(1)}h
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                                    onClick={() => {
                                                                        setEditingLogId(null);
                                                                        setEditLogDraft({ hours_logged: '', category: '', category_detail: '' });
                                                                    }}
                                                                    disabled={updateTimeLogMutation.isPending}
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-800"
                                                                    onClick={() => {
                                                                        const hours = Number(editLogDraft.hours_logged);
                                                                        if (!hours || hours <= 0) return;
                                                                        updateTimeLogMutation.mutate({
                                                                            id: log.id,
                                                                            timeLog: {
                                                                                hours_logged: hours,
                                                                                is_idle: log.is_idle,
                                                                                category: log.is_idle ? editLogDraft.category : log.category,
                                                                                category_detail: log.is_idle ? editLogDraft.category_detail : log.category_detail,
                                                                                subtask_id: log.subtask_id
                                                                            }
                                                                        });
                                                                    }}
                                                                    disabled={updateTimeLogMutation.isPending}
                                                                    title="Save"
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                                    onClick={() => {
                                                                        setEditingLogId(log.id);
                                                                        setEditLogDraft({
                                                                            hours_logged: String(log.hours_logged ?? ''),
                                                                            category: String(log.category ?? ''),
                                                                            category_detail: String(log.category_detail ?? '')
                                                                        });
                                                                    }}
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                                                                    onClick={() => {
                                                                        if (!window.confirm('Delete this time log? This will update job hours and progress.')) return;
                                                                        deleteTimeLogMutation.mutate(log.id);
                                                                    }}
                                                                    disabled={deleteTimeLogMutation.isPending}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    {isForeman && approvalEnabled && (
                        <TabsContent value="approvals" className="space-y-6">
                            <Card className="border-0 shadow-lg bg-white/95">
                                <CardHeader className="pb-4 border-b border-slate-100">
                                    <CardTitle className="text-slate-800">Pending Approvals ({pendingApprovals.length})</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Job</TableHead>
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Submitted</TableHead>
                                                    <TableHead className="text-right">Approve</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {console.log('Pending approvals data:', pendingApprovals, 'Type:', typeof pendingApprovals, 'IsArray:', Array.isArray(pendingApprovals))}
                                                {approvalError?.response?.status === 401 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-slate-500">
                                                            Session expired. Please log in again.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : !Array.isArray(pendingApprovals) ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-slate-500">
                                                            Error loading pending approvals
                                                        </TableCell>
                                                    </TableRow>
                                                ) : pendingApprovals.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-slate-500">
                                                            No pending approvals
                                                        </TableCell>
                                                    </TableRow>
                                                ) : pendingApprovals.map((log) => {
                                                    const submitted = Number(log?.hours_logged || 0);
                                                    const draft = approvalHoursDraft[log.id] ?? String(submitted);
                                                    const isIdle = !!log?.is_idle;
                                                    const typeLabel = isIdle ? (log?.category || 'Idle') : 'Job';
                                                    return (
                                                        <TableRow key={log.id}>
                                                            <TableCell>{log?.log_date ? format(new Date(log.log_date), 'yyyy-MM-dd') : ''}</TableCell>
                                                            <TableCell>
                                                            {log?.technician_id?.name || 
                                                             log?.technician_name || 
                                                             (typeof log?.technician_id === 'string' ? log.technician_id : 
                                                              typeof log?.technician_id === 'object' ? log.technician_id?._id || log.technician_id?.id || 'Unknown' :
                                                              'Unknown')}
                                                        </TableCell>
                                                            <TableCell>{typeLabel}</TableCell>
                                                            <TableCell className="font-mono">{log?.job_id}</TableCell>
                                                            <TableCell>{log?.subtask_title || '-'}</TableCell>
                                                            <TableCell className="text-right">{submitted.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.5"
                                                                    value={draft}
                                                                    onChange={(e) => setApprovalHoursDraft((p) => ({ ...p, [log.id]: e.target.value }))}
                                                                    className="h-8 w-24 text-right"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-8"
                                                                        disabled={approveTimeLogMutation.isPending || declineTimeLogMutation.isPending}
                                                                        onClick={() => {
                                                                            const val = Number(approvalHoursDraft[log.id] ?? submitted);
                                                                            approveTimeLogMutation.mutate({ id: log.id, approved_hours: Number.isNaN(val) ? 0 : val });
                                                                        }}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                                                                        disabled={approveTimeLogMutation.isPending || declineTimeLogMutation.isPending}
                                                                        onClick={() => {
                                                                            if (!window.confirm('Decline this time entry?')) return;
                                                                            declineTimeLogMutation.mutate({ id: log.id });
                                                                        }}
                                                                    >
                                                                        Decline
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>

                <Dialog open={!!selectedJobDetails} onOpenChange={(open) => {
                    if (!open) {
                        setSelectedJobDetails(null);
                        setIsEditingJob(false);
                        setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '' });
                        setSelectedJobTechnicianId('');
                        setTechStageAllocDraft({});
                    }
                }}>
                    <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">
                                Job Details: {selectedJobDetails?.job_number}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                View job details and edit job information.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(85vh-6rem)]">
                            <div className="flex items-start justify-between gap-3">
                                <div className="text-sm text-slate-600">
                                    {isEditingJob ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-500">Job Number</div>
                                                    <Input
                                                        value={jobEditDraft.job_number}
                                                        onChange={(e) => setJobEditDraft((p) => ({ ...p, job_number: e.target.value }))}
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-500">Allocated Hours</div>
                                                    <Input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        value={jobEditDraft.allocated_hours}
                                                        onChange={(e) => setJobEditDraft((p) => ({ ...p, allocated_hours: e.target.value }))}
                                                        className="h-8"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500">Status</div>
                                                <Select
                                                    value={jobEditDraft.status}
                                                    onValueChange={(value) => setJobEditDraft((p) => ({ ...p, status: value }))}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending_confirmation">pending confirmation</SelectItem>
                                                        <SelectItem value="active">active</SelectItem>
                                                        <SelectItem value="in_progress">in progress</SelectItem>
                                                        <SelectItem value="completed">completed</SelectItem>
                                                        <SelectItem value="at_risk">at risk</SelectItem>
                                                        <SelectItem value="overrun">overrun</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500">Description</div>
                                                <Input
                                                    value={jobEditDraft.description}
                                                    onChange={(e) => setJobEditDraft((p) => ({ ...p, description: e.target.value }))}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        selectedJobDetails?.description
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {isEditingJob ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditingJob(false);
                                                    setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '' });
                                                }}
                                                disabled={updateJobByNumberMutation.isPending}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    const nextNumber = String(jobEditDraft.job_number || '').trim();
                                                    if (!nextNumber) return;
                                                    const rawAllocated = String(jobEditDraft.allocated_hours ?? '').trim();
                                                    const nextAllocated = rawAllocated === '' ? null : Number(rawAllocated);
                                                    const nextStatus = String(jobEditDraft.status || '').trim();
                                                    const payload = {
                                                        job_number: nextNumber,
                                                        description: String(jobEditDraft.description || '').trim()
                                                    };

                                                    if (nextStatus) payload.status = nextStatus;
                                                    if (nextAllocated !== null && !Number.isNaN(nextAllocated)) {
                                                        payload.allocated_hours = nextAllocated;
                                                    }

                                                    updateJobByNumberMutation.mutate({
                                                        jobNumber: selectedJobDetails?.job_number,
                                                        data: payload
                                                    });
                                                }}
                                                disabled={updateJobByNumberMutation.isPending}
                                                className="bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                                            >
                                                {updateJobByNumberMutation.isPending ? 'Saving...' : 'Save'}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingJob(true);
                                                setJobEditDraft({
                                                    job_number: selectedJobDetails?.job_number || '',
                                                    description: selectedJobDetails?.description || '',
                                                    allocated_hours: String(selectedJobDetails?.allocated_hours ?? ''),
                                                    status: selectedJobDetails?.status || 'in_progress'
                                                });
                                            }}
                                        >
                                            Edit Job
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {(selectedJobDetails?.technicians || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Assigned Technicians</div>
                                    <div className="space-y-2">
                                        {(selectedJobDetails.technicians || []).map((t) => (
                                            <div key={String(t?.technician_id)} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-slate-800 text-left hover:underline"
                                                    onClick={() => setSelectedJobTechnicianId(String(t?.technician_id || ''))}
                                                >
                                                    {t?.technician_name || t?.technician_id}
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                                                    title="Remove technician"
                                                    onClick={() => {
                                                        if (!window.confirm('Remove this technician from the job?')) return;
                                                        const nextTechs = (selectedJobDetails.technicians || []).filter(
                                                            (x) => String(x?.technician_id) !== String(t?.technician_id)
                                                        );
                                                        if (String(selectedJobTechnicianId) === String(t?.technician_id)) {
                                                            setSelectedJobTechnicianId('');
                                                            setTechStageAllocDraft({});
                                                        }
                                                        updateJobByNumberMutation.mutate({
                                                            jobNumber: selectedJobDetails?.job_number,
                                                            data: { technicians: nextTechs },
                                                            keepEditing: true
                                                        });
                                                    }}
                                                    disabled={updateJobByNumberMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!!selectedJobTechnicianId && (selectedJobDetails?.subtasks || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-slate-800">Technician Stages</div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedJobTechnicianId('')}
                                            className="h-8"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Allocated</TableHead>
                                                    <TableHead className="text-right">Progress</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(selectedJobDetails.subtasks || [])
                                                    .filter((st) => {
                                                        const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
                                                        return assigned.some((a) => String(a?.technician_id) === String(selectedJobTechnicianId));
                                                    })
                                                    .map((st) => {
                                                        const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
                                                        const a = assigned.find((x) => String(x?.technician_id) === String(selectedJobTechnicianId));
                                                        const alloc = Number(a?.allocated_hours || 0);
                                                        const stId = String(st?._id || st?.id);
                                                        const draftKey = `${stId}:${String(selectedJobTechnicianId)}`;
                                                        const draftValRaw = techStageAllocDraft?.[draftKey];
                                                        const draftVal = typeof draftValRaw === 'string' ? draftValRaw : '';
                                                        const prog = Array.isArray(st?.progress_by_technician)
                                                            ? st.progress_by_technician.find((p) => String(p?.technician_id) === String(selectedJobTechnicianId))
                                                            : null;
                                                        const pct = Number(prog?.progress_percentage || 0);
                                                        return (
                                                            <TableRow key={String(st?._id || st?.id)}>
                                                                <TableCell>{st?.title || '-'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {isEditingJob ? (
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <Input
                                                                                type="number"
                                                                                step="0.5"
                                                                                min="0"
                                                                                value={draftVal}
                                                                                placeholder={alloc.toFixed(1)}
                                                                                onChange={(e) => {
                                                                                    const v = e.target.value;
                                                                                    setTechStageAllocDraft((p) => ({ ...p, [draftKey]: v }));
                                                                                }}
                                                                                className="h-8 w-24 text-right"
                                                                            />
                                                                            <Button
                                                                                variant="outline"
                                                                                className="h-8"
                                                                                disabled={updateSubtaskMutation.isPending}
                                                                                onClick={() => {
                                                                                    const raw = String(techStageAllocDraft?.[draftKey] ?? '').trim();
                                                                                    if (raw === '') return;
                                                                                    const nextAlloc = Number(raw);
                                                                                    if (Number.isNaN(nextAlloc) || nextAlloc < 0) return;
                                                                                    const nextAssigned = assigned.map((x) =>
                                                                                        String(x?.technician_id) === String(selectedJobTechnicianId)
                                                                                            ? { ...x, allocated_hours: nextAlloc }
                                                                                            : x
                                                                                    );
                                                                                    updateSubtaskMutation.mutate({
                                                                                        jobNumber: selectedJobDetails?.job_number,
                                                                                        subtaskId: stId,
                                                                                        data: { assigned_technicians: nextAssigned }
                                                                                    });
                                                                                }}
                                                                            >
                                                                                Save
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        `${alloc.toFixed(1)}h`
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">{pct.toFixed(0)}%</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {isEditingJob && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Add Technician</div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Select value={jobAddTechnicianId} onValueChange={setJobAddTechnicianId}>
                                            <SelectTrigger className="h-8 sm:w-[280px]">
                                                <SelectValue placeholder="Select technician" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(technicians || [])
                                                    .filter((t) => {
                                                        const id = String(t?.id || t?._id || '');
                                                        if (!id) return false;
                                                        const already = (selectedJobDetails?.technicians || []).some((x) => String(x?.technician_id) === id);
                                                        return !already;
                                                    })
                                                    .map((t) => (
                                                        <SelectItem key={String(t?.id || t?._id)} value={String(t?.id || t?._id)}>
                                                            {t?.name || t?.technician_name || 'Technician'}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            variant="outline"
                                            className="h-8"
                                            disabled={!jobAddTechnicianId || updateJobByNumberMutation.isPending}
                                            onClick={() => {
                                                const techId = String(jobAddTechnicianId || '');
                                                if (!techId) return;
                                                const tech = (technicians || []).find((t) => String(t?.id || t?._id) === techId);
                                                const nextTechs = [
                                                    ...(selectedJobDetails?.technicians || []),
                                                    {
                                                        technician_id: techId,
                                                        technician_name: tech?.name || tech?.technician_name || ''
                                                    }
                                                ];
                                                updateJobByNumberMutation.mutate({
                                                    jobNumber: selectedJobDetails?.job_number,
                                                    data: { technicians: nextTechs },
                                                    keepEditing: true
                                                });
                                                setJobAddTechnicianId('');
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Allocated</div>
                                    <div className="font-semibold">{Number(selectedJobDetails?.allocated_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Consumed</div>
                                    <div className="font-semibold text-blue-700">{Number(selectedJobDetails?.consumed_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Remaining</div>
                                    <div className="font-semibold text-green-700">
                                        {Number(selectedJobDetails?.remaining_hours ?? (Number(selectedJobDetails?.allocated_hours || 0) - Number(selectedJobDetails?.consumed_hours || 0))).toFixed(1)}h
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Technical Complexity</div>
                                    <div className="font-semibold text-amber-700">{Number(selectedJobDetails?.technical_complexity_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Recovered</div>
                                    <div className="font-semibold text-slate-700">{Number(selectedJobDetails?.recovered_technical_complexity_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Updated Total</div>
                                    <div className="font-semibold">
                                        {(
                                            Number(selectedJobDetails?.allocated_hours || 0) +
                                            Number(selectedJobDetails?.recovered_technical_complexity_hours || 0)
                                        ).toFixed(1)}h
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const allocated = Number(selectedJobDetails?.allocated_hours || 0);
                                const consumed = Number(selectedJobDetails?.consumed_hours || 0);
                                const remaining = Number(selectedJobDetails?.remaining_hours ?? Math.max(0, allocated - consumed));
                                const totalTC = Number(selectedJobDetails?.technical_complexity_hours || 0);
                                const recovered = Number(selectedJobDetails?.recovered_technical_complexity_hours || 0);
                                const unrecovered = Math.max(0, totalTC - recovered);
                                const canRecover = remaining <= 1e-9 && unrecovered > 1e-9;

                                if (!canRecover) return null;
                                return (
                                    <div className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-4">
                                        <div className="text-sm text-amber-900">
                                            <div className="font-semibold">Recover Technical Complexity Hours</div>
                                            <div className="text-amber-800">Adds {unrecovered.toFixed(1)}h back to allocated job hours.</div>
                                        </div>
                                        <Button
                                            onClick={() => recoverTechnicalComplexityMutation.mutate(selectedJobDetails?.job_number)}
                                            disabled={recoverTechnicalComplexityMutation.isPending}
                                            className="bg-amber-500 hover:bg-amber-600 text-white"
                                        >
                                            {recoverTechnicalComplexityMutation.isPending ? 'Recovering...' : 'Recover Hours'}
                                        </Button>
                                    </div>
                                );
                            })()}

                            {(selectedJobDetails?.subtasks || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Stages (Remaining Hours)</div>
                                    <div className="overflow-x-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Allocated</TableHead>
                                                    <TableHead className="text-right">Logged</TableHead>
                                                    <TableHead className="text-right">Remaining</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(selectedJobDetails.subtasks || []).map((st) => {
                                                    const allocatedHrs = Number(st?.allocated_hours || 0);
                                                    const consumedHrs = Number(st?.consumed_hours || 0);
                                                    const remainingHrs = Number(
                                                        typeof st?.remaining_hours !== 'undefined' && st?.remaining_hours !== null
                                                            ? st.remaining_hours
                                                            : Math.max(0, allocatedHrs - consumedHrs)
                                                    );
                                                    const label = `${st?.category ? `${st.category}: ` : ''}${st?.title || ''}`.trim() || '-';
                                                    return (
                                                        <TableRow key={String(st?._id || st?.id || label)}>
                                                            <TableCell className="min-w-[220px]">{label}</TableCell>
                                                            <TableCell className="text-right">{allocatedHrs.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-blue-700">{consumedHrs.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right font-semibold text-green-700">{remainingHrs.toFixed(1)}h</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Remaining is calculated as stage allocated hours minus booked hours on that stage.
                                    </div>
                                </div>
                            )}

                            {selectedJobDetails?.status === 'at_risk' && (
                                <div className="rounded border border-amber-200 bg-amber-50 p-4">
                                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                                        <AlertTriangle className="w-4 h-4" />
                                        At Risk Reason
                                    </div>
                                    <div className="mt-2 text-sm text-amber-900">
                                        {selectedJobDetails?.risk_reason
                                            ? String(selectedJobDetails.risk_reason).replace(/_/g, ' ')
                                            : 'at risk'}
                                    </div>
                                    {!!String(selectedJobDetails?.risk_reason_details || '').trim() && (
                                        <div className="mt-1 text-sm text-amber-800">
                                            {selectedJobDetails.risk_reason_details}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="font-semibold text-slate-800">Issues</div>
                                {selectedJobIssues.length === 0 ? (
                                    <div className="text-sm text-slate-500">No issues reported for this job.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedJobIssues.map((r) => (
                                            <div key={r.id || r._id} className="rounded border border-red-200 bg-red-50 p-3">
                                                <div className="text-sm font-semibold text-red-800">
                                                    {String(r.bottleneck_category || 'issue').replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-sm text-red-700">{r.bottleneck_description || ''}</div>
                                                <div className="text-xs text-red-600 mt-1">
                                                    {r.date ? parseISO(r.date).toLocaleDateString() : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="font-semibold text-slate-800">Technician Logged Work</div>
                                {selectedJobWorkLogs.length === 0 ? (
                                    <div className="text-sm text-slate-500">No job time logs found.</div>
                                ) : (
                                    <div className="overflow-x-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Hours</TableHead>
                                                    <TableHead className="text-right">OT</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedJobWorkLogs
                                                    .slice()
                                                    .sort((a, b) => String(b.log_date || '').localeCompare(String(a.log_date || '')))
                                                    .map((l) => {
                                                        const techName = l.technician_name || technicianNameById[String(l.technician_id)] || l.technician_id;
                                                        const stageTitle = getSubtaskTitle(l.subtask_id) || l.subtask_id || '-';
                                                        return (
                                                            <TableRow key={l.id}>
                                                                <TableCell>{l.log_date ? parseISO(l.log_date).toLocaleDateString() : '-'}</TableCell>
                                                                <TableCell>{techName}</TableCell>
                                                                <TableCell>{stageTitle}</TableCell>
                                                                <TableCell className="text-right">{Number(l.hours_logged || 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right">{Number(l.overtime_hours || 0).toFixed(1)}h</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                <div className="text-xs text-slate-500">
                                    Job logs show what was done per stage (subtask) and hours logged.
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <div className="mt-8 bg-slate-800/60 backdrop-blur rounded-xl p-6 border border-slate-700">
                    <h3 className="font-semibold text-yellow-400 mb-3">Hour Calculation Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <h4 className="font-medium text-white mb-2">HR Hours (Payroll)</h4>
                            <ul className="space-y-1 text-slate-400">
                                <li>• Monday-Thursday = 8 hours</li>
                                <li>• Friday = 7 hours</li>
                                <li>• Includes 1 paid lunch hour</li>
                                <li>• Used for attendance & payroll only</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-white mb-2">Productive Hours (Jobs)</h4>
                            <ul className="space-y-1 text-slate-400">
                                <li>• Monday-Thursday = 7 hours/day</li>
                                <li>• Friday = 6 hours/day</li>
                                <li>• Excludes lunch</li>
                                <li>• Used for job progress & efficiency</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <footer className="mt-8 text-center text-slate-500 text-sm">
                    <p>© {new Date().getFullYear()} Epiroc Workshop Management System</p>
                </footer>
            </main>
        </div>
    );
}