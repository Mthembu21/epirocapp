import React, {
  useState,
  useEffect,
  useMemo,
} from "react";
import { format, parseISO, getDay, isSameDay, addDays, isAfter, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Progress,
  Checkbox,
} from "@/components/ui";

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

const IDLE_JOB_ID = "IDLE / NON-PRODUCTIVE";

const bottleneckCategories = [
  { value: "waiting_for_parts", label: "Waiting for Parts" },
  { value: "equipment_failure", label: "Equipment Failure" },
  { value: "technical_complexity", label: "Technical Complexity" },
  { value: "external_dependency", label: "External Dependency" },
  { value: "other", label: "Other" },
];

export default function TechnicianPortal() {
  const queryClient = useQueryClient();

  /* ---------------------- STATE ---------------------- */
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

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

  /* ---------------------- AUTH ---------------------- */
  useEffect(() => {
    const loadUser = async () => {
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
          await base44.auth.technicianLogin(parsed.name, parsed.employee_id);
          setUser(parsed);
        } catch {
          localStorage.removeItem("epiroc_user");
          window.location.href = createPageUrl("WorkshopLogin");
        }
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch {}
    localStorage.removeItem("epiroc_user");
    window.location.href = createPageUrl("WorkshopLogin");
  };

  /* ---------------------- QUERIES ---------------------- */
  const { data: myJobs = [] } = useQuery({
    queryKey: ["myJobs", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.Job.filter({
        assigned_technician_id: user.id,
      }),
    refetchInterval: 30000,
  });

  const { data: myEntries = [] } = useQuery({
    queryKey: ["myEntries", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.DailyTimeEntry.filter({
        technician_id: user.id,
      }),
    refetchInterval: 30000,
  });

  const { data: idleInfo } = useQuery({
    queryKey: ["idleCategories"],
    enabled: !!user?.id,
    queryFn: () => base44.entities.DailyTimeEntry.idleCategories(),
  });

  /* ---------------------- DERIVED ---------------------- */
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

  const myEntriesForMonth = myEntries.filter(e => {
    if (!e.log_date) return false;
    return isWithinInterval(parseISO(e.log_date), {
      start: monthStart,
      end: monthEnd,
    });
  });

  const totalHours = myEntriesForMonth.reduce(
    (s, e) => s + (e.hours_logged || 0),
    0
  );

  const totalOvertimeHours = myEntriesForMonth.reduce(
    (s, e) => s + (e.overtime_hours || 0),
    0
  );

  const selectedJob = myJobs.find(j => j.job_number === formData.job_id);

  const isIdleSelected = formData.job_id === IDLE_JOB_ID;
  const isOtherIdleSelected = isIdleSelected && formData.category === "Other";
  const isLeaveSelected =
    isIdleSelected && formData.category?.toLowerCase() === "leave";
  const isSickSelected =
    isIdleSelected && formData.category?.toLowerCase() === "sick";
  const isMultiDayLeave = isLeaveSelected || isSickSelected;

  /* ---------------------- MUTATIONS ---------------------- */
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
        end_date: "",
      }));
      setReportData({
        work_completed: "",
        has_bottleneck: false,
        bottleneck_category: "",
        bottleneck_description: "",
        bottleneck_time_lost_hours: "",
      });
    },
  });

  /* ---------------------- HANDLERS ---------------------- */
  const handleSubmit = e => {
    e.preventDefault();
    setError("");

    if (!user || !formData.job_id) return;

    if (isMultiDayLeave) {
      const start = parseISO(formData.date);
      const end = formData.end_date
        ? parseISO(formData.end_date)
        : start;

      if (isAfter(start, end)) {
        setError("End date must be after start date");
        return;
      }

      for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
        const day = getDay(d);
        if (day === 0 || day === 6) continue;

        createEntryMutation.mutate({
          timeLog: {
            technician_id: user.id,
            job_id: IDLE_JOB_ID,
            hours_logged: day === 5 ? 7 : 8,
            log_date: format(d, "yyyy-MM-dd"),
            is_idle: true,
            is_leave: true,
            category: formData.category,
            category_detail: "",
          },
          report: null,
        });
      }
      return;
    }

    const hours = Number(formData.hours_logged);
    if (!hours || hours <= 0) return;

    createEntryMutation.mutate({
      timeLog: {
        technician_id: user.id,
        job_id: formData.job_id,
        subtask_id: isIdleSelected ? null : formData.subtask_id,
        hours_logged: hours,
        log_date: formData.date,
        is_idle: isIdleSelected,
        category: isIdleSelected ? formData.category : null,
        category_detail: isIdleSelected ? formData.category_detail : "",
      },
      report: null,
    });
  };

  if (!user) return null;

  /* ---------------------- UI ---------------------- */
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-yellow-500/20">
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded">
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

      <main className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">Log Hours</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>Log Time</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="text-red-500 mb-3">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                    onValueChange={value =>
                      setFormData(p => ({
                        ...p,
                        job_id: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job" />
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
                    placeholder="Hours"
                    value={formData.hours_logged}
                    onChange={e =>
                      setFormData(p => ({
                        ...p,
                        hours_logged: e.target.value,
                      }))
                    }
                    disabled={isMultiDayLeave}
                  />

                  <Button
                    type="submit"
                    disabled={createEntryMutation.isPending}
                  >
                    <Save className="mr-2" />
                    Submit
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Total hours this month: {totalHours.toFixed(1)}h</p>
                <p>Overtime: {totalOvertimeHours.toFixed(1)}h</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}