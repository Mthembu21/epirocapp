import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  parseISO,
  getDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isWithinInterval,
} from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

/* ================= UI (SAFE FILE IMPORTS) ================= */
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";

/* ================= ICONS ================= */
import {
  Wrench,
  Clock,
  Save,
  LogOut,
  Calendar,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

/* ================= CONSTANTS ================= */
const IDLE_JOB_ID = "IDLE / NON-PRODUCTIVE";

export default function TechnicianPortal() {
  const queryClient = useQueryClient();

  /* ================= STATE ================= */
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    job_id: "",
    hours_logged: "",
    category: "",
    category_detail: "",
  });

  /* ================= AUTH ================= */
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

  /* ================= DATA ================= */
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

  /* ================= DATE CALCULATIONS ================= */
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
  const allDaysInMonth = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  });

  const entriesForMonth = myEntries.filter(
    e =>
      e.log_date &&
      isWithinInterval(parseISO(e.log_date), {
        start: monthStart,
        end: monthEnd,
      })
  );

  const entriesByDate = useMemo(() => {
    const map = {};
    entriesForMonth.forEach(e => {
      map[e.log_date] = (map[e.log_date] || 0) + e.hours_logged;
    });
    return map;
  }, [entriesForMonth]);

  /* ================= DASHBOARD TOTALS ================= */
  const totalHours = entriesForMonth.reduce(
    (s, e) => s + (e.hours_logged || 0),
    0
  );

  const productiveHours = entriesForMonth.reduce(
    (s, e) => s + (!e.is_idle ? e.hours_logged || 0 : 0),
    0
  );

  const idleHours = entriesForMonth.reduce(
    (s, e) => s + (e.is_idle ? e.hours_logged || 0 : 0),
    0
  );

  /* ================= MUTATION ================= */
  const createEntryMutation = useMutation({
    mutationFn: payload =>
      base44.entities.DailyTimeEntry.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEntries"] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setFormData(p => ({
        ...p,
        job_id: "",
        hours_logged: "",
      }));
    },
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError("");

    if (!formData.job_id || !formData.hours_logged) {
      setError("Complete all fields");
      return;
    }

    createEntryMutation.mutate({
      timeLog: {
        technician_id: user.id,
        job_id: formData.job_id,
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

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-slate-800/90 border-b border-yellow-500/20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
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

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ================= MONTH NAVIGATION ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setSelectedMonth(format(subMonths(monthStart, 1), "yyyy-MM"))
              }
            >
              <ChevronLeft />
            </Button>

            <Input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-44"
            />

            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setSelectedMonth(format(addMonths(monthStart, 1), "yyyy-MM"))
              }
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setSelectedMonth(format(new Date(), "yyyy-MM"))
              }
            >
              This Month
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setSelectedMonth(format(subMonths(new Date(), 1), "yyyy-MM"))
              }
            >
              Last Month
            </Button>
          </div>
        </div>

        {/* ================= DAY HIGHLIGHT GRID ================= */}
        <Card className="bg-white/95">
          <CardHeader>
            <CardTitle className="text-slate-800">
              Monthly Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-7 gap-2 text-xs">
            {allDaysInMonth.map(d => {
              const iso = format(d, "yyyy-MM-dd");
              const hours = entriesByDate[iso] || 0;
              const isWeekend = [0, 6].includes(getDay(d));

              return (
                <div
                  key={iso}
                  className={`p-2 rounded text-center
                    ${hours > 0 ? "bg-green-100 text-green-700" : ""}
                    ${!hours && !isWeekend ? "bg-red-100 text-red-700" : ""}
                    ${isWeekend ? "bg-slate-100 text-slate-400" : ""}
                  `}
                >
                  <div>{format(d, "dd")}</div>
                  <div className="font-semibold">
                    {hours ? `${hours.toFixed(1)}h` : "-"}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ================= DASHBOARD ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-blue-500 text-white">
            <CardContent className="p-4">
              <p>Total</p>
              <p className="text-2xl font-bold">
                {totalHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-500 text-white">
            <CardContent className="p-4">
              <p>Productive</p>
              <p className="text-2xl font-bold">
                {productiveHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-500 text-white">
            <CardContent className="p-4">
              <p>Idle</p>
              <p className="text-2xl font-bold">
                {idleHours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-400 text-slate-900">
            <CardContent className="p-4">
              <p>Days Logged</p>
              <p className="text-2xl font-bold">
                {Object.keys(entriesByDate).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ================= TABS ================= */}
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card className="bg-white/95">
              <CardHeader>
                <CardTitle>Log Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-2 gap-4"
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
                        <SelectItem key={j.id} value={j.job_number}>
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
                    value={formData.hours_logged}
                    onChange={e =>
                      setFormData(p => ({
                        ...p,
                        hours_logged: e.target.value,
                      }))
                    }
                  />
                  <Button type="submit" className="bg-yellow-400">
                    <Save className="mr-2 w-4 h-4" />
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

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
                          {e.hours_logged.toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

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
                    <p className="font-semibold">{j.job_number}</p>
                    <Progress value={j.progress_percentage || 0} />
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