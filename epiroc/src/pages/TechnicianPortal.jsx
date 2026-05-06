import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  parseISO,
  getDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

/* ===================== UI IMPORTS (SAFE) ===================== */
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ===================== ICONS ===================== */
import {
  Wrench,
  Clock,
  Save,
  LogOut,
  Calendar,
  Briefcase,
  AlertTriangle,
} from "lucide-react";

/* ===================== CONSTANTS ===================== */
const IDLE_JOB_ID = "IDLE / NON-PRODUCTIVE";

/* ===================== COMPONENT ===================== */
export default function TechnicianPortal() {
  const queryClient = useQueryClient();

  /* ===================== STATE ===================== */
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    job_id: "",
    subtask_id: "",
    hours_logged: "",
    category: "",
    category_detail: "",
  });

  /* ===================== AUTH ===================== */
  useEffect(() => {
    const init = async () => {
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
        localStorage.removeItem("epiroc_user");
        window.location.href = createPageUrl("WorkshopLogin");
      }
    };
    init();
  }, []);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch {}
    localStorage.removeItem("epiroc_user");
    window.location.href = createPageUrl("WorkshopLogin");
  };

  /* ===================== QUERIES ===================== */
  const { data: myJobs = [] } = useQuery({
    queryKey: ["myJobs", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.Job.filter({
        assigned_technician_id: user.id,
      }),
  });

  const { data: myEntries = [] } = useQuery({
    queryKey: ["myEntries", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.DailyTimeEntry.filter({
        technician_id: user.id,
      }),
  });

  /* ===================== DERIVED ===================== */
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

  const entriesForMonth = myEntries.filter(e =>
    e?.log_date &&
    isWithinInterval(parseISO(e.log_date), {
      start: monthStart,
      end: monthEnd,
    })
  );

  const totalHours = entriesForMonth.reduce(
    (sum, e) => sum + (e.hours_logged || 0),
    0
  );

  const productiveHours = entriesForMonth.reduce(
    (s, e) => s + (e.is_idle ? 0 : e.hours_logged || 0),
    0
  );

  const idleHours = entriesForMonth.reduce(
    (s, e) => s + (e.is_idle ? e.hours_logged || 0 : 0),
    0
  );

  const selectedDateEntries = myEntries.filter(
    e => e.log_date && isSameDay(parseISO(e.log_date), parseISO(formData.date))
  );

  const dailyTotal = selectedDateEntries.reduce(
    (s, e) => s + (e.hours_logged || 0),
    0
  );

  /* ===================== MUTATION ===================== */
  const createEntryMutation = useMutation({
    mutationFn: payload =>
      base44.entities.DailyTimeEntry.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEntries"] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setFormData(prev => ({
        ...prev,
        job_id: "",
        subtask_id: "",
        hours_logged: "",
        category: "",
        category_detail: "",
      }));
    },
    onError: e => setError(e?.message || "Failed to save entry"),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError("");

    if (!formData.job_id || !formData.hours_logged) {
      setError("Please complete all fields");
      return;
    }

    createEntryMutation.mutate({
      timeLog: {
        technician_id: user.id,
        job_id: formData.job_id,
        subtask_id:
          formData.job_id === IDLE_JOB_ID ? null : formData.subtask_id,
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

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur border-b border-yellow-500/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-lg">
              <Wrench className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-yellow-400 font-bold">EPIROC</h1>
              <p className="text-xs text-slate-400">Technician Portal</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut />
          </Button>
        </div>
      </header>

      {/* ===================== MAIN ===================== */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ===================== DASHBOARD ===================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-80">Total Hours</p>
              <p className="text-2xl font-bold">
                {totalHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-80">Productive</p>
              <p className="text-2xl font-bold">
                {productiveHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-80">Idle</p>
              <p className="text-2xl font-bold">
                {idleHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-slate-900">
            <CardContent className="p-4">
              <p className="text-sm">Today</p>
              <p className="text-2xl font-bold">
                {dailyTotal.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ===================== TABS ===================== */}
        <Tabs defaultValue="log">
          <TabsList className="bg-slate-700/60">
            <TabsTrigger value="log">
              <Clock className="w-4 h-4 mr-2" />
              Log
            </TabsTrigger>
            <TabsTrigger value="history">
              <Calendar className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Briefcase className="w-4 h-4 mr-2" />
              Jobs
            </TabsTrigger>
          </TabsList>

          {/* ===================== LOG ===================== */}
          <TabsContent value="log">
            <Card className="bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle>Log Hours</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="text-red-600 mb-4">
                    {error}
                  </div>
                )}
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={e =>
                      setFormData(p => ({
                        ...p,
                        date: e.target.value,
                      }))
                    }
                  />

                  <Select
                    value={formData.job_id}
                    onValueChange={v =>
                      setFormData(p => ({ ...p, job_id: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Job" />
                    </SelectTrigger>
                    <SelectContent>
                      {myJobs.map(j => (
                        <SelectItem
                          key={j.id}
                          value={j.job_number}
                        >
                          {j.job_number}
                        </SelectItem>
                      ))}
                      <SelectItem value={IDLE_JOB_ID}>
                        {IDLE_JOB_ID}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="0.25"
                    placeholder="Hours"
                    value={formData.hours_logged}
                    onChange={e =>
                      setFormData(p => ({
                        ...p,
                        hours_logged: e.target.value,
                      }))
                    }
                  />

                  <Button
                    type="submit"
                    className="bg-yellow-400 text-slate-900"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== HISTORY ===================== */}
          <TabsContent value="history">
            <Card className="bg-white/95">
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesForMonth.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {format(parseISO(e.log_date), "dd MMM")}
                        </TableCell>
                        <TableCell>{e.job_id}</TableCell>
                        <TableCell>
                          {e.hours_logged.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          {e.is_idle ? (
                            <Badge>Idle</Badge>
                          ) : (
                            <Badge variant="secondary">
                              Job
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== JOBS ===================== */}
          <TabsContent value="jobs">
            <Card className="bg-white/95">
              <CardHeader>
                <CardTitle>My Jobs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myJobs.map(j => (
                  <div
                    key={j.id}
                    className="border p-3 rounded-lg"
                  >
                    <p className="font-semibold">
                      {j.job_number}
                    </p>
                    <Progress
                      value={j.progress_percentage || 0}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}