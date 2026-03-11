import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, getDay, isSameDay } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, Clock, Save, LogOut, Calendar, Briefcase, AlertTriangle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { createPageUrl } from '@/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const IDLE_JOB_ID = 'IDLE / NON-PRODUCTIVE';

const bottleneckCategories = [
    { value: 'waiting_for_parts', label: 'Waiting for Parts' },
    { value: 'equipment_failure', label: 'Equipment Failure' },
    { value: 'technical_complexity', label: 'Technical Complexity' },
    { value: 'external_dependency', label: 'External Dependency' },
    { value: 'other', label: 'Other' }
];

export default function TechnicianPortal() {
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        job_id: '',
        subtask_id: '',
        hours_logged: '',
        category: '',
        category_detail: ''
    });
    const [reportData, setReportData] = useState({
        work_completed: '',
        has_bottleneck: false,
        bottleneck_category: '',
        bottleneck_description: ''
    });

    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editEntryDraft, setEditEntryDraft] = useState({ hours_logged: '', category: '', category_detail: '' });
    const queryClient = useQueryClient();

    const updateEntryMutation = useMutation({
        mutationFn: ({ id, timeLog }) => base44.entities.DailyTimeEntry.update(id, { timeLog }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            setEditingEntryId(null);
            setEditEntryDraft({ hours_logged: '', category: '', category_detail: '' });
        }
    });

    const deleteEntryMutation = useMutation({
        mutationFn: (id) => base44.entities.DailyTimeEntry.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
        }
    });

    useEffect(() => {
        const validateSession = async () => {
            const storedUser = localStorage.getItem('epiroc_user');
            if (!storedUser) {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            const parsed = JSON.parse(storedUser);
            if (parsed.type !== 'technician') {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            try {
                await base44.auth.me();
                setUser(parsed);
            } catch {
                // Session expired — re-login to restore it
                try {
                    await base44.auth.technicianLogin(parsed.name, parsed.employee_id);
                    setUser(parsed);
                } catch {
                    localStorage.removeItem('epiroc_user');
                    window.location.href = createPageUrl('WorkshopLogin');
                }
            }
        };
        validateSession();
    }, []);

    const { data: myJobs = [] } = useQuery({
        queryKey: ['myJobs', user?.id],
        queryFn: () => base44.entities.Job.filter({ assigned_technician_id: user.id }),
        enabled: !!user?.id
    });

    const { data: myEntries = [] } = useQuery({
        queryKey: ['myTimeEntries', user?.id],
        queryFn: () => base44.entities.DailyTimeEntry.filter({ technician_id: user.id }),
        enabled: !!user?.id
    });

    const { data: idleInfo } = useQuery({
        queryKey: ['idleCategories'],
        queryFn: () => base44.entities.DailyTimeEntry.idleCategories(),
        enabled: !!user?.id
    });

    const getMyAssignment = (job) => {
        const assignments = job?.technicians || [];
        return assignments.find(t => String(t.technician_id) === String(user?.id)) || null;
    };

    const pendingJobs = myJobs.filter(j => {
        const mine = getMyAssignment(j);
        return !!mine && !mine.confirmed_by_technician && j.status !== 'completed';
    });
    const activeJobs = myJobs.filter(j => {
        const mine = getMyAssignment(j);
        return !!mine && mine.confirmed_by_technician && j.status !== 'completed';
    });

    const confirmJobMutation = useMutation({
        mutationFn: (jobId) => {
            const job = myJobs.find(j => j.id === jobId);
            return base44.entities.Job.confirmByJobNumber(job?.job_number, user?.id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myJobs'] })
    });

    const createEntryMutation = useMutation({
        mutationFn: async (data) => {
            // Send timeEntry and report together — backend handles
            // job report creation, bottleneck tracking, and job hour updates
            const entry = await base44.entities.DailyTimeEntry.create({
                timeLog: data.timeLog,
                report: data.report || null
            });
            return entry;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            setFormData(prev => ({ ...prev, job_id: '', subtask_id: '', hours_logged: '', category: '', category_detail: '' }));
            setReportData({
                work_completed: '',
                has_bottleneck: false,
                bottleneck_category: '',
                bottleneck_description: ''
            });
        }
    });



    const selectedDateObj = formData.date ? parseISO(formData.date) : null;
    const entriesForDate = selectedDateObj
        ? myEntries.filter(entry => entry?.log_date && isSameDay(parseISO(entry.log_date), selectedDateObj))
        : [];
    const totalLoggedHoursForDate = entriesForDate.reduce((sum, e) => sum + (Number(e.hours_logged) || 0), 0);
    const totalOvertimeForDate = entriesForDate.reduce((sum, e) => sum + (Number(e.overtime_hours) || 0), 0);

    const requiredNormalForDay = selectedDateObj
        ? (getDay(selectedDateObj) === 5 ? 7.5 : 8.5)
        : 8.5;

    const belowRequiredNormalForDay = totalLoggedHoursForDate > 0 && totalLoggedHoursForDate < requiredNormalForDay;

    const selectedJob = myJobs.find(j => j.job_number === formData.job_id);
    const selectedJobRemainingHours = Number(selectedJob?.remaining_hours || 0);
    const isIdleSelected = formData.job_id === IDLE_JOB_ID;
    const isOtherIdleSelected = isIdleSelected && formData.category === 'Other';

    const getAssignedSubtasksForJob = (job) => {
        const subtasks = job?.subtasks || [];
        return subtasks.filter((st) => {
            const assigned = st?.assigned_technicians || [];
            return assigned.some((a) => String(a?.technician_id) === String(user?.id));
        });
    };

    const assignedSubtasks = (!isIdleSelected && selectedJob) ? getAssignedSubtasksForJob(selectedJob) : [];
    const getSubtaskKey = (st) => String(st?._id || st?.id || '');
    const selectedSubtask = assignedSubtasks.find((st) => getSubtaskKey(st) === String(formData.subtask_id)) || null;
    const selectedSubtaskAssignment = selectedSubtask
        ? (selectedSubtask.assigned_technicians || []).find((a) => String(a?.technician_id) === String(user?.id))
        : null;
    const selectedSubtaskAllocatedHours = Number(selectedSubtaskAssignment?.allocated_hours || 0);

    const groupedAssignedSubtasks = assignedSubtasks.reduce((acc, st) => {
        const key = st?.category || 'Other';
        acc[key] = acc[key] || [];
        acc[key].push(st);
        return acc;
    }, {});
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!user || !formData.job_id) return;

        const hoursLogged = Number(formData.hours_logged);
        if (!hoursLogged || hoursLogged <= 0) return;
        if (totalLoggedHoursForDate + hoursLogged > 24) return;

        const jobNumber = isIdleSelected ? IDLE_JOB_ID : (selectedJob?.job_number || '');
        if (!jobNumber) return;

        if (!isIdleSelected && !formData.subtask_id) return;
        if (isIdleSelected && !formData.category) return;

        const timeLog = {
            technician_id: user.id,
            job_id: jobNumber,
            subtask_id: isIdleSelected ? null : formData.subtask_id,
            hours_logged: hoursLogged,
            log_date: formData.date,
            is_idle: isIdleSelected,
            category: isIdleSelected ? formData.category : null,
            category_detail: isIdleSelected ? (formData.category_detail || '') : ''
        };

        const report = (!isIdleSelected && reportData.work_completed) ? {
            job_id: jobNumber,
            job_number: jobNumber,
            technician_id: user.id,
            technician_name: user.name,
            date: formData.date,
            work_completed: reportData.work_completed,
            has_bottleneck: reportData.has_bottleneck,
            bottleneck_category: reportData.has_bottleneck ? reportData.bottleneck_category : null,
            bottleneck_description: reportData.has_bottleneck ? reportData.bottleneck_description : null
        } : null;

        createEntryMutation.mutate({ timeLog, report });
    };

    const handleLogout = async () => {
        try { await base44.auth.logout(); } catch {}
        localStorage.removeItem('epiroc_user');
        window.location.href = createPageUrl('WorkshopLogin');
    };

    const getDayBadgeColor = (day) => {
        switch (day) {
            case 'Sunday': return 'bg-red-100 text-red-700 border-red-200';
            case 'Saturday': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getEntryCategoryLabel = (entry) => {
        if (!entry) return '-';
        if (entry.is_idle) {
            const base = entry.category || '-';
            if (base === 'Other' && String(entry.category_detail || '').trim()) {
                return `Other: ${String(entry.category_detail).trim()}`;
            }
            return base;
        }

        const job = (myJobs || []).find((j) => String(j.job_number) === String(entry.job_id));
        const st = (job?.subtasks || []).find((s) => String(s?._id || s?.id) === String(entry.subtask_id));
        return st?.category || st?.title || entry.subtask_title || '-';
    };

    const totalHours = myEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    const totalOvertimeHours = myEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const totalProductiveHours = myEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const totalNonProductiveHours = myEntries.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-400 p-2 rounded-lg">
                                <Wrench className="w-6 h-6 text-slate-800" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-yellow-400">EPIROC</h1>
                                <p className="text-slate-400 text-xs">Technician Portal</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-white">
                                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-slate-800 font-bold text-sm">
                                    {user.name?.charAt(0)}
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-sm font-medium">{user.name}</p>
                                    <p className="text-xs text-slate-400">{user.employee_id}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {pendingJobs.length > 0 && (
                    <Card className="border-0 shadow-lg bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-l-yellow-500 mb-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-amber-700 text-lg">
                                <Briefcase className="w-5 h-5" />
                                Pending Job Assignments ({pendingJobs.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {pendingJobs.map(job => (
                                    <div key={job.id} className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">{job.job_number}</p>
                                            <p className="text-sm text-slate-600">{job.description}</p>
                                            <div className="flex gap-4 mt-2 text-sm">
                                                <span className="text-blue-600">Allocated: {job.allocated_hours}h</span>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => confirmJobMutation.mutate(job.id)}
                                            className="bg-green-500 hover:bg-green-600 text-white"
                                            disabled={confirmJobMutation.isPending}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Accept Job
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600">
                        <CardContent className="p-4 text-white">
                            <p className="text-sm text-white/80">Total Hours</p>
                            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                            <p className="text-xs text-white/60">Logged</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-green-500 to-green-600">
                        <CardContent className="p-4 text-white">
                            <p className="text-sm text-white/80">Productive Hours</p>
                            <p className="text-2xl font-bold">{totalProductiveHours.toFixed(1)}h</p>
                            <p className="text-xs text-white/60">Job hours</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-yellow-400 to-yellow-500">
                        <CardContent className="p-4 text-slate-800">
                            <p className="text-sm text-slate-700">Overtime</p>
                            <p className="text-2xl font-bold">{totalOvertimeHours.toFixed(1)}h</p>
                            <p className="text-xs text-slate-600">Overtime</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-slate-500 to-slate-600">
                        <CardContent className="p-4 text-white">
                            <p className="text-sm text-white/80">Non-Productive</p>
                            <p className="text-2xl font-bold">{totalNonProductiveHours.toFixed(1)}h</p>
                            <p className="text-xs text-white/60">IDLE hours</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="log" className="space-y-6">
                    <TabsList className="bg-slate-700/50 p-1 rounded-xl border border-slate-600">
                        <TabsTrigger value="log" className="text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800">
                            <Clock className="w-4 h-4 mr-2" />
                            Log Hours
                        </TabsTrigger>
                        <TabsTrigger value="jobs" className="text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800">
                            <Briefcase className="w-4 h-4 mr-2" />
                            My Jobs
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800">
                            <Calendar className="w-4 h-4 mr-2" />
                            History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="log">
                        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
                            <CardHeader className="pb-4 border-b border-slate-100">
                                <CardTitle className="flex items-center gap-2 text-slate-800">
                                    <Clock className="w-5 h-5 text-yellow-500" />
                                    Log Daily Hours
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                                    className="border-slate-300"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Job / Work Number</Label>
                                                <Select
                                                    value={formData.job_id}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value, subtask_id: '', category: '' }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select job" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {activeJobs
                                                            .filter(j => (Number(j.remaining_hours ?? (j.allocated_hours || 0)) || 0) > 0)
                                                            .map(job => (
                                                                <SelectItem key={job.id} value={job.job_number}>
                                                                    {job.job_number} - {(job.remaining_hours ?? (job.allocated_hours || 0)).toFixed(1)}h remaining
                                                                </SelectItem>
                                                            ))}
                                                        <SelectItem value={IDLE_JOB_ID}>{IDLE_JOB_ID}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {isIdleSelected && (
                                            <div className="space-y-2">
                                                <Label>Idle Category</Label>
                                                <Select
                                                    value={formData.category}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(idleInfo?.categories || []).map((c) => (
                                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {isOtherIdleSelected && (
                                                    <div className="space-y-2">
                                                        <Label>Other (describe)</Label>
                                                        <Input
                                                            value={formData.category_detail}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, category_detail: e.target.value }))}
                                                            className="border-slate-300"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!isIdleSelected && selectedJob && (
                                            <div className="space-y-2">
                                                <Label>Stage</Label>
                                                <Select
                                                    value={formData.subtask_id}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, subtask_id: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select stage" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(groupedAssignedSubtasks).map(([category, items]) => (
                                                            (items || []).map((st) => (
                                                                <SelectItem key={getSubtaskKey(st)} value={getSubtaskKey(st)}>
                                                                    {category}: {st.title}
                                                                </SelectItem>
                                                            ))
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {selectedSubtask && (
                                                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                                                        {selectedSubtask?.category && (
                                                            <div className="flex justify-between">
                                                                <span>Category</span>
                                                                <span className="font-semibold text-slate-800">{selectedSubtask.category}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span>Allocated for this stage</span>
                                                            <span className="font-semibold text-slate-800">{selectedSubtaskAllocatedHours.toFixed(1)}h</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Hours Logged</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.25"
                                                    value={formData.hours_logged}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, hours_logged: e.target.value }))}
                                                    className="border-slate-300"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Day Summary</Label>
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Logged today</span>
                                                        <span className="font-semibold text-slate-800">{totalLoggedHoursForDate.toFixed(1)}h</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Overtime today</span>
                                                        <span className="font-semibold text-yellow-700">{totalOvertimeForDate.toFixed(1)}h</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Required normal</span>
                                                        <span className="font-semibold text-slate-800">{requiredNormalForDay}h</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {!isIdleSelected && selectedJob && selectedJobRemainingHours > 0 && Number(formData.hours_logged || 0) > selectedJobRemainingHours && (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <AlertTriangle className="w-4 h-4" />
                                                Job has only {selectedJob?.remaining_hours?.toFixed(1)}h remaining. Supervisor approval required.
                                            </div>
                                        )}

                                        {(totalLoggedHoursForDate + Number(formData.hours_logged || 0) > 24) && (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <AlertTriangle className="w-4 h-4" />
                                                Cannot log more than 24 hours in a day.
                                            </div>
                                        )}

                                        {belowRequiredNormalForDay && (
                                            <div className="flex items-center gap-2 text-blue-700 text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                                                <Clock className="w-4 h-4" />
                                                You have logged {totalLoggedHoursForDate.toFixed(1)}h for this date. Required normal hours are {requiredNormalForDay}h.
                                            </div>
                                        )}

                                        {!isIdleSelected && (
                                        <div className="border-t pt-6">
                                            <h3 className="font-semibold text-slate-800 mb-4">Daily Job Report (Optional)</h3>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Work Completed</Label>
                                                    <Textarea
                                                        placeholder="Describe work completed today..."
                                                        value={reportData.work_completed}
                                                        onChange={(e) => setReportData(prev => ({ ...prev, work_completed: e.target.value }))}
                                                        className="h-20 border-slate-300"
                                                    />
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="bottleneck"
                                                        checked={reportData.has_bottleneck}
                                                        onCheckedChange={(checked) => setReportData(prev => ({ ...prev, has_bottleneck: checked }))}
                                                    />
                                                    <Label htmlFor="bottleneck" className="text-red-600">Report a bottleneck/challenge</Label>
                                                </div>

                                                {reportData.has_bottleneck && (
                                                    <div className="space-y-4 pl-6 border-l-2 border-red-200">
                                                        <div className="space-y-2">
                                                            <Label>Delay Reason</Label>
                                                            <Select
                                                                value={reportData.bottleneck_category}
                                                                onValueChange={(value) => setReportData(prev => ({ ...prev, bottleneck_category: value }))}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select category" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {bottleneckCategories.map(cat => (
                                                                        <SelectItem key={cat.value} value={cat.value}>
                                                                            {cat.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Description</Label>
                                                            <Textarea
                                                                placeholder="Describe the bottleneck..."
                                                                value={reportData.bottleneck_description}
                                                                onChange={(e) => setReportData(prev => ({ ...prev, bottleneck_description: e.target.value }))}
                                                                className="h-16 border-slate-300"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        )}

                                        {entriesForDate.length > 0 && (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-blue-700">
                                                        <Clock className="w-4 h-4 inline mr-1" />
                                                        Entries today: {entriesForDate.length}
                                                    </span>
                                                    <span className="text-sm font-semibold text-blue-800">
                                                        {totalLoggedHoursForDate.toFixed(1)}h logged
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {createEntryMutation.isError && (
                                            <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                                                <AlertTriangle className="w-4 h-4" />
                                                {createEntryMutation.error?.message || 'Failed to submit hours.'}
                                            </div>
                                        )}

                                        <Button 
                                            type="submit" 
                                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold"
                                            disabled={
                                                createEntryMutation.isPending ||
                                                !formData.job_id ||
                                                !formData.hours_logged ||
                                                (!isIdleSelected && selectedJob && !formData.subtask_id) ||
                                                (isIdleSelected && !formData.category) ||
                                                (isOtherIdleSelected && !String(formData.category_detail || '').trim()) ||
                                                (totalLoggedHoursForDate + Number(formData.hours_logged || 0) > 24)
                                            }
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {createEntryMutation.isPending ? 'Saving...' : 'Submit Hours'}
                                        </Button>
                                    </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="jobs">
                        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
                            <CardHeader className="pb-4 border-b border-slate-100">
                                <CardTitle className="flex items-center gap-2 text-slate-800">
                                    <Briefcase className="w-5 h-5 text-yellow-500" />
                                    My Active Jobs ({activeJobs.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {activeJobs.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No active jobs</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {activeJobs.map(job => (
                                            <div key={job.id} className="p-4">
                                               <div className="flex items-start justify-between mb-3">
                                                   <div className="flex-1">
                                                       <p className="font-semibold text-slate-800">{job.job_number}</p>
                                                       <p className="text-sm text-slate-600">{job.description}</p>
                                                   </div>
                                                   <div className="flex items-center gap-2">
                                                        <Badge className={
                                                            job.status === 'at_risk' ? 'bg-red-100 text-red-700' :
                                                            job.status === 'over_allocated' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }>
                                                            {job.status?.replace(/_/g, ' ')}
                                                        </Badge>
                                                   </div>
                                               </div>
                                                <div className="mb-2">
                                                    <Progress value={job.aggregated_progress_percentage ?? job.progress_percentage ?? 0} className="h-2" />
                                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                        <span>{(job.aggregated_progress_percentage ?? job.progress_percentage ?? 0).toFixed(0)}% complete</span>
                                                        <span>{(job.remaining_hours || job.allocated_hours).toFixed(1)}h remaining</span>
                                                    </div>
                                                </div>

                                                    {(job.subtasks || []).length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-sm font-medium text-slate-700">Subtasks</p>
                                                        <div className="space-y-2">
                                                            {(job.subtasks || []).map((st) => {
                                                                const subtaskId = st.id || st._id;
                                                                const myProgress = (st.progress_by_technician || []).find(p => String(p.technician_id) === String(user.id))?.progress_percentage || 0;
                                                                return (
                                                                    <div key={subtaskId} className="bg-slate-50 rounded p-3">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-semibold text-slate-800 truncate">{st.title}</p>
                                                                                <p className="text-xs text-slate-500">My progress: {Number(myProgress).toFixed(0)}%</p>
                                                                            </div>
                                                                            <div className="w-24 text-right text-sm font-semibold text-slate-700">
                                                                                {Number(myProgress).toFixed(0)}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    <div className="bg-slate-50 rounded p-2 text-center">
                                                        <p className="text-slate-500 text-xs">Allocated</p>
                                                        <p className="font-medium">{job.allocated_hours}h</p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded p-2 text-center">
                                                        <p className="text-slate-500 text-xs">Consumed</p>
                                                        <p className="font-medium text-blue-600">{(job.consumed_hours || 0).toFixed(1)}h</p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded p-2 text-center">
                                                        <p className="text-slate-500 text-xs">Remaining</p>
                                                        <p className="font-medium text-green-600">{(job.remaining_hours || job.allocated_hours).toFixed(1)}h</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history">
                        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
                            <CardHeader className="pb-4 border-b border-slate-100">
                                <CardTitle className="flex items-center gap-2 text-slate-800">
                                    <Calendar className="w-5 h-5 text-yellow-500" />
                                    Recent Entries
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {myEntries.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No entries yet</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-100">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Job</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Hours</TableHead>
                                                    <TableHead className="text-right">Normal</TableHead>
                                                    <TableHead className="text-right">OT</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {myEntries.map((entry) => {
                                                    const isEditing = editingEntryId === entry.id;
                                                    const isIdle = !!entry.is_idle;
                                                    const showOtherDetail = isIdle && (editEntryDraft.category === 'Other' || entry.category === 'Other');

                                                    return (
                                                    <TableRow key={entry.id}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{entry.log_date ? format(parseISO(entry.log_date), 'dd MMM') : '-'}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm">{entry.job_id}</TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <div className="space-y-2 min-w-[180px]">
                                                                    {isIdle ? (
                                                                        <>
                                                                            <Select
                                                                                value={String(editEntryDraft.category ?? '')}
                                                                                onValueChange={(value) => setEditEntryDraft(prev => ({ ...prev, category: value }))}
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
                                                                                    value={editEntryDraft.category_detail}
                                                                                    onChange={(e) => setEditEntryDraft(prev => ({ ...prev, category_detail: e.target.value }))}
                                                                                    placeholder="Other details"
                                                                                />
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-sm text-slate-700">{getEntryCategoryLabel(entry)}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                getEntryCategoryLabel(entry)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-800">
                                                            {isEditing ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.25"
                                                                    className="h-8 w-24 ml-auto text-right"
                                                                    value={editEntryDraft.hours_logged}
                                                                    onChange={(e) => setEditEntryDraft(prev => ({ ...prev, hours_logged: e.target.value }))}
                                                                />
                                                            ) : (
                                                                `${(entry.hours_logged || 0).toFixed(1)}h`
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-blue-600">{(entry.normal_hours || 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right font-semibold text-yellow-600">{(entry.overtime_hours || 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                                        onClick={() => {
                                                                            setEditingEntryId(null);
                                                                            setEditEntryDraft({ hours_logged: '', category: '', category_detail: '' });
                                                                        }}
                                                                        disabled={updateEntryMutation.isPending}
                                                                        title="Cancel"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-800"
                                                                        onClick={() => {
                                                                            const hours = Number(editEntryDraft.hours_logged);
                                                                            if (!hours || hours <= 0) return;
                                                                            updateEntryMutation.mutate({
                                                                                id: entry.id,
                                                                                timeLog: {
                                                                                    hours_logged: hours,
                                                                                    is_idle: entry.is_idle,
                                                                                    category: entry.is_idle ? editEntryDraft.category : entry.category,
                                                                                    category_detail: entry.is_idle ? editEntryDraft.category_detail : entry.category_detail,
                                                                                    subtask_id: entry.subtask_id
                                                                                }
                                                                            });
                                                                        }}
                                                                        disabled={updateEntryMutation.isPending}
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
                                                                            setEditingEntryId(entry.id);
                                                                            setEditEntryDraft({
                                                                                hours_logged: String(entry.hours_logged ?? ''),
                                                                                category: String(entry.category ?? ''),
                                                                                category_detail: String(entry.category_detail ?? '')
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
                                                                            if (!window.confirm('Delete this entry? This will update job hours.')) return;
                                                                            deleteEntryMutation.mutate(entry.id);
                                                                        }}
                                                                        disabled={deleteEntryMutation.isPending}
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
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}