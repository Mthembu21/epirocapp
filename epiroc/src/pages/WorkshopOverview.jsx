import React from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DateRangeFilter from '@/components/filters/DateRangeFilter.jsx';
import { Wrench, LogOut, Clock, TrendingUp, Search, X, AlertTriangle } from 'lucide-react';

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
    LabelList
} from 'recharts';

const percentLabelProps = { position: 'top', formatter: (v) => `${Number(v).toFixed(1)}%`, style: { fontSize: 12, fontWeight: 600, fill: '#334155' } };
const countLabelProps = { position: 'top', style: { fontSize: 12, fontWeight: 600, fill: '#334155' } };

const WORKSHOP_KEYS = ['component', 'pdis', 'rebuild', 'kathu'];
const WORKSHOP_LABELS = { component: 'Components', pdis: 'PDI', rebuild: 'Rebuild', kathu: 'Kathu' };

const statusConfig = {
    pending_confirmation: { label: 'Pending', color: 'bg-slate-100 text-slate-700' },
    active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
    at_risk: { label: 'At Risk', color: 'bg-red-100 text-red-700' },
    over_allocated: { label: 'Over-Allocated', color: 'bg-orange-100 text-orange-700' },
    overrun: { label: 'Overrun', color: 'bg-orange-100 text-orange-700' }
};

