import React, { useState, useEffect, useMemo } from 'react';
import epirocLogo from '../assets/epirocLogo.png';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, getDay, isSameDay, addDays, isAfter, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
import { Wrench, Clock, Save, LogOut, Calendar, Briefcase, AlertTriangle, CheckCircle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { createPageUrl } from '@/utils';
import JobPauseResumeForm from '@/components/downtime/JobPauseResumeForm.jsx';
import TechnicianKPIHeader from '@/components/kpi/TechnicianKPIHeader.jsx';
import AlertsList from '@/components/alerts/AlertsList.jsx';
import { normalizeKpis } from '@/utils/normalizeKpis';



const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const IDLE_JOB_ID = 'IDLE / NON-PRODUCTIVE';

const bottleneckCategories = [
    { value: 'waiting_for_parts', label: 'Waiting for Parts' },
    { value: 'equipment_failure', label: 'Equipment Failure' },
    { value: 'technical_complexity', label: 'Technical Complexity' },
    { value: 'external_dependency', label: 'External Dependency' },
    { value: 'other', label: 'Other' }
]; // DEBUGGING DEPLOYMENT - Check console for technician ID and job filtering - 2026-05-06-15:00

export default function TechnicianPortal() {
    const [user, setUser] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
        job_id: '',
        subtask_id: '',
        hours_logged: '',
        category: '',
        // Use category_detail as the technician-provided note/description for Training + Other
        category_detail: ''
    });

    const [reportData, setReportData] = useState({
        work_completed: '',
        has_bottleneck: false,
        bottleneck_category: '',
        bottleneck_description: '',
        bottleneck_time_lost_hours: ''
    });

  const [editingEntryId, setEditingEntryId] = useState(null);

  // Downtime (pause/resume) - UI wired; backend wiring pending
  const [isPaused, setIsPaused] = useState(false);
  const [downtimeLogDraft, setDowntimeLogDraft] = useState({
    category: '',
    duration_hours: '',
    note: ''
  });
  const [isDowntimeLogging, setIsDowntimeLogging] = useState(false);
  
  // Job-specific pause/resume tracking
  const [pausedJobs, setPausedJobs] = useState({}); // { jobId: { pause_reason, duration_hours, paused_at, ... } }
  const [isPauseJobLoading, setIsPauseJobLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Restore paused-job state from the backend so it survives page refreshes
  useEffect(() => {
    if (!user?.supervisor_key || !user?.id) return;
    base44.entities.Downtime.getActivePauses(user.supervisor_key, user.id)
      .then(result => {
        if (result?.data && Object.keys(result.data).length > 0) {
          setPausedJobs(result.data);
        }
      })
      .catch(err => console.error('Failed to load active pauses:', err));
  }, [user?.supervisor_key, user?.id]);

    const [editEntryDraft, setEditEntryDraft] = useState({ hours_logged: '', category: '', category_detail: '' });
    const queryClient = useQueryClient();

    const updateEntryMutation = useMutation({
        mutationFn: ({ id, timeLog }) => base44.entities.DailyTimeEntry.update(id, { timeLog }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            queryClient.invalidateQueries({ queryKey: ['technicianKPIs'] });
            setEditingEntryId(null);
            setEditEntryDraft({ hours_logged: '', category: '', category_detail: '' });
        }
    });

    const deleteEntryMutation = useMutation({
        mutationFn: (id) => base44.entities.DailyTimeEntry.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            queryClient.invalidateQueries({ queryKey: ['technicianKPIs'] });
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

    // Get the correct technician ID (MongoDB ObjectId for job assignments)
    const getTechnicianId = () => {
        // Jobs use MongoDB ObjectId for technician assignments, not employee_id
        const techId = user?.id; // Use MongoDB ObjectId
        console.log('🔍 User object:', { 
            id: user?.id, 
            employee_id: user?.employee_id, 
            employeeNumber: user?.employeeNumber,
            name: user?.name,
            type: user?.type 
        });
        console.log('🔍 Using technician ID (MongoDB ObjectId):', techId);
        console.log('🔍 Checking all possible ID formats:', {
            'user.id (MongoDB)': user?.id,
            'user.employee_id': user?.employee_id,
            'user.employeeNumber': user?.employeeNumber,
            'final techId': techId
        });
        return techId;
    };

    const { data: myJobs = [] } = useQuery({

        queryKey: ['myJobs', getTechnicianId()],
        queryFn: async () => {
            const techId = getTechnicianId();
            console.log('🔍 Technician ID for job lookup:', techId);
            
            try {
                // Try the cross-supervisor endpoint first to get all assigned jobs (including from other supervisors)
                const result = await base44.entities.Job.filter({ assigned_technician_id: techId, include_cross_supervisor: true });
                console.log('✅ Cross-supervisor endpoint success, jobs found:', result?.length || 0);
                result.forEach(job => {
                    console.log(`  - Job: ${job.job_number} (${job.description})`);
                });
                return result;
            } catch (error) {
                console.log('❌ Cross-supervisor endpoint failed:', error.message);
                
                // Fallback: Get all jobs and filter for this technician's assignments
                const allJobs = await base44.entities.Job.list();
                console.log('📋 Total jobs in system for filtering:', allJobs?.length || 0);
                
                // Extract all technician IDs used in jobs for debugging
                const allTechnicianIdsInJobs = new Set();
                const technicianSamples = [];
                
                allJobs.forEach(job => {
                    const assignments = job?.technicians || [];
                    assignments.forEach(tech => {
                        if (tech.technician_id) {
                            allTechnicianIdsInJobs.add(String(tech.technician_id));
                            if (technicianSamples.length < 10) {
                                technicianSamples.push({
                                    technician_id: tech.technician_id,
                                    technician_name: tech.technician_name,
                                    job_number: job.job_number
                                });
                            }
                        }
                    });
                });
                
                console.log('🔍 All technician IDs found in jobs:', Array.from(allTechnicianIdsInJobs));
                console.log('📝 Sample technician assignments:', technicianSamples);
                console.log(`🎯 Looking for technician ID: "${techId}"`);
                console.log(`🔍 Exact match check: Does "${techId}" exist in job IDs?`, Array.from(allTechnicianIdsInJobs).includes(String(techId)));
                
                const filteredJobs = allJobs.filter(job => {
                    const assignments = job?.technicians || [];
                    const isAssigned = assignments.some(tech => 
                        String(tech.technician_id) === String(techId)
                    );
                    return isAssigned;
                });
                
                console.log('🎯 Filtered jobs for technician:', filteredJobs?.length || 0);
                filteredJobs.forEach(job => {
                    console.log(`  - Job: ${job.job_number} (${job.description})`);
                });
                
                return filteredJobs;
            }
        },
        enabled: !!getTechnicianId(),
        staleTime: 0,
        refetchInterval: 30000
    });

    // All jobs (including cross-supervisor assignments) are now handled in the single query above
    const allMyJobs = useMemo(() => {
        return myJobs || [];
    }, [myJobs]);

    const { data: myEntries = [] } = useQuery({
        queryKey: ['myTimeEntries', getTechnicianId()],
        queryFn: async () => {
            try {
                return await base44.entities.DailyTimeEntry.filter({ technician_id: getTechnicianId() });
            } catch (error) {
                // Fallback: Get all time entries and filter client-side
                const allEntries = await base44.entities.DailyTimeEntry.list();
                const techId = getTechnicianId();
                return allEntries.filter(entry => 
                    String(entry.technician_id) === String(techId)
                );
            }
        },
        enabled: !!getTechnicianId(),
        staleTime: 0,
        refetchInterval: 30000
    });

    const { data: idleInfo } = useQuery({

        queryKey: ['idleCategories'],
        queryFn: () => base44.entities.DailyTimeEntry.idleCategories(),
        enabled: !!getTechnicianId()
    });

    const manualCompleteStageMutation = useMutation({
        mutationFn: async ({ jobNumber, subtaskId }) => {
            return base44.entities.Job.subtasks.complete(jobNumber, subtaskId, { technician_id: getTechnicianId() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            // Re-fetch time entries — completing a stage may change job status and
            // affects which entries the technician can still edit.
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
        },
        onError: (e) => {
            alert(e?.message || 'Failed to mark stage complete');
        }
    });

    const getMyAssignment = (job) => {
        const assignments = job?.technicians || [];
        return assignments.find(t => String(t.technician_id) === String(getTechnicianId())) || null;
    };

    const hasIncompleteAssignedWork = (job) => {
        const subtasks = Array.isArray(job?.subtasks) ? job.subtasks : [];
        for (const st of subtasks) {
            const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
            const isAssignedToMe = assigned.some((a) => String(a?.technician_id) === String(getTechnicianId()));
            if (!isAssignedToMe) continue;

            const myProgress = (st?.progress_by_technician || []).find((p) => String(p?.technician_id) === String(getTechnicianId()));
            const pct = Number(myProgress?.progress_percentage || 0);
            const completed = Boolean(myProgress?.completed) || pct >= 100 - 1e-9;
            if (!completed) return true;
        }
        return false;
    };

    const pendingJobs = myJobs.filter(j => {
        const mine = getMyAssignment(j);
        return !!mine && !mine.confirmed_by_technician && j.status !== 'completed' && hasIncompleteAssignedWork(j);
    });
    const activeJobs = myJobs.filter(j => {
        const mine = getMyAssignment(j);
        return !!mine && mine.confirmed_by_technician && j.status !== 'completed' && hasIncompleteAssignedWork(j);
    });

    const confirmJobMutation = useMutation({
        mutationFn: (jobNumber) => {
            if (!jobNumber) {
                throw new Error('Missing job number for confirmation');
            }
            return base44.entities.Job.confirmByJobNumber(jobNumber, getTechnicianId());
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myJobs'] }),
        onError: (e) => {
            alert(e?.message || 'Could not accept job');
        }
    });

    const createEntryMutation = useMutation({
        mutationFn: async (data) => {
            const batch = Array.isArray(data?.batch) ? data.batch : null;
            if (batch && batch.length) {
                let last = null;
                for (const item of batch) {
                    // Send timeEntry and report together — backend handles
                    // job report creation, bottleneck tracking, and job hour updates
                    last = await base44.entities.DailyTimeEntry.create({
                        timeLog: item.timeLog,
                        report: item.report || null
                    });
                }
                return last;
            }

            const entry = await base44.entities.DailyTimeEntry.create({
                timeLog: data.timeLog,
                report: data.report || null
            });
            return entry;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myTimeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['myJobs'] });
            queryClient.invalidateQueries({ queryKey: ['technicianKPIs'] });
            setFormData(prev => ({ ...prev, job_id: '', subtask_id: '', hours_logged: '', category: '', category_detail: '', end_date: '' }));
            setReportData({
                work_completed: '',
                has_bottleneck: false,
                bottleneck_category: '',
                bottleneck_description: '',
                bottleneck_time_lost_hours: ''
            });
        }
    });

    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

    // Technician KPI fetch (drives KPI header + loading state)
    // const {
    //     data: kpiResponse,
    //     isLoading: kpiLoading,
    // } = useQuery({
    //     queryKey: ['technicianKPIs', user?.supervisor_key, selectedMonth],
    //     queryFn: async () => {
            
    //         return await base44.entities.KPI.getDashboardOverview(
    //             user.supervisor_key,
    //             {
    //                 start_date: format(monthStart, 'yyyy-MM-dd'),
    //                 end_date: format(monthEnd, 'yyyy-MM-dd'),
    //                   technician_id: getTechnicianId() //
    //             }
    //         );
    //     },
    //     enabled: !!user?.supervisor_key,
    //     staleTime: 0,
    //     refetchInterval: 30000,
    // });
    const {
  data: kpiResponse,
  isLoading: kpiLoading,
} = useQuery({
  queryKey: ['technicianKPIs', user?.supervisor_key, selectedMonth],
  queryFn: async () => {
    const filters = {
      start_date: format(monthStart, 'yyyy-MM-dd'),
      end_date: format(monthEnd, 'yyyy-MM-dd'),
      technician_id: getTechnicianId()
    };
    console.log('🔍 KPI REQUEST:', {
      supervisor: user.supervisor_key,
      filters
    });
    const response = await base44.entities.KPI.dashboardOverview(
      user.supervisor_key,
      filters
    );
    console.log('✅ KPI RESPONSE:', response);
    return response;
  },
  enabled: !!user?.supervisor_key && !!getTechnicianId(),
});

    // Centralized normalization — single call replaces all manual unwrapping.
    // Fields missing in the response become null (not 0) so the UI shows "N/A".
    const utilizationOverview = normalizeKpis(kpiResponse);

    const myEntriesForMonth = myEntries.filter((e) => {
        if (!e?.log_date) return false;
        const d = parseISO(e.log_date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    const selectedDateObj = formData.date ? parseISO(formData.date) : null;
    const entriesForDate = selectedDateObj
        ? myEntriesForMonth.filter(entry => entry?.log_date && isSameDay(parseISO(entry.log_date), selectedDateObj))
        : [];
    const totalLoggedHoursForDate = entriesForDate.reduce((sum, e) => sum + (Number(e.hours_logged) || 0), 0);
    const totalOvertimeForDate = entriesForDate.reduce((sum, e) => sum + (Number(e.overtime_hours) || 0), 0);

    const requiredNormalForDay = selectedDateObj
        ? (getDay(selectedDateObj) === 5 ? 6 : 7.5)
        : 7.5;

    const belowRequiredNormalForDay = totalLoggedHoursForDate > 0 && totalLoggedHoursForDate < requiredNormalForDay;

    const selectedJob = allMyJobs.find(j => j.job_number === formData.job_id);
    const selectedJobRemainingHours = Number(
        selectedJob?.remaining_hours ?? (Number(selectedJob?.allocated_hours || 0) - Number(selectedJob?.consumed_hours || 0))
    );
    const isIdleSelected = formData.job_id === IDLE_JOB_ID;
    const isIdleCategorySelected = isIdleSelected && formData.category === 'Idle';
    const isOtherIdleSelected = isIdleSelected && formData.category === 'Other'; // legacy backward-compat
    const isLeaveSelected = isIdleSelected && String(formData.category || '').trim().toLowerCase() === 'leave';
    const isSickSelected = isIdleSelected && String(formData.category || '').trim().toLowerCase() === 'sick';
    const isMultiDayLeave = isLeaveSelected || isSickSelected;

    const getAssignedSubtasksForJob = (job) => {
        const subtasks = job?.subtasks || [];
        return subtasks.filter((st) => {
            const assigned = st?.assigned_technicians || [];
            return assigned.some((a) => String(a?.technician_id) === String(getTechnicianId()));
        });
    };

    const assignedSubtasksRaw = (!isIdleSelected && selectedJob) ? getAssignedSubtasksForJob(selectedJob) : [];
    const assignedSubtasks = assignedSubtasksRaw.filter((st) => {
        const myProgress = (st?.progress_by_technician || []).find((p) => String(p?.technician_id) === String(getTechnicianId()));
        const pct = Number(myProgress?.progress_percentage || 0);
        const completed = Boolean(myProgress?.completed) || pct >= 100 - 1e-9;
        return !completed;
    });
    const getSubtaskKey = (st) => String(st?._id || st?.id || '');
    const selectedSubtask = assignedSubtasks.find((st) => getSubtaskKey(st) === String(formData.subtask_id)) || null;
    const selectedSubtaskAssignment = selectedSubtask
        ? (selectedSubtask.assigned_technicians || []).find((a) => String(a?.technician_id) === String(getTechnicianId()))
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

        if (!isIdleSelected) {
            const hoursLogged = Number(formData.hours_logged);
            if (!hoursLogged || hoursLogged <= 0) return;
            if (totalLoggedHoursForDate + hoursLogged > 24) return;
        }

        const jobNumber = isIdleSelected ? IDLE_JOB_ID : (selectedJob?.job_number || '');
        if (!jobNumber) return;

        if (!isIdleSelected && !formData.subtask_id) return;
        if (isIdleSelected && !formData.category) return;

        // Require sub_reason when Idle category is selected
        if (isIdleSelected && formData.category === 'Idle' && !String(formData.category_detail || '').trim()) {
            alert('Please select a reason for idle time');
            return;
        }
        // Require note when Training
        if (isIdleSelected && formData.category === 'Training') {
            if (!String(formData.category_detail || '').trim()) {
                alert('Training Note is required');
                return;
            }
        }


        if (isMultiDayLeave) {
            const start = parseISO(formData.date);
            const end = String(formData.end_date || '').trim()
                ? parseISO(formData.end_date)
                : start;
            if (isAfter(start, end)) {
                alert('End date must be on or after start date');
                return;
            }

            const batch = [];
            for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
                const day = getDay(d);
                // Skip weekends for leave/sick entries
                if (day === 0 || day === 6) continue;

                const hours = day === 5 ? 7 : 8;
                batch.push({
                    timeLog: {
                        technician_id: getTechnicianId(),
                        job_id: IDLE_JOB_ID,
                        subtask_id: null,
                        hours_logged: hours,
                        log_date: format(d, 'yyyy-MM-dd'),
                        is_idle: true,
                        category: formData.category,
                        category_detail: formData.category_detail || '',
                        // Mark as leave to prevent overtime calculation
                        is_leave: true,
                        // Ensure entry goes to approval system
                        approval_status: 'pending',
                        approved_hours: null,
                        approved_by: null,
                        approved_at: null
                    },
                    report: null
                });
            }

            if (!batch.length) return;
            createEntryMutation.mutate({ batch });
            return;
        }

        const hoursLogged = Number(formData.hours_logged);
        const timeLog = {
            technician_id: getTechnicianId(),
            job_id: jobNumber,
            subtask_id: isIdleSelected ? null : formData.subtask_id,
            hours_logged: hoursLogged,
            log_date: formData.date,
            is_idle: isIdleSelected,
            category: isIdleSelected ? formData.category : null,
            category_detail: isIdleSelected ? (formData.category_detail || '') : '',
            // Ensure entry goes to approval system
            approval_status: 'pending',
            approved_hours: null,
            approved_by: null,
            approved_at: null
        };

        const shouldSendReport =
            !isIdleSelected &&
            (String(reportData.work_completed || '').trim() || reportData.has_bottleneck);

        const report = shouldSendReport ? {
            job_id: jobNumber,
            job_number: jobNumber,
            technician_id: getTechnicianId(),
            technician_name: user.name,
            date: formData.date,
            work_completed: String(reportData.work_completed || ''),
            has_bottleneck: reportData.has_bottleneck,
            bottleneck_category: reportData.has_bottleneck ? reportData.bottleneck_category : null,
            bottleneck_description: reportData.has_bottleneck ? reportData.bottleneck_description : null,
            bottleneck_time_lost_hours: reportData.has_bottleneck && reportData.bottleneck_category === 'technical_complexity'
                ? Number(reportData.bottleneck_time_lost_hours)
                : 0
        } : null;

        if (report?.has_bottleneck) {
            const cat = String(reportData.bottleneck_category || '').trim();
            const desc = String(reportData.bottleneck_description || '').trim();
            if (!cat) {
                alert('Please select a bottleneck category.');
                return;
            }
            if (!desc) {
                alert('Please enter a bottleneck description.');
                return;
            }
        }

        if (report?.has_bottleneck && report?.bottleneck_category === 'technical_complexity') {
            const timeLost = Number(reportData.bottleneck_time_lost_hours);
            if (Number.isNaN(timeLost) || timeLost <= 0) {
                alert('Please enter time lost due to technical complexity (hours) greater than 0.');
                return;
            }
        }

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
            const detail = String(entry.category_detail || '').trim();
            if (base === 'Idle' && detail) {
                return `Idle – ${detail}`;
            }
            if (base === 'Other' && detail) {
                return `Other: ${detail}`;
            }
            return base;
        }

        const job = (allMyJobs || []).find((j) => String(j.job_number) === String(entry.job_id));
        const st = (job?.subtasks || []).find((s) => String(s?._id || s?.id) === String(entry.subtask_id));
        return st?.category || st?.title || entry.subtask_title || '-';
    };

    const totalHours = myEntriesForMonth.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    const totalOvertimeHours = myEntriesForMonth.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const totalProductiveHours = myEntriesForMonth.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const totalNonProductiveHours = myEntriesForMonth.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);

    if (!user) return null;

    // utilizationOverview is already normalized by normalizeKpis().
    // Fields are null (not 0) for missing values so TechnicianKPIHeader shows "N/A".
    const safeMetrics = utilizationOverview;
    console.log('[KPI TRACE] TechnicianPortal — safeMetrics state:', safeMetrics);




    const downtimeCategoryOptions = [
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'waiting_for_parts', label: 'Waiting for Parts' },
      { value: 'equipment_failure', label: 'Equipment Failure' },
      { value: 'technical_complexity', label: 'Technical Complexity' },
      { value: 'other', label: 'Other' },
    ];

    const handlePause = () => setIsPaused(true);
    const handleResume = () => setIsPaused(false);

    const handleLogDowntime = async () => {
      // Wire UI to backend pause-resume routes.
      // NOTE: backend expects { technician_id, reason, description }.
      // UI uses: logDraft.category, logDraft.duration_hours, logDraft.note.
      try {
        setIsDowntimeLogging(true);

        const supervisorKey = user?.supervisor_key;
        if (!supervisorKey) {
          alert('Missing supervisor key for downtime logging');
          return;
        }

        // Use selected job for downtime context.
        // If technician is logging downtime while no real job is selected, disable.
        const jobId = formData?.job_id && formData.job_id !== IDLE_JOB_ID ? formData.job_id : null;
        if (!jobId) {
          alert('Select a real job to pause/resume');
          return;
        }

        const reason = downtimeLogDraft.category;
        const description = downtimeLogDraft.note || '';
        if (!reason) {
          alert('Select a downtime category');
          return;
        }

        await base44.entities.Downtime.pauseJob(supervisorKey, jobId, {
          technician_id: getTechnicianId(),
          reason,
          description
        });

        setIsPaused(false);
        setDowntimeLogDraft({ category: '', duration_hours: '', note: '' });

      } catch (e) {
        alert(e?.message || 'Failed to save downtime');
      } finally {
        setIsDowntimeLogging(false);
      }
    };

    const handlePauseJob = async (pauseData) => {
      setIsPauseJobLoading(true);
      try {
        const supervisorKey = user?.supervisor_key;
        if (!supervisorKey) throw new Error('Missing supervisor key');

        await base44.entities.Downtime.pauseJob(supervisorKey, pauseData.job_id, {
          technician_id: getTechnicianId(),
          pause_reason: pauseData.pause_reason,
          description: pauseData.description,
        });

        setPausedJobs(prev => ({
          ...prev,
          [pauseData.job_id]: pauseData
        }));

        queryClient.invalidateQueries({ queryKey: ['myJobs'] });
        // Alert is shown by JobPauseResumeForm — don't duplicate it here
      } catch (error) {
        console.error('Error pausing job:', error);
        throw error; // let JobPauseResumeForm's catch block show the alert
      } finally {
        setIsPauseJobLoading(false);
      }
    };

    const handleResumeJob = async (resumeData) => {
      setIsPauseJobLoading(true);
      try {
        const supervisorKey = user?.supervisor_key;
        if (!supervisorKey) throw new Error('Missing supervisor key');

        await base44.entities.Downtime.resumeJob(supervisorKey, resumeData.job_id, {
          technician_id: getTechnicianId(),
        });

        setPausedJobs(prev => {
          const updated = { ...prev };
          delete updated[resumeData.job_id];
          return updated;
        });

        queryClient.invalidateQueries({ queryKey: ['myJobs'] });
        // Alert is shown by JobPauseResumeForm — don't duplicate it here
      } catch (error) {
        console.error('Error resuming job:', error);
        throw error; // let JobPauseResumeForm's catch block show the alert
      } finally {
        setIsPauseJobLoading(false);
      }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                            <div className="p-1 rounded-xl bg-yellow-400/20 backdrop-blur">
                                <img
                                    src={epirocLogo}
                                    alt="Epiroc"
                                    className="h-10 w-10 object-contain"
                                />
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
                {/* KPI Header - Performance Metrics */}
                <div className="mb-8">
                    <TechnicianKPIHeader
                        metricsData={safeMetrics}
                        hasData={safeMetrics?.hasData ?? null}
                        isLoading={kpiLoading}
                        selectedDate={format(new Date(formData.date), 'MMM dd, yyyy')}
                    />
                </div>





                {allMyJobs.length > 0 && (
                    <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500 mb-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-green-700 text-lg">
                                <CheckCircle className="w-5 h-5" />
                                Active Job Assignments ({allMyJobs.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {allMyJobs.filter(job => {
                                    const mine = getMyAssignment(job);
                                    return !!mine && !mine.confirmed_by_technician && job.status !== 'completed' && hasIncompleteAssignedWork(job);
                                }).map(job => (
                                    <div key={job.id} className="bg-white rounded-lg p-4 shadow-sm border border-amber-200">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-800">{job.job_number}</p>
                                                <p className="text-sm text-slate-600">{job.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-amber-100 text-amber-700">
                                                    Pending Acceptance
                                                </Badge>
                                                <Button 
                                                    onClick={() => confirmJobMutation.mutate(job.job_number)}
                                                    className="bg-green-500 hover:bg-green-600 text-white"
                                                    disabled={confirmJobMutation.isPending}
                                                    size="sm"
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Accept
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mb-2">
                                            <Progress value={job.aggregated_progress_percentage ?? job.progress_percentage ?? 0} className="h-2" />
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>{(job.aggregated_progress_percentage ?? job.progress_percentage ?? 0).toFixed(0)}% complete</span>
                                                <span>{(job.remaining_hours ?? (job.allocated_hours - job.consumed_hours) ?? 0).toFixed(1)}h remaining</span>
                                            </div>
                                        </div>

                                        {(job.subtasks || []).length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-sm font-medium text-slate-700">Your Assigned Tasks</p>
                                                <div className="space-y-2">
                                                    {(job.subtasks || []).map((st) => {
                                                        const subtaskId = st.id || st._id;

                                                        const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
                                                        const myAssignedRow = assigned.find((a) => String(a?.technician_id) === String(getTechnicianId())) || null;
                                                        if (!myAssignedRow) return null;

                                                        const myProgressObj = (st.progress_by_technician || []).find(p => String(p.technician_id) === String(getTechnicianId())) || null;
                                                        const myProgress = Number(myProgressObj?.progress_percentage || 0);
                                                        const isStageCompleted = Boolean(myProgressObj?.completed) || myProgress >= 100 - 1e-9;
                                                        if (isStageCompleted) return null;

                                                        const stageAllocated = Number(
                                                            typeof myAssignedRow?.allocated_hours !== 'undefined' && myAssignedRow?.allocated_hours !== null
                                                                ? myAssignedRow.allocated_hours
                                                                : (st.allocated_hours || 0)
                                                        );
                                                        const stageConsumed = Number(st.consumed_hours || 0);
                                                        const stageRemaining = Number(
                                                            typeof st.remaining_hours !== 'undefined' && st.remaining_hours !== null
                                                                ? st.remaining_hours
                                                                : Math.max(0, stageAllocated - stageConsumed)
                                                        );

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

                                                                <div className="mt-2 flex justify-between text-xs text-slate-500">
                                                                    <span>Allocated: {stageAllocated.toFixed(1)}h</span>
                                                                    <span>Remaining: {stageRemaining.toFixed(1)}h</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}



                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Viewing month
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => {
                                const next = e.target.value;
                                if (!next) return;
                                setSelectedMonth(next);

                                const todayMonth = format(new Date(), 'yyyy-MM');
                                const nextDate = next === todayMonth
                                    ? format(new Date(), 'yyyy-MM-dd')
                                    : `${next}-01`;
                                setFormData((prev) => ({ ...prev, date: nextDate, end_date: '' }));
                            }}
                            className="w-44 bg-white"
                        />
                    </div>
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
                        <div className="space-y-6">
                            {/* Unified Job Pause/Resume Form */}
                            <JobPauseResumeForm
                                activeJobs={activeJobs}
                                pausedJobs={pausedJobs}
                                onPauseJob={handlePauseJob}
                                onResumeJob={handleResumeJob}
                                isLoading={isPauseJobLoading}
                            />
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
                                                onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value, subtask_id: '', category: '', category_detail: '', end_date: '' }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select job" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {activeJobs.map((job) => (
                                                        <SelectItem key={job.id} value={job.job_number}>
                                                            {job.job_number}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value={IDLE_JOB_ID}>{IDLE_JOB_ID}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {isIdleSelected && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Category</Label>
                                                <Select
                                                    value={formData.category}
                                                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value, category_detail: '', end_date: '' }))}
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
                                            </div>
                                            {/* Sub-reason dropdown for Idle */}
                                            {isIdleCategorySelected && (
                                                <div className="space-y-2">
                                                    <Label>Reason *</Label>
                                                    <Select
                                                        value={formData.category_detail}
                                                        onValueChange={(value) => setFormData(prev => ({ ...prev, category_detail: value }))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select reason" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(idleInfo?.idle_sub_reasons || ['Housekeeping', 'Waiting', 'No Work', 'Other']).map((r) => (
                                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {/* Notes textbox for Training */}
                                            {isIdleSelected && formData.category === 'Training' && (
                                                <div className="space-y-2">
                                                    <Label>Training Note (specific details) *</Label>
                                                    <Textarea
                                                        value={formData.category_detail}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, category_detail: e.target.value }))}
                                                        placeholder="What training did you complete? Which topics/practices did you cover?"
                                                        className="h-24 border-slate-300"
                                                    />
                                                </div>
                                            )}
                                            {/* Legacy Other free text */}
                                            {isOtherIdleSelected && (
                                                <div className="space-y-2">
                                                    <Label>Other (describe)</Label>
                                                    <Textarea
                                                        value={formData.category_detail}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, category_detail: e.target.value }))}
                                                        placeholder="Describe other non-productive work..."
                                                        className="h-24 border-slate-300"
                                                    />
                                                </div>
                                            )}


                                            {isMultiDayLeave && (
                                                <div className="space-y-2">
                                                    <Label>End date</Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.end_date}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                                        className="border-slate-300"
                                                    />
                                                    <p className="text-xs text-slate-500">Weekdays only. Hours are auto-calculated (8h Mon–Thu, 7h Fri).</p>
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
                                                    <div className="flex justify-between">
                                                        <span>Stage remaining</span>
                                                        <span className="font-semibold text-slate-800">{Number(selectedSubtask?.remaining_hours || 0).toFixed(1)}h</span>
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
                                                disabled={isMultiDayLeave}
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

                                                        {reportData.bottleneck_category === 'technical_complexity' && (
                                                            <div className="space-y-2">
                                                                <Label>Time lost (hours)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.1"
                                                                    placeholder="e.g. 1.5"
                                                                    value={reportData.bottleneck_time_lost_hours}
                                                                    onChange={(e) => setReportData(prev => ({ ...prev, bottleneck_time_lost_hours: e.target.value }))}
                                                                    className="border-slate-300"
                                                                />
                                                            </div>
                                                        )}
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
                                            (!isMultiDayLeave && !formData.hours_logged) ||
                                            (!isIdleSelected && selectedJob && !formData.subtask_id) ||
                                            (isIdleSelected && !formData.category) ||
                                            ((isIdleSelected && (formData.category === 'Idle' || formData.category === 'Training')) && !String(formData.category_detail || '').trim()) ||
                                            (!isMultiDayLeave && (totalLoggedHoursForDate + Number(formData.hours_logged || 0) > 24))
                                        }

                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {createEntryMutation.isPending ? 'Saving...' : 'Submit Hours'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                        </div>
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
                                                        <span>{(job.remaining_hours ?? (job.allocated_hours - job.consumed_hours) ?? 0).toFixed(1)}h remaining</span>
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
                                {myEntriesForMonth.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No entries yet</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-100 sticky top-0 z-10">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Job</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Holiday</TableHead>
                                                    <TableHead className="text-right">Multiplier</TableHead>
                                                    <TableHead className="text-right">Hours</TableHead>
                                                    <TableHead className="text-right">Normal</TableHead>
                                                    <TableHead className="text-right">OT</TableHead>
                                                    <TableHead className="text-right">Payable</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {myEntriesForMonth.map((entry) => {
                                                    const isEditing = editingEntryId === entry.id;
                                                    const isIdle = !!entry.is_idle;
                                                    const editCat = isEditing ? editEntryDraft.category : entry.category;
                                                    const showIdleSubReason = isIdle && editCat === 'Idle';
                                                    const showOtherDetail = isIdle && (editEntryDraft.category === 'Other' || entry.category === 'Other');
                                                    const multiplier = Number(entry.overtime_multiplier || 1);
                                                    const payable = Number(entry.payable_hours || (Number(entry.hours_logged || 0) * multiplier));

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
                                                                            {showIdleSubReason && (
                                                                                <Select
                                                                                    value={String(editEntryDraft.category_detail ?? '')}
                                                                                    onValueChange={(v) => setEditEntryDraft(prev => ({ ...prev, category_detail: v }))}
                                                                                >
                                                                                    <SelectTrigger className="h-8">
                                                                                        <SelectValue placeholder="Reason" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {(idleInfo?.idle_sub_reasons || ['Housekeeping', 'Waiting', 'No Work', 'Other']).map(r => (
                                                                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            )}
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
                                                        <TableCell>
                                                            {entry.is_public_holiday ? (
                                                                <span className="text-xs font-semibold text-amber-700">
                                                                    {entry.public_holiday_name || 'Public Holiday'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-700">
                                                            {multiplier.toFixed(1)}×
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
                                                        <TableCell className="text-right font-semibold text-slate-800">{payable.toFixed(1)}h</TableCell>
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

