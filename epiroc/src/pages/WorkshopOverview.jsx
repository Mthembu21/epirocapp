import React from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsCard from '../components/timesheet/StatsCard';
import { Wrench, LogOut, Briefcase, Clock, TrendingUp } from 'lucide-react';

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid
} from 'recharts';

export default function WorkshopOverview() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState(null);

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
            if ((parsed.role || 'supervisor') !== 'manager') {
                window.location.href = createPageUrl('Dashboard');
                return;
            }
            setCurrentUser(parsed);
            try {
                await base44.auth.me();
                setIsAuthenticated(true);
            } catch {
                localStorage.removeItem('epiroc_user');
                window.location.href = createPageUrl('WorkshopLogin');
            }
        };
        validateSession();
    }, []);

    const handleLogout = async () => {
        try { await base44.auth.logout(); } catch {}
        localStorage.removeItem('epiroc_user');
        window.location.href = createPageUrl('WorkshopLogin');
    };

    const { data } = useQuery({
        queryKey: ['workshopOverview'],
        queryFn: () => base44.entities.Overview.workshop(),
        enabled: isAuthenticated
    });

    const totalJobsOpened = Number(data?.total_jobs_opened || 0);
    const totalHoursConsumed = Number(data?.total_hours_consumed || 0);
    const utilization = Number(data?.labour_utilization_percentage || 0);

    const workshops = ['component', 'pdis', 'rebuild']
        .map((k) => data?.by_workshop?.[k])
        .filter(Boolean);

    const jobsChartData = workshops.map((w) => ({
        workshop: w.label,
        jobs: Number(w.jobs_opened || 0)
    }));

    const hoursChartData = workshops.map((w) => ({
        workshop: w.label,
        hours: Number(w.hours_consumed || 0)
    }));

    const utilChartData = workshops.map((w) => ({
        workshop: w.label,
        utilization: Number(w.utilization_percentage || 0)
    }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-400 p-3 rounded-xl shadow-lg">
                                <Wrench className="w-8 h-8 text-slate-800" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-yellow-400 tracking-tight">EPIROC</h1>
                                <p className="text-slate-400 text-xs tracking-widest">WORKSHOP OVERVIEW</p>
                                {currentUser?.email && (
                                    <p className="text-slate-500 text-xs">{currentUser.email}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <Button
                                variant="outline"
                                className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
                                onClick={() => { window.location.href = createPageUrl('Dashboard'); }}
                            >
                                Back to Dashboard
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <StatsCard
                        title="Total Jobs Opened"
                        value={totalJobsOpened}
                        subtitle="Components + PDI + Rebuild"
                        icon={Briefcase}
                        color="blue"
                    />
                    <StatsCard
                        title="Total Hours Consumed"
                        value={`${totalHoursConsumed.toFixed(0)}h`}
                        subtitle="All workshops"
                        icon={Clock}
                        color="green"
                    />
                    <StatsCard
                        title="Labour Utilization"
                        value={`${utilization.toFixed(0)}%`}
                        subtitle="Utilized / Allocated"
                        icon={TrendingUp}
                        color="yellow"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-0 shadow-lg bg-white/95">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-slate-800">Jobs per workshop</CardTitle>
                        </CardHeader>
                        <CardContent className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={jobsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="workshop" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="jobs" fill="#2563eb" name="Jobs" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-white/95">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-slate-800">Hours consumed per workshop</CardTitle>
                        </CardHeader>
                        <CardContent className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hoursChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="workshop" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="hours" fill="#16a34a" name="Hours" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-white/95 lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-slate-800">Utilization comparison</CardTitle>
                        </CardHeader>
                        <CardContent className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={utilChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="workshop" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="utilization" fill="#f59e0b" name="Utilization %" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
