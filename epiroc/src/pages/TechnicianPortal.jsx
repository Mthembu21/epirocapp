import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO, getDay, addDays, isAfter } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/apiClient";
import { createPageUrl } from "@/utils";

/* ---------- shadcn/ui imports (NO directory imports) ---------- */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardHeader,
  CardContent,
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

/* ---------- icons ---------- */
import {
  Wrench,
  Clock,
  Save,
  LogOut,
  Calendar,
  Briefcase,
} from "lucide-react";

/* ---------- constants ---------- */
const IDLE_JOB_ID = "IDLE / NON-PRODUCTIVE";

export default function TechnicianPortal() {
  const queryClient = useQueryClient();

  /* ---------- state ---------- */
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    job_id: "",
    hours_logged: "",
    category: "",
    category_detail: "",
    end_date: "",
  });

  /* ---------- auth ---------- */
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
        try {
          await base44.auth.technicianLogin(parsed.name, parsed.employee_id);
          setUser(parsed);
        } catch {
          localStorage.removeItem("epiroc_user");
          window.location.href = createPageUrl("WorkshopLogin");
        }
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

  /* ---------- data ---------- */
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

  const isIdleSelected = formData.job_id === IDLE_JOB_ID;

  /* ---------- mutations ---------- */
  const createEntryMutation = useMutation({
    mutationFn: payload =>
      base44.entities.DailyTimeEntry.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEntries"] });
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        job_id: "",
        hours_logged: "",
        category: "",
        category_detail: "",
        end_date: "",
      });
    },
    onError: e => {
      setError(e?.message || "Failed to submit hours");
    },
  });

  /* ---------- submit ---------- */
  const handleSubmit = e => {
    e.preventDefault();
    setError("");

    if (!formData.job_id) {
      setError("Please select a job");
      return;
    }

    const hours = Number(formData.hours_logged);
    if (!hours || hours <= 0) {
      setError("Hours must be greater than 0");
      return;
    }

    createEntryMutation.mutate({
      timeLog: {
        technician_id: user.id,
        job_id: formData.job_id,
        hours_logged: hours,
        log_date: formData.date,
        is_idle: isIdleSelected,
        category: isIdleSelected ? formData.category : null,
        category_detail: isIdleSelected
          ? formData.category_detail
          : "",
      },
      report: null,
    });
  };

  if (!user) return null;

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-yellow-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded">
              <Wrench className="text-slate-900" />
            </div>
            <div>
              <h1 className="font-bold text-yellow-400">EPIROC</h1>
              <p className="text-xs text-slate-400">
                Technician Portal
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">
              <Clock className="w-4 h-4 mr-2" />
              Log Hours
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Briefcase className="w-4 h-4 mr-2" />
              My Jobs
            </TabsTrigger>
          </TabsList>

          {/* Log */}
          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>Log Time</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-3 text-red-500 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
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

                  <div>
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

                  <div>
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

                  <Button
                    type="submit"
                    disabled={createEntryMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createEntryMutation.isPending
                      ? "Saving..."
                      : "Submit"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs */}
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>My Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {myJobs.length === 0 ? (
                  <p className="text-slate-400">
                    No jobs assigned
                  </p>
                ) : (
                  myJobs.map(job => (
                    <div
                      key={job.id}
                      className="border-b py-2"
                    >
                      <p className="font-medium">
                        {job.job_number}
                      </p>
                      <p className="text-xs text-slate-400">
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