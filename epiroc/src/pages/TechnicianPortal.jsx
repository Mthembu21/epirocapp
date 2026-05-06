import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  parseISO,
  getDay,
  isSameDay,
  addDays,
  isAfter,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

/* ✅ SAFE shadcn imports (FILE-LEVEL, not directory) */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

/* Icons */
import {
  Wrench,
  Clock,
  Save,
  LogOut,
  Calendar,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

const IDLE_JOB_ID = 'IDLE / NON-PRODUCTIVE'; // FINAL VERSION - Force cache clear - 2026-05-06-12:05

export default function TechnicianPortal() {
  // FINAL FORCE CACHE CLEAR - 2026-05-06-12:05:30 - COMPLETE REWRITE v4.0
  const queryClient = useQueryClient();

  /* ===================== STATE ===================== */
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    job_id: "",
    subtask_id: "",
    hours_logged: "",
    category: "",
    category_detail: "",
  });

  const [reportData, setReportData] = useState({
    work_completed: "",
    has_bottleneck: false,
    bottleneck_category: "",
    bottleneck_description: "",
    bottleneck_time_lost_hours: "",
  });

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editEntryDraft, setEditEntryDraft] = useState({
    hours_logged: "",
    category: "",
    category_detail: "",
  });

  /* ===================== AUTH ===================== */
  useEffect(() => {
    const validateSession = async () => {
      const stored = localStorage.getItem("epiroc_user");
      if (!stored) {
        window.location.href = createPageUrl("WorkshopLogin");
        return;
      }

      const parsed = JSON.parse(stored);
      try {
        await base44.auth.me();
        setUser(parsed);
      } catch {
        try {
          await base44.auth.technicianLogin(
            parsed.name,
            parsed.employee_id
          );
          setUser(parsed);
        } catch {
          localStorage.removeItem("epiroc_user");
          window.location.href = createPageUrl("WorkshopLogin");
        }
      }
    };
    validateSession();
  }, []);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch {}
    localStorage.removeItem("epiroc_user");
    window.location.href = createPageUrl("WorkshopLogin");
  };

  /* ===================== DATA ===================== */
  const { data: myJobs = [] } = useQuery({
    queryKey: ["myJobs", user?.id],
    enabled: !!user?.id,
    queryFn: () => {
      console.log('🔥 DEPLOYMENT VERSION v4.0 - Using user.id:', user?.id);
      return base44.entities.Job.filter({
        assigned_technician_id: user.id,
      });
    },
    refetchInterval: 30000,
  });

  // Also fetch cross-supervisor assignments
  const { data: myCrossSupervisorJobs = [] } = useQuery({
    queryKey: ["myCrossSupervisorJobs", user?.id],
    queryFn: () => base44.entities.Job.filter({ assigned_technician_id: user.id, include_cross_supervisor: true }),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Combine both job lists
  const allMyJobs = useMemo(() => {
    return [...(myJobs || []), ...(myCrossSupervisorJobs || [])];
  }, [myJobs, myCrossSupervisorJobs, user?.id]);

  const { data: myEntries = [] } = useQuery({
    queryKey: ["myTimeEntries", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.DailyTimeEntry.filter({
        technician_id: user.id,
      }),
    refetchInterval: 30000,
  });

  /* ===================== MONTH LOGIC ===================== */
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

  const myEntriesForMonth = myEntries.filter(e => {
    if (!e?.log_date) return false;
    return isWithinInterval(parseISO(e.log_date), {
      start: monthStart,
      end: monthEnd,
    });
  });

  const totalHours = myEntriesForMonth.reduce(
    (sum, e) => sum + (e.hours_logged || 0),
    0
  );

  const totalProductiveHours = myEntriesForMonth.reduce(
    (s, e) => s + (!e.is_idle ? e.hours_logged || 0 : 0),
    0
  );

  const totalNonProductiveHours = myEntriesForMonth.reduce(
    (s, e) => s + (e.is_idle ? e.hours_logged || 0 : 0),
    0
  );

  /* ===================== MUTATIONS ===================== */
  const createEntryMutation = useMutation({
    mutationFn: payload =>
      base44.entities.DailyTimeEntry.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myTimeEntries"] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setFormData(prev => ({
        ...prev,
        job_id: "",
        subtask_id: "",
        hours_logged: "",
        category: "",
        category_detail: "",
        end_date: "",
      }));
    },
    onError: err =>
      setError(err?.message || "Failed to submit entry"),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError("");

    if (!formData.job_id || !formData.hours_logged) {
      setError("Please complete all required fields");
      return;
    }

    createEntryMutation.mutate({
      timeLog: {
        technician_id: user.id,
        job_id: formData.job_id,
        subtask_id:
          formData.job_id === IDLE_JOB_ID
            ? null
            : formData.subtask_id,
        hours_logged: Number(formData.hours_logged),
        log_date: formData.date,
        is_idle: formData.job_id === IDLE_JOB_ID,
        category: formData.category,
        category_detail: formData.category_detail,
      },
      report: null,
    });
  };

  if (!user) return null;

  /* ===================== UI (COMPLETE REWRITE) ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* HEADER */}
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
                  <p className="text-xs text-slate-400">{user.employee_id || user.id}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* MONTH SELECTOR */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4" />
            Viewing month
          </div>
          <Input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-44"
          />
        </div>

        {/* DASHBOARD CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              <p className="text-2xl font-bold">{(myEntriesForMonth.reduce((sum, e) => sum + (e.overtime_hours || 0), 0)).toFixed(1)}h</p>
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

        {/* TABS */}
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

          {/* LOG HOURS TAB */}
          <TabsContent value="log">
            <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Log Daily Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="border-slate-300"
                      />
                    </div>
                    <div>
                      <Label>Job</Label>
                      <Select
                        value={formData.job_id}
                        onValueChange={value => setFormData(prev => ({ ...prev, job_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                        <SelectContent>
                          {allMyJobs.map(job => (
                            <SelectItem key={job.id} value={job.job_number}>
                              {job.job_number}
                            </SelectItem>
                          ))}
                          <SelectItem value={IDLE_JOB_ID}>
                            {IDLE_JOB_ID}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="0.0"
                        value={formData.hours_logged}
                        onChange={e => setFormData(prev => ({ ...prev, hours_logged: e.target.value }))}
                        className="border-slate-300"
                      />
                    </div>
                  </div>

                  {/* Category selection for IDLE entries */}
                  {formData.job_id === IDLE_JOB_ID && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={value => setFormData(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Leave">Leave</SelectItem>
                            <SelectItem value="Sick">Sick</SelectItem>
                            <SelectItem value="Training">Training</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.category === 'Other' && (
                        <div>
                          <Label>Details</Label>
                          <Input
                            placeholder="Specify other category"
                            value={formData.category_detail}
                            onChange={e => setFormData(prev => ({ ...prev, category_detail: e.target.value }))}
                            className="border-slate-300"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={createEntryMutation.isPending}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createEntryMutation.isPending ? "Saving..." : "Submit Hours"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MY JOBS TAB */}
          <TabsContent value="jobs">
            <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Briefcase className="w-5 h-5 text-yellow-500" />
                  My Jobs ({allMyJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {allMyJobs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No active jobs</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {allMyJobs.map(job => (
                      <div key={job.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{job.job_number}</p>
                            <p className="text-sm text-slate-600">{job.description}</p>
                          </div>
                          <Badge className={
                            job.status === 'at_risk' ? 'bg-red-100 text-red-700' :
                            job.status === 'over_allocated' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {job.status?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="mb-2">
                          <Progress value={job.progress_percentage || 0} className="h-2" />
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>{(job.progress_percentage || 0).toFixed(0)}% complete</span>
                            <span>{(job.remaining_hours || 0).toFixed(1)}h remaining</span>
                          </div>
                        </div>
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
                            <p className="font-medium text-green-600">{(job.remaining_hours || 0).toFixed(1)}h</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORY TAB */}
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead>Date</TableHead>
                          <TableHead>Job</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Normal</TableHead>
                          <TableHead className="text-right">OT</TableHead>
                          <TableHead className="text-right">Payable</TableHead>
                          <TableHead className="text-right">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myEntriesForMonth.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {entry.log_date ? format(parseISO(entry.log_date), 'dd MMM yyyy') : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{entry.job_id}</TableCell>
                            <TableCell>
                              {entry.is_idle ? (
                                <Badge variant="secondary">{entry.category || 'IDLE'}</Badge>
                              ) : (
                                <span className="text-sm text-slate-700">
                                  {(() => {
                                    const job = (allMyJobs || []).find(j => String(j.job_number) === String(entry.job_id));
                                    const st = (job?.subtasks || []).find(s => String(s?._id || s?.id) === String(entry.subtask_id));
                                    return st?.category || st?.title || entry.subtask_title || '-';
                                  })()}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(entry.normal_hours || entry.hours_logged || 0).toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right font-semibold text-yellow-600">
                              {(entry.overtime_hours || 0).toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-800">
                              {(entry.payable_hours || entry.hours_logged || 0).toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.is_idle ? (
                                <Badge variant="outline">Idle</Badge>
                              ) : (
                                <Badge>Productive</Badge>
                              )}
                            </TableCell>
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
