import React, { useState } from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock, Users, Wrench, LogOut, Briefcase, TrendingUp, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';

import StatsCard from '../components/timesheet/StatsCard';
import ExportButton from '../components/timesheet/ExportButton';
import TechnicianModal from '../components/technician/TechnicianModal';
import TechnicianList from '../components/technician/TechnicianList';
import JobAllocationModal from '../components/jobs/JobAllocationModal';
import JobList from '../components/jobs/JobList';
import AtRiskJobs from '../components/jobs/AtRiskJobs';
import TechnicianPerformance from '../components/dashboard/TechnicianPerformance';
import PerformanceCharts from '../components/dashboard/PerformanceCharts';
import HRExportButton from '../components/dashboard/HRExportButton';
import MonthlyArchiveManager from '../components/dashboard/MonthlyArchiveManager';

// Hours are now calculated per entry, not constants

export default function Dashboard() {
    const [techModalOpen, setTechModalOpen] = useState(false);
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
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
            try {
                await base44.auth.me();
                setIsAuthenticated(true);
            } catch {
                // Session expired — re-login as supervisor to restore it
                try {
                    await base44.auth.supervisorLogin(parsed.code || 'Epiroc#26');
                    setIsAuthenticated(true);
                } catch {
                    localStorage.removeItem('epiroc_user');
                    window.location.href = createPageUrl('WorkshopLogin');
                }
            }
        };
        validateSession();
    }, []);

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

    const { data: jobs = [] } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => base44.entities.Job.list('-created_date', 200),
        enabled: isAuthenticated
    });

    const { data: timeEntries = [] } = useQuery({
        queryKey: ['dailyTimeEntries'],
        queryFn: () => base44.entities.DailyTimeEntry.list('-date', 500),
        enabled: isAuthenticated
    });

    const { data: jobReports = [] } = useQuery({
        queryKey: ['jobReports'],
        queryFn: () => base44.entities.JobReport.list('-date', 200),
        enabled: isAuthenticated
    });

    const createTechnicianMutation = useMutation({
        mutationFn: (data) => base44.entities.Technician.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicians'] })
    });

    const deleteTechnicianMutation = useMutation({
        mutationFn: async (id) => {
            // Delete all time entries for this technician
            const techEntries = timeEntries.filter(e => e.technician_id === id);
            for (const entry of techEntries) {
                await base44.entities.DailyTimeEntry.delete(entry.id);
            }
            // Delete the technician
            await base44.entities.Technician.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            queryClient.invalidateQueries({ queryKey: ['dailyTimeEntries'] });
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

    const reassignJobMutation = useMutation({
        mutationFn: async ({ jobId, newTechnicianId, newTechnicianName, previousTechnicianId, previousTechnicianName, reason }) => {
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

            return base44.entities.Job.update(jobId, {
                assigned_technician_id: newTechnicianId,
                assigned_technician_name: newTechnicianName,
                confirmed_by_technician: false,
                confirmed_date: null,
                status: 'pending_confirmation',
                reassignment_history: reassignmentHistory
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const activeJobs = jobs.filter(j => ['active', 'in_progress'].includes(j.status));
    const atRiskJobs = jobs.filter(j => j.status === 'at_risk' || j.bottleneck_count >= 2);
    const completedJobs = jobs.filter(j => j.status === 'completed');
    
    const totalHRHours = timeEntries.reduce((sum, e) => sum + (e.hr_hours || 0), 0);
    const totalProductiveHours = timeEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-400 p-2 rounded-lg">
                                    <Wrench className="w-8 h-8 text-slate-800" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-yellow-400 tracking-tight">EPIROC</h1>
                                    <p className="text-slate-400 text-xs tracking-widest">SUPERVISOR DASHBOARD</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <HRExportButton timeEntries={timeEntries} technicians={technicians} />
                            <ExportButton entries={timeEntries} technicians={technicians} filename="epiroc_timesheet" />
                            <JobAllocationModal 
                                technicians={technicians}
                                existingJobs={jobs}
                                onSubmit={createJobMutation.mutate}
                                isOpen={jobModalOpen}
                                setIsOpen={setJobModalOpen}
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
                <div className="mb-6">
                    <MonthlyArchiveManager timeEntries={timeEntries} technicians={technicians} />
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
                    />
                    <StatsCard
                        title="HR Hours"
                        value={`${totalHRHours.toFixed(0)}h`}
                        subtitle="For payroll"
                        icon={Clock}
                        color="blue"
                    />
                    <StatsCard
                        title="Productive"
                        value={`${totalProductiveHours.toFixed(0)}h`}
                        subtitle="Job hours"
                        icon={Clock}
                        color="green"
                    />
                </div>

                {atRiskJobs.length > 0 && (
                    <div className="mb-8">
                        <AtRiskJobs jobs={jobs} jobReports={jobReports} />
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
                    </TabsList>

                    <TabsContent value="jobs" className="mt-6">
                        <JobList 
                            jobs={jobs}
                            technicians={technicians}
                            onDelete={deleteJobMutation.mutate}
                            onReassign={reassignJobMutation.mutate}
                            isReassigning={reassignJobMutation.isPending}
                        />
                    </TabsContent>

                    <TabsContent value="performance" className="mt-6">
                        <div className="space-y-6">
                            <PerformanceCharts 
                                technicians={technicians}
                                jobs={jobs}
                                timeEntries={timeEntries}
                            />
                            <TechnicianPerformance 
                                technicians={technicians}
                                jobs={jobs}
                                timeEntries={timeEntries}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="technicians" className="mt-6">
                        <TechnicianList 
                            technicians={technicians}
                            onDelete={deleteTechnicianMutation.mutate}
                        />
                    </TabsContent>
                </Tabs>

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