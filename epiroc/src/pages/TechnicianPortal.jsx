import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

/* ===== shadcn/ui imports (SAFE) ===== */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

/* ===== icons ===== */
import {
  Wrench,
  Clock,
  Save,
  LogOut,
  Calendar,
  Briefcase,
} from "lucide-react";

const IDLE_JOB_ID = "IDLE / NON-PRODUCTIVE";

export default function TechnicianPortal() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    job_id: "",
    hours_logged: "",
  });

  /* ===== AUTH ===== */
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

  /* ===== DATA ===== */
  const { data: myJobs = [] } = useQuery({
    queryKey: ["myJobs", user?.id],
    enabled: !!user?.id,
    queryFn: () =>
      base44.entities.Job.filter({
        assigned_technician_id: user.id,
      }),
  });

  const createEntryMutation = useMutation({
    mutationFn: payload =>
      base44.entities.DailyTimeEntry.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        job_id: "",
        hours_logged: "",
      });
    },
    onError: e => setError(e?.message || "Failed to submit hours"),
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
        hours_logged: Number(formData.hours_logged),
        log_date: formData.date,
        is_idle: formData.job_id === IDLE_JOB_ID,
      },
      report: null,
    });
  };

  if (!user) return null;

  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur border-b border-yellow-500/20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-lg">
              <Wrench className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-yellow-400">
                EPIROC
              </h1>
              <p className="text-xs text-slate-400">
                Technician Portal
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white"
          >
            <LogOut />
          </Button>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* MONTH SELECT */}
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Today</span>
        </div>

        {/* TABS */}
        <Tabs defaultValue="log" className="space-y-6">
          <TabsList className="bg-slate-700/50 border border-slate-600">
            <TabsTrigger value="log" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-900">
              <Clock className="w-4 h-4 mr-2" />
              Log Hours
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-900">
              <Briefcase className="w-4 h-4 mr-2" />
              My Jobs
            </TabsTrigger>
          </TabsList>

          {/* LOG TAB */}
          <TabsContent value="log">
            <Card className="border-0 shadow-xl bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Clock className="text-yellow-500 w-5 h-5" />
                  Log Daily Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded">
                    {error}
                  </div>
                )}

                <form
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  onSubmit={handleSubmit}
                >
                  <div className="space-y-2">
                    <Label>Date</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label>Job</Label>
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
                        {myJobs.map(job => (
                          <SelectItem
                            key={job.id}
                            value={job.job_number}
                          >
                            {job.job_number}
                          </SelectItem>
                        ))}
                        <SelectItem value={IDLE_JOB_ID}>
                          {IDLE_JOB_ID}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Hours</Label>
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
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="submit"
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold"
                      disabled={createEntryMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Entry
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JOBS TAB */}
          <TabsContent value="jobs">
            <Card className="border-0 shadow-xl bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-slate-800">
                  My Assigned Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myJobs.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    No jobs assigned
                  </p>
                ) : (
                  myJobs.map(job => (
                    <div
                      key={job.id}
                      className="p-3 border rounded-lg bg-slate-50"
                    >
                      <p className="font-semibold text-slate-800">
                        {job.job_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.description}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}