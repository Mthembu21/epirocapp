import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, getDay } from 'date-fns';
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
import { Wrench, Clock, Save, Calculator, LogOut, Calendar, Briefcase, AlertTriangle, CheckCircle2, CheckSquare } from 'lucide-react';
import { createPageUrl } from '@/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Get hours based on day of week
const getHoursForDay = (dayIndex) => {
    if (dayIndex === 5) { // Friday
        return { hr: 7, productive: 6 };
    }
    // Monday-Thursday (and weekend for reference)
    return { hr: 8, productive: 7 };
};

const LUNCH_BREAK_HOURS = 1;

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
        start_time: '08:00',
        end_time: '17:00',
        notes: ''
    });

    const [subtaskDraftProgress, setSubtaskDraftProgress] = useState({});
    const [reportData, setReportData] = useState({
        work_completed: '',
        has_bottleneck: false,
        bottleneck_category: '',
        bottleneck_description: ''
    });
    const [calculations, setCalculations] = useState({
        dayOfWeek: '',
        totalWorkedHours: 0,
        hrHours: 0,
        productiveHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        overtimeRate: 1.5,
        weightedOvertime: 0
    });

    const queryClient = useQueryClient();

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

    const calculateHours = () => {
        if (!formData.date) return;
        const dayIndex = getDay(parseISO(formData.date));
        const dayName = DAYS[dayIndex];
        const { hr, productive } = getHoursForDay(dayIndex);

        const [startH, startM] = formData.start_time.split(':').map(Number);
        const [endH, endM] = formData.end_time.split(':').map(Number);

        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts

        const totalWorked = Math.round((totalMinutes / 60) * 100) / 100;
        const hrHours = Math.min(totalWorked, hr);
        const productiveHours = Math.max(0, Math.min(hrHours - LUNCH_BREAK_HOURS, productive));

        const overtimeHours = Math.max(0, totalWorked - hr);
        const overtimeRate = dayIndex === 0 ? 2 : 1.5;

        setCalculations({
            dayOfWeek: dayName,
            totalWorkedHours: totalWorked,
            hrHours: Math.round(hrHours * 100) / 100,
            productiveHours: Math.round(productiveHours * 100) / 100,
            normalHours: Math.round(hrHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            overtimeRate,
            weightedOvertime: Math.round(overtimeHours * overtimeRate * 100) / 100
        });
    };

    useEffect(() => {
        calculateHours();
    }, [formData.date, formData.start_time, formData.end_time]);

    const { data: myJobs = [] } = useQuery({
        queryKey: ['myJobs', user?.id],
        queryFn: () => base44.entities.Job.filter({ assigned_technician_id: user.id }),
        enabled: !!user?.id
    });

    const { data: myEntries = [] } = useQuery({
        queryKey: ['myTimeEntries', user?.id],
        queryFn: () => base44.entities.DailyTimeEntry.filter({ technician_id: user.id }, '-date', 50),
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

    const completeJobMutation = useMutation({
        mutationFn: (jobId) => {
            const job = myJobs.find(j => j.id === jobId);
            return base44.entities.Job.update(jobId, {
                status: 'completed',
                total_hours_utilized: job.consumed_hours || 0,
                actual_completion_date: new Date().toISOString().split('T')[0],
                progress_percentage: 100
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myJobs'] })
    });

    const createEntryMutation = useMutation({
        mutationFn: async (data) => {
            // Send timeEntry and report together — backend handles
            // job report creation, bottleneck tracking, and job hour updates
            const entry = await base44.entities.DailyTimeEntry.create({
                timeEntry: data.timeEntry,
                report: data.report || null
            });
            return entry;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            setFormData(prev => ({ ...prev, notes: '', job_id: '' }));
            setReportData({
                work_completed: '',
                has_bottleneck: false,
                bottleneck_category: '',
                bottleneck_description: ''
            });
        }
    });



    // Calculate total productive hours logged for the selected date
    const entriesForDate = myEntries.filter(entry => entry.date === formData.date);
    const totalProductiveHoursForDate = entriesForDate.reduce((sum, e) => sum + (e.productive_hours || 0), 0);
    const selectedDayIndex = formData.date ? getDay(parseISO(formData.date)) : 1;
    const maxProductiveForDay = getHoursForDay(selectedDayIndex).productive;
    const remainingProductiveHoursForDay = Math.max(0, maxProductiveForDay - totalProductiveHoursForDate);
    const hasMaxedOutDay = remainingProductiveHoursForDay <= 0;

    const selectedJob = myJobs.find(j => j.id === formData.job_id);
    const exceedsJobHours = selectedJob && (selectedJob.remaining_hours || 0) < calculations.productiveHours;
    
    // Check if this job already has an entry for today
    const hasEntryForJobOnDate = myEntries.some(
        entry => entry.date === formData.date && entry.job_number === selectedJob?.job_number
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!user || !formData.job_id) return;
        if (hasMaxedOutDay) return;
        if (hasEntryForJobOnDate) return;

        const job = myJobs.find(j => j.id === formData.job_id);
        
        // Limit productive hours to remaining hours for the day
        const actualProductiveHours = Math.min(
            calculations.productiveHours,
            calculations.totalWorkedHours,
            remainingProductiveHoursForDay
        );

        const timeEntry = {
            technician_id: user.id,
            technician_name: user.name,
            date: formData.date,
            day_of_week: calculations.dayOfWeek,
            job_id: job?.job_number || '',
            job_number: job?.job_number || '',
            hr_hours: entriesForDate.length === 0 ? calculations.hrHours : 0, // HR hours only on first entry of day
            productive_hours: actualProductiveHours,
            start_time: formData.start_time,
            end_time: formData.end_time,
            overtime_hours: entriesForDate.length === 0 ? calculations.overtimeHours : 0,
            overtime_rate: calculations.overtimeRate,
            weighted_overtime: entriesForDate.length === 0 ? calculations.weightedOvertime : 0,
            notes: formData.notes
        };

        const report = reportData.work_completed ? {
            job_id: job?.job_number || '',
            job_number: job?.job_number || '',
            technician_id: user.id,
            technician_name: user.name,
            date: formData.date,
            work_completed: reportData.work_completed,
            has_bottleneck: reportData.has_bottleneck,
            bottleneck_category: reportData.has_bottleneck ? reportData.bottleneck_category : null,
            bottleneck_description: reportData.has_bottleneck ? reportData.bottleneck_description : null
        } : null;

        createEntryMutation.mutate({ timeEntry, report });
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

    const totalHRHours = myEntries.reduce((sum, e) => sum + (e.hr_hours || 0), 0);
    const totalProductiveHours = myEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0);
    const totalWeightedOT = myEntries.reduce((sum, e) => sum + (e.weighted_overtime || 0), 0);

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

                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600">
                        <CardContent className="p-4 text-white">
                            <p className="text-sm text-white/80">HR Hours</p>
                            <p className="text-2xl font-bold">{totalHRHours.toFixed(1)}h</p>
                            <p className="text-xs text-white/60">For payroll</p>
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
                            <p className="text-sm text-slate-700">Weighted OT</p>
                            <p className="text-2xl font-bold">{totalWeightedOT.toFixed(1)}h</p>
                            <p className="text-xs text-slate-600">Overtime</p>
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
                                {activeJobs.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No active jobs assigned</p>
                                        <p className="text-sm">Accept a job first to log hours</p>
                                    </div>
                                ) : (
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
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select job" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {activeJobs.map(job => (
                                                            <SelectItem key={job.id} value={job.id}>
                                                                {job.job_number} - {(job.remaining_hours || job.allocated_hours).toFixed(1)}h remaining
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.start_time}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                                    className="border-slate-300"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Time</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.end_time}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                                    className="border-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Calculator className="w-4 h-4 text-yellow-400" />
                                                <span className="font-medium text-white text-sm">Calculated Hours</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-sm">
                                                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                                    <p className="text-slate-400 text-xs">Day</p>
                                                    <p className="font-semibold text-white text-sm">{calculations.dayOfWeek?.slice(0,3) || '-'}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                                    <p className="text-slate-400 text-xs">HR Hours</p>
                                                    <p className="font-semibold text-blue-400 text-sm">{calculations.hrHours}h</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                                    <p className="text-slate-400 text-xs">Productive</p>
                                                    <p className="font-semibold text-green-400 text-sm">{calculations.productiveHours}h</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                                    <p className="text-slate-400 text-xs">OT ({calculations.overtimeRate}x)</p>
                                                    <p className="font-semibold text-yellow-400 text-sm">{calculations.weightedOvertime}h</p>
                                                </div>
                                            </div>
                                        </div>

                                        {exceedsJobHours && (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <AlertTriangle className="w-4 h-4" />
                                                Job has only {selectedJob?.remaining_hours?.toFixed(1)}h remaining. Supervisor approval required.
                                            </div>
                                        )}

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

                                        <div className="space-y-2">
                                            <Label>Notes (Optional)</Label>
                                            <Textarea
                                                placeholder="Any additional notes..."
                                                value={formData.notes}
                                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                                className="h-16 border-slate-300"
                                            />
                                        </div>

                                        {/* Remaining hours indicator */}
                                        {entriesForDate.length > 0 && (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-blue-700">
                                                        <Clock className="w-4 h-4 inline mr-1" />
                                                        Entries today: {entriesForDate.length}
                                                    </span>
                                                    <span className="text-sm font-semibold text-blue-800">
                                                        {remainingProductiveHoursForDay.toFixed(1)}h remaining
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {hasMaxedOutDay && (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <Calendar className="w-4 h-4" />
                                                You have reached the maximum productive hours ({maxProductiveForDay}h) for this date.
                                            </div>
                                        )}

                                        {hasEntryForJobOnDate && !hasMaxedOutDay && (
                                            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <Briefcase className="w-4 h-4" />
                                                You already logged hours for this job today. Select a different job.
                                            </div>
                                        )}

                                        <Button 
                                            type="submit" 
                                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold"
                                            disabled={createEntryMutation.isPending || hasMaxedOutDay || hasEntryForJobOnDate || !formData.job_id}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {createEntryMutation.isPending ? 'Saving...' : 'Submit Hours'}
                                        </Button>
                                    </form>
                                )}
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
                                                       {job.consumed_hours > 0 && (
                                                           <Button
                                                               size="sm"
                                                               onClick={() => completeJobMutation.mutate(job.id)}
                                                               disabled={completeJobMutation.isPending}
                                                               className="bg-green-500 hover:bg-green-600 text-white h-8"
                                                           >
                                                               <CheckSquare className="w-4 h-4 mr-1" />
                                                               Complete
                                                           </Button>
                                                       )}
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
                                                                const draftKey = `${job.job_number}:${subtaskId}`;
                                                                const draftValue = subtaskDraftProgress[draftKey];
                                                                const shownValue = typeof draftValue === 'number' ? draftValue : myProgress;
                                                                return (
                                                                    <div key={subtaskId} className="bg-slate-50 rounded p-3">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-semibold text-slate-800 truncate">{st.title}</p>
                                                                                <p className="text-xs text-slate-500">My progress: {Number(myProgress).toFixed(0)}%</p>
                                                                            </div>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                max="100"
                                                                                step="1"
                                                                                value={shownValue}
                                                                                onChange={(e) => {
                                                                                    const next = Number(e.target.value);
                                                                                    setSubtaskDraftProgress(prev => ({ ...prev, [draftKey]: next }));
                                                                                }}
                                                                                onBlur={() => {
                                                                                    const next = subtaskDraftProgress[draftKey];
                                                                                    if (typeof next !== 'number') return;
                                                                                    base44.entities.Job.subtasks.setProgress(job.job_number, subtaskId, {
                                                                                        technician_id: user.id,
                                                                                        progress_percentage: next
                                                                                    }).then(() => {
                                                                                        queryClient.invalidateQueries({ queryKey: ['myJobs'] });
                                                                                    }).catch(() => {}).finally(() => {
                                                                                        setSubtaskDraftProgress(prev => {
                                                                                            const copy = { ...prev };
                                                                                            delete copy[draftKey];
                                                                                            return copy;
                                                                                        });
                                                                                    });
                                                                                }}
                                                                                className="w-24"
                                                                            />
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
                                                    <TableHead className="text-right">HR Hrs</TableHead>
                                                    <TableHead className="text-right">Prod Hrs</TableHead>
                                                    <TableHead className="text-right">OT</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {myEntries.map((entry) => (
                                                    <TableRow key={entry.id}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{entry.date ? format(parseISO(entry.date), 'dd MMM') : '-'}</p>
                                                                <Badge variant="outline" className={getDayBadgeColor(entry.day_of_week)}>
                                                                    {entry.day_of_week?.slice(0, 3)}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm">{entry.job_number}</TableCell>
                                                        <TableCell className="text-right text-blue-600">{entry.hr_hours || 0}h</TableCell>
                                                        <TableCell className="text-right text-green-600">{entry.productive_hours || 0}h</TableCell>
                                                        <TableCell className="text-right font-semibold text-yellow-600">{entry.weighted_overtime || 0}h</TableCell>
                                                    </TableRow>
                                                ))}
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