export default function WorkshopOverview() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState(null);

    const [selectedView, setSelectedView] = React.useState('daily');
    const [selectedMonth, setSelectedMonth] = React.useState(() => format(new Date(), 'yyyy-MM'));

    const [jobSearch, setJobSearch] = React.useState('');
    const [selectedJobKey, setSelectedJobKey] = React.useState(null); // { workshop, job_number }

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
        try { await base44.auth.logout(); } catch { /* ignore */ }
        localStorage.removeItem('epiroc_user');
        window.location.href = createPageUrl('WorkshopLogin');
    };

    // Same daily/weekly/last_week/monthly range-building logic as
    // OperationalMetricsFetcher, so "Today"/"This Week"/etc. mean exactly the
    // same date window here as they do on each workshop's own dashboard.
    const { startDate, endDate, periodLabel } = React.useMemo(() => {
        const today = new Date();
        if (selectedView === 'daily') {
            const d = format(today, 'yyyy-MM-dd');
            return { startDate: d, endDate: d, periodLabel: 'Today' };
        }
        if (selectedView === 'weekly') {
            const ws = startOfWeek(today, { weekStartsOn: 1 });
            const we = endOfWeek(today, { weekStartsOn: 1 });
            return { startDate: format(ws, 'yyyy-MM-dd'), endDate: format(we, 'yyyy-MM-dd'), periodLabel: 'This Week' };
        }
        if (selectedView === 'last_week') {
            const ws = startOfWeek(today, { weekStartsOn: 1 });
            ws.setDate(ws.getDate() - 7);
            const we = endOfWeek(today, { weekStartsOn: 1 });
            we.setDate(we.getDate() - 7);
            return { startDate: format(ws, 'yyyy-MM-dd'), endDate: format(we, 'yyyy-MM-dd'), periodLabel: 'Last Week' };
        }
        const base = selectedMonth ? parseISO(`${selectedMonth}-01`) : today;
        let label = selectedMonth;
        try { label = base.toLocaleString('default', { month: 'long', year: 'numeric' }); } catch { /* keep raw */ }
        return {
            startDate: format(startOfMonth(base), 'yyyy-MM-dd'),
            endDate: format(endOfMonth(base), 'yyyy-MM-dd'),
            periodLabel: label
        };
    }, [selectedView, selectedMonth]);

    const handleViewChange = (view) => setSelectedView(view);

    const { data: kpiData } = useQuery({
        queryKey: ['workshopOverviewKpis', startDate, endDate],
        queryFn: () => base44.entities.Overview.kpis({ start_date: startDate, end_date: endDate }),
        enabled: isAuthenticated,
        keepPreviousData: true
    });

    const { data: jobsByWorkshop = {}, isFetching: isFetchingJobs } = useQuery({
        queryKey: ['workshopOverviewJobs'],
        queryFn: () => base44.entities.Overview.jobs(),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 30000 : false
    });

    const { data: jobDetail, isFetching: isFetchingJobDetail } = useQuery({
        queryKey: ['workshopOverviewJobDetail', selectedJobKey?.workshop, selectedJobKey?.job_number],
        queryFn: () => base44.entities.Overview.job(selectedJobKey.workshop, selectedJobKey.job_number),
        enabled: isAuthenticated && !!selectedJobKey
    });

    const byWorkshop = kpiData?.by_workshop || {};

    const comparisonRows = WORKSHOP_KEYS.map((k) => ({
        key: k,
        label: WORKSHOP_LABELS[k],
        ...byWorkshop[k]
    }));

    const productivityChartData = comparisonRows.map((w) => ({
        workshop: w.label,
        productivity: Number(w?.kpis?.productivity_percent ?? 0)
    }));
    const utilizationChartData = comparisonRows.map((w) => ({
        workshop: w.label,
        utilization: Number(w?.kpis?.utilization_percent ?? 0)
    }));
    const jobsChartData = comparisonRows.map((w) => ({
        workshop: w.label,
        active: Number(w?.active_jobs ?? 0),
        completed: Number(w?.completed_jobs ?? 0),
        atRisk: Number(w?.jobs_at_risk ?? 0)
    }));

    // Flatten every workshop's job list into one searchable array, tagged with
    // which workshop each job belongs to (job numbers are only unique within a
    // single workshop, so the same number can legitimately exist in more than
    // one — each is shown as its own row).
    const allJobs = React.useMemo(() => {
        return WORKSHOP_KEYS.flatMap((k) =>
            (jobsByWorkshop[k] || []).map((j) => ({ ...j, __workshop: k }))
        );
    }, [jobsByWorkshop]);

    const jobSearchResults = React.useMemo(() => {
        const q = jobSearch.trim().toLowerCase();
        if (!q) return [];
        return allJobs
            .filter((j) => String(j?.job_number || '').toLowerCase().includes(q) || String(j?.description || '').toLowerCase().includes(q))
            .slice(0, 100);
    }, [allJobs, jobSearch]);

    const detailJob = jobDetail?.job;
    const detailReports = jobDetail?.reports || [];

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
                                <p className="text-slate-500 text-xs">{periodLabel}</p>
                                {currentUser?.email && (
                                    <p className="text-slate-500 text-xs">{currentUser.email}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {selectedView === 'monthly' && (
                                <Input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => { if (e.target.value) setSelectedMonth(e.target.value); }}
                                    className="w-44 bg-white"
                                />
                            )}
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <DateRangeFilter selectedView={selectedView} onViewChange={handleViewChange} compact={false} showFilterStatus={false} />

                {/* ── Per-workshop comparison ── */}
                <div>
                    <h2 className="text-xl font-bold text-white mb-4">Workshop Comparison — {periodLabel}</h2>
                    <Card className="border-0 shadow-lg bg-white/95 mb-6">
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Workshop</TableHead>
                                        <TableHead className="text-right">Productivity</TableHead>
                                        <TableHead className="text-right">Utilization</TableHead>
                                        <TableHead className="text-right">Efficiency</TableHead>
                                        <TableHead className="text-right">Availability</TableHead>
                                        <TableHead className="text-right">Active Jobs</TableHead>
                                        <TableHead className="text-right">Completed</TableHead>
                                        <TableHead className="text-right">At Risk</TableHead>
                                        <TableHead className="text-right">Overtime</TableHead>
                                        <TableHead className="text-right">Training</TableHead>
                                        <TableHead className="text-right">Technicians</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comparisonRows.map((w) => (
                                        <TableRow key={w.key}>
                                            <TableCell className="font-semibold">{w.label}</TableCell>
                                            <TableCell className="text-right">{w?.kpis?.productivity_percent != null ? `${Number(w.kpis.productivity_percent).toFixed(1)}%` : '—'}</TableCell>
                                            <TableCell className="text-right">{w?.kpis?.utilization_percent != null ? `${Number(w.kpis.utilization_percent).toFixed(1)}%` : '—'}</TableCell>
                                            <TableCell className="text-right">{w?.kpis?.efficiency_percent != null ? `${Number(w.kpis.efficiency_percent).toFixed(1)}%` : '—'}</TableCell>
                                            <TableCell className="text-right">{w?.kpis?.availability_percent != null ? `${Number(w.kpis.availability_percent).toFixed(1)}%` : '—'}</TableCell>
                                            <TableCell className="text-right">{w?.active_jobs ?? 0}</TableCell>
                                            <TableCell className="text-right text-green-700">{w?.completed_jobs ?? 0}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className={Number(w?.jobs_at_risk ?? 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                                                    {w?.jobs_at_risk ?? 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{Number(w?.overtime_hours ?? 0).toFixed(1)}h</TableCell>
                                            <TableCell className="text-right">{Number(w?.training_hours ?? 0).toFixed(1)}h</TableCell>
                                            <TableCell className="text-right">{w?.total_technicians ?? 0}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-0 shadow-lg bg-white/95">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-slate-800">Productivity % per workshop</CardTitle>
                            </CardHeader>
                            <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={productivityChartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="workshop" />
                                        <YAxis domain={[0, 100]} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="productivity" fill="#2563eb" name="Productivity %">
                                            <LabelList dataKey="productivity" {...percentLabelProps} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-white/95">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-slate-800">Utilization % per workshop</CardTitle>
                            </CardHeader>
                            <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={utilizationChartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="workshop" />
                                        <YAxis domain={[0, 100]} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="utilization" fill="#f59e0b" name="Utilization %">
                                            <LabelList dataKey="utilization" {...percentLabelProps} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-white/95 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-slate-800">Jobs per workshop (active / completed / at risk)</CardTitle>
                            </CardHeader>
                            <CardContent className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={jobsChartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="workshop" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="active" fill="#2563eb" name="Active">
                                            <LabelList dataKey="active" {...countLabelProps} />
                                        </Bar>
                                        <Bar dataKey="completed" fill="#16a34a" name="Completed">
                                            <LabelList dataKey="completed" {...countLabelProps} />
                                        </Bar>
                                        <Bar dataKey="atRisk" fill="#dc2626" name="At Risk">
                                            <LabelList dataKey="atRisk" {...countLabelProps} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* ── Search a job across every workshop ── */}
                <div>
                    <h2 className="text-xl font-bold text-white mb-4">Find a Job</h2>
                    <Card className="border-0 shadow-lg bg-white/95">
                        <CardHeader className="pb-3">
                            <div className="relative max-w-md">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={jobSearch}
                                    onChange={(e) => setJobSearch(e.target.value)}
                                    placeholder="Search by job number or description…"
                                    className="pl-9 pr-9"
                                />
                                {jobSearch && (
                                    <button
                                        onClick={() => setJobSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {isFetchingJobs && !allJobs.length && (
                                <p className="text-xs text-slate-400 mt-2">Loading jobs from every workshop…</p>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            {!jobSearch.trim() ? (
                                <div className="py-10 text-center text-slate-400 text-sm">
                                    Start typing a job number to search across all {WORKSHOP_KEYS.length} workshops ({allJobs.length} jobs loaded).
                                </div>
                            ) : jobSearchResults.length === 0 ? (
                                <div className="py-10 text-center text-slate-400 text-sm">No jobs match "{jobSearch}".</div>
                            ) : (
                                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 sticky top-0">
                                                <TableHead>Workshop</TableHead>
                                                <TableHead>Job #</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Allocated</TableHead>
                                                <TableHead className="text-right">Consumed</TableHead>
                                                <TableHead className="text-right">Remaining</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jobSearchResults.map((j) => {
                                                const cfg = statusConfig[j.status] || statusConfig.active;
                                                const remaining = Number(j.remaining_hours ?? (Number(j.allocated_hours || 0) - Number(j.consumed_hours || 0)));
                                                return (
                                                    <TableRow
                                                        key={`${j.__workshop}-${j.job_number}`}
                                                        className="cursor-pointer hover:bg-slate-50"
                                                        onClick={() => setSelectedJobKey({ workshop: j.__workshop, job_number: j.job_number })}
                                                    >
                                                        <TableCell><Badge variant="outline">{WORKSHOP_LABELS[j.__workshop]}</Badge></TableCell>
                                                        <TableCell className="font-mono font-semibold text-blue-700">{j.job_number}</TableCell>
                                                        <TableCell className="max-w-[240px] truncate">{j.description}</TableCell>
                                                        <TableCell><Badge className={cfg.color}>{cfg.label}</Badge></TableCell>
                                                        <TableCell className="text-right">{Number(j.allocated_hours || 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-blue-600">{Number(j.consumed_hours || 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-green-600">{remaining.toFixed(1)}h</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* ── Job detail dialog ── */}
            <Dialog open={!!selectedJobKey} onOpenChange={(open) => { if (!open) setSelectedJobKey(null); }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <span className="font-mono">{selectedJobKey?.job_number}</span>
                            {selectedJobKey && <Badge variant="outline">{WORKSHOP_LABELS[selectedJobKey.workshop]}</Badge>}
                        </DialogTitle>
                        <DialogDescription>{detailJob?.description || (isFetchingJobDetail ? 'Loading…' : '')}</DialogDescription>
                    </DialogHeader>

                    {isFetchingJobDetail && !detailJob ? (
                        <div className="py-10 text-center text-slate-400 text-sm">Loading job…</div>
                    ) : detailJob ? (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2">
                                <Badge className={(statusConfig[detailJob.status] || statusConfig.active).color}>
                                    {(statusConfig[detailJob.status] || statusConfig.active).label}
                                </Badge>
                                {Number(detailJob.bottleneck_count || 0) > 0 && (
                                    <Badge variant="outline" className="text-red-600 border-red-200">
                                        {detailJob.bottleneck_count} issue{detailJob.bottleneck_count === 1 ? '' : 's'}
                                    </Badge>
                                )}
                                {detailJob.risk_reason && (
                                    <span className="text-xs text-red-600">{String(detailJob.risk_reason).replace(/_/g, ' ')}</span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Allocated', value: `${Number(detailJob.allocated_hours || 0).toFixed(1)}h` },
                                    { label: 'Consumed', value: `${Number(detailJob.consumed_hours || 0).toFixed(1)}h` },
                                    { label: 'Remaining', value: `${Number(detailJob.remaining_hours ?? Math.max(0, Number(detailJob.allocated_hours || 0) - Number(detailJob.consumed_hours || 0))).toFixed(1)}h` },
                                    { label: 'Progress', value: `${Number(detailJob.aggregated_progress_percentage ?? detailJob.progress_percentage ?? 0).toFixed(0)}%` },
                                ].map((s) => (
                                    <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                                        <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
                                        <p className="text-base font-semibold text-slate-800">{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {(detailJob.technicians || []).length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Technicians</p>
                                    <div className="flex flex-wrap gap-2">
                                        {detailJob.technicians.map((t) => (
                                            <Badge key={t.technician_id} variant="outline" className={t.booking_blocked ? 'border-red-300 text-red-700' : ''}>
                                                {t.technician_name || t.technician_id}
                                                {t.booking_blocked ? ' (blocked)' : ''}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(detailJob.subtasks || []).length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Stages</p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Stage</TableHead>
                                                <TableHead className="text-right">Allocated</TableHead>
                                                <TableHead className="text-right">Consumed</TableHead>
                                                <TableHead>Assigned</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {detailJob.subtasks.map((st) => (
                                                <TableRow key={st._id || st.title}>
                                                    <TableCell>{st.title}</TableCell>
                                                    <TableCell className="text-right">{Number(st.allocated_hours || 0).toFixed(1)}h</TableCell>
                                                    <TableCell className="text-right text-blue-600">{Number(st.consumed_hours || 0).toFixed(1)}h</TableCell>
                                                    <TableCell className="text-sm text-slate-600">
                                                        {(st.assigned_technicians || []).map((a) => a.technician_name).filter(Boolean).join(', ') || '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Reports &amp; Notes ({detailReports.length})</p>
                                {detailReports.length === 0 ? (
                                    <p className="text-sm text-slate-400">No reports filed on this job.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {detailReports.map((r) => (
                                            <div key={r._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                                    <span className="font-semibold text-slate-700">{r.technician_name || 'Technician'}</span>
                                                    <span>{r.date ? new Date(r.date).toLocaleDateString() : ''}</span>
                                                    {r.has_bottleneck && (
                                                        <span className="flex items-center gap-1 text-amber-700">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            {String(r.bottleneck_category || 'issue').replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-700">{r.work_completed || (r.has_bottleneck ? r.bottleneck_description : '')}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400 text-sm">Job not found.</div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
