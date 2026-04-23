
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { BarChart3, TrendingUp, Award, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, subDays } from 'date-fns';

const COLORS = ['#facc15', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f97316'];

export default function PerformanceCharts({ technicians, jobs, timeEntries }) {
    const [selectedTechnician, setSelectedTechnician] = useState('all');
    const [timeRange, setTimeRange] = useState('current');
    const [monthlySummaries, setMonthlySummaries] = useState([]);

    const getDateRange = useCallback(() => {
        const now = new Date();
        
        switch (timeRange) {
            case 'thisWeek':
                return { start: startOfWeek(now), end: endOfWeek(now) };
            case 'lastWeek':
                const lastWeek = subWeeks(now, 1);
                return { start: startOfWeek(lastWeek), end: endOfWeek(lastWeek) };
            case 'last2Weeks':
                const twoWeeksAgo = subWeeks(now, 2);
                return { start: startOfWeek(twoWeeksAgo), end: endOfWeek(now) };
            case 'last3Weeks':
                const threeWeeksAgo = subWeeks(now, 3);
                return { start: startOfWeek(threeWeeksAgo), end: endOfWeek(now) };
            case 'current':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            case 'last':
                const lastMonth = subMonths(now, 1);
                return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
            case 'last2Months':
                const twoMonthsAgo = subMonths(now, 2);
                return { start: startOfMonth(twoMonthsAgo), end: endOfMonth(now) };
            case 'last3Months':
                const threeMonthsAgo = subMonths(now, 3);
                return { start: startOfMonth(threeMonthsAgo), end: endOfMonth(now) };
            case 'last6Months':
                const sixMonthsAgo = subMonths(now, 6);
                return { start: startOfMonth(sixMonthsAgo), end: endOfMonth(now) };
            case 'last12Months':
                const twelveMonthsAgo = subMonths(now, 12);
                return { start: startOfMonth(twelveMonthsAgo), end: endOfMonth(now) };
            default:
                return { start: startOfMonth(now), end: endOfMonth(now) };
        }
    }, [timeRange]);

    const { start, end } = getDateRange();

    // Filter entries
    const filteredEntries = useMemo(() => {
        return timeEntries.filter(e => {
            if (!e?.log_date) return false;
            const entryDate = parseISO(e.log_date);
            const inRange = entryDate >= start && entryDate <= end;
            const techMatch = selectedTechnician === 'all' || String(e.technician_id) === String(selectedTechnician);
            return inRange && techMatch;
        });
    }, [timeEntries, start, end, selectedTechnician]);

    // Filter jobs
    const filteredJobs = useMemo(() => {
        const isTechOnJob = (job, techId) => {
            if (!job) return false;
            if ((job.technicians || []).some(t => String(t?.technician_id) === String(techId))) return true;
            return (job.subtasks || []).some(st =>
                (st.assigned_technicians || []).some(a => String(a?.technician_id) === String(techId))
            );
        };

        return jobs.filter(j => selectedTechnician === 'all' || isTechOnJob(j, selectedTechnician));
    }, [jobs, selectedTechnician]);

    // Fetch operational metrics using new API
    useEffect(() => {
        const fetchOperationalMetrics = async () => {
            try {
                const dateRange = format(start, 'yyyy-MM');
                const response = await fetch(
                    `/api/metrics/utilization/daily?techId=${selectedTechnician}&dateRange=${dateRange}`
                );

                if (response.ok) {
                    const result = await response.json();
                    const data = result.data || [];
                    // Normalize to always be an array
                    setMonthlySummaries(Array.isArray(data) ? data : []);
                } else {
                    console.error('API error:', response.status);
                    setMonthlySummaries([]); // will trigger fallback
                }
            } catch (error) {
                console.error('Failed to fetch daily productivity:', error);
                setMonthlySummaries([]);
            }
        };

        if (technicians.length > 0) {
            fetchOperationalMetrics();
        }
    }, [selectedTechnician, start, technicians]);

    // Technician Efficiency
    const technicianEfficiency = useMemo(() => {
        return technicians.map(tech => {
            const isTechOnJob = (job) => {
                if (!job) return false;
                if ((job.technicians || []).some(t => String(t?.technician_id) === String(tech.id))) return true;
                return (job.subtasks || []).some(st =>
                    (st.assigned_technicians || []).some(a => String(a?.technician_id) === String(tech.id))
                );
            };

            const techJobs = filteredJobs.filter(isTechOnJob);
            const completedJobs = techJobs.filter(j => j.status === 'completed');
            const techEntries = filteredEntries.filter(e => String(e.technician_id) === String(tech.id));

            const monthlySummary = Array.isArray(monthlySummaries)
                ? monthlySummaries.find(s => s.technician_id === tech.id)
                : null;

            const totalProductiveHours = monthlySummary?.productiveHours ?? 
                techEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);

            const totalNonProductiveHours = monthlySummary?.nonProductiveHours ?? 
                techEntries.reduce((sum, e) => sum + (e.is_idle && !e.is_leave ? (e.hours_logged || 0) : 0), 0);

            const totalIdleHours = monthlySummary?.idleHours ?? 
                techEntries.reduce((sum, e) => sum + (e.is_idle && !e.is_leave ? (e.hours_logged || 0) : 0), 0);

            const totalNotAvailableHours = monthlySummary?.notAvailableHours ?? 
                techEntries.reduce((sum, e) => sum + (e.is_leave ? (e.hours_logged || 0) : 0), 0);

            const totalOvertimeHours = monthlySummary?.overtime_hours ?? 
                techEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

            const totalNormalHours = monthlySummary?.normal_hours ?? 
                techEntries.reduce((sum, e) => sum + (e.normal_hours || 0), 0);

            const getAllocatedForTechOnJob = (job) => {
                const fromStages = (job?.subtasks || []).reduce((sum, st) => {
                    const a = (st?.assigned_technicians || []).find(x => String(x?.technician_id) === String(tech.id));
                    return sum + Number(a?.allocated_hours || 0);
                }, 0);
                return fromStages > 0 ? fromStages : Number(job?.allocated_hours || 0);
            };

            const totalAllocated = completedJobs.reduce((sum, j) => sum + getAllocatedForTechOnJob(j), 0);
            const totalUtilized = techEntries
                .filter(e => !e.is_idle)
                .filter(e => completedJobs.some(j => String(j.job_number) === String(e.job_id)))
                .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);

            const efficiency = totalUtilized > 0 
                ? Math.max(0, Math.min(100, (totalAllocated / totalUtilized) * 100)) 
                : 0;

            return {
                name: tech.name?.split(' ')[0] || 'Unknown',
                fullName: tech.name,
                efficiency,
                completedJobs: completedJobs.length,
                activeJobs: techJobs.filter(j => ['active', 'in_progress'].includes(j.status)).length,
                productiveHours: totalProductiveHours,
                nonProductiveHours: totalNonProductiveHours,
                idleHours: totalIdleHours,
                notAvailableHours: totalNotAvailableHours,
                overtimeHours: totalOvertimeHours,
                normalHours: totalNormalHours,
                allocatedHours: totalAllocated,
                utilizedHours: totalUtilized,
            };
        }).filter(t => t.productiveHours > 0 || t.completedJobs > 0);
    }, [technicians, filteredJobs, filteredEntries, monthlySummaries]);

    const utilization = useMemo(() => {
        const productive = filteredEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
        const nonProductive = filteredEntries.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);
        const denom = productive + nonProductive;
        return denom > 0 ? Math.max(0, Math.min(100, (productive / denom) * 100)) : 0;
    }, [filteredEntries]);

    const utilizedSum = filteredEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const allocatedSum = technicianEfficiency.reduce((sum, t) => sum + t.allocatedHours, 0);

    // Daily Data (New Operational Metrics)
    const dailyData = useMemo(() => {
        if (Array.isArray(monthlySummaries) && monthlySummaries.length > 0) {
            return monthlySummaries.map(day => {
                // New operational principles
                const totalContractedHours = day.totalHours || 0;
                const adjustedAvailableHours = totalContractedHours - (day.notAvailableHours || 0);
                
                // A. Utilization % = Productive Hours / Adjusted Available Hours * 100
                const utilization = adjustedAvailableHours > 0 
                    ? Math.round((day.productiveHours || 0) / adjustedAvailableHours * 100) 
                    : 0;
                
                // B. Productivity % = Productive Hours / (Productive Hours + Non-Productive Hours) * 100
                const workingHours = (day.productiveHours || 0) + (day.nonProductiveHours || 0);
                const productivity = workingHours > 0 
                    ? Math.round((day.productiveHours || 0) / workingHours * 100) 
                    : 0;
                
                // C. Idle % = Idle Hours / Adjusted Available Hours * 100
                const idlePercentage = adjustedAvailableHours > 0 
                    ? Math.round((day.idleHours || 0) / adjustedAvailableHours * 100) 
                    : 0;
                
                return {
                    date: format(new Date(day.date || day.fullDate), 'dd'),
                    fullDate: format(new Date(day.date || day.fullDate), 'MMM dd'),
                    totalHours: day.totalHours || 0,
                    productiveHours: day.productiveHours || 0,
                    availableHours,
                    dailyProductivePercentage: productivity,
                    dailyUtilizationPercentage: utilization,
                    breakdown: {
                        productivePercentage: adjustedAvailableHours > 0 ? Math.round((day.productiveHours || 0) / adjustedAvailableHours * 100) : 0,
                        nonProductivePercentage: adjustedAvailableHours > 0 ? Math.round((day.nonProductiveHours || 0) / adjustedAvailableHours * 100) : 0,
                        idlePercentage: adjustedAvailableHours > 0 ? Math.round((day.idleHours || 0) / adjustedAvailableHours * 100) : 0,
                        notAvailablePercentage: totalContractedHours > 0 ? Math.round((day.notAvailableHours || 0) / totalContractedHours * 100) : 0
                    },
                    technicians: day.technicians || []
                };
            }).filter(d => d.availableHours > 0);
        }

        // Fallback from timeEntries
        if (selectedTechnician === 'all') {
            const allDaily = {};
            filteredEntries.forEach(entry => {
                if (!entry?.log_date) return;
                const day = parseISO(entry.log_date);
                const key = format(day, 'yyyy-MM-dd');

                if (!allDaily[key]) {
                    allDaily[key] = {
                        date: format(day, 'dd'),
                        fullDate: format(day, 'MMM dd'),
                        totalHours: 0,
                        productiveHours: 0,
                        idleHours: 0,
                        housekeepingHours: 0,
                        trainingHours: 0,
                        availableHours: 0,
                        dailyProductivePercentage: 0,
                        dailyUtilizationPercentage: 0,
                        breakdown: { productivePercentage: 0, idlePercentage: 0, housekeepingPercentage: 0, trainingPercentage: 0 }
                    };
                }

                const h = Number(entry.hours_logged || 0);
                allDaily[key].totalHours += h;
                
                // ✅ Categorize hours based on job type
                if (entry.is_idle) {
                    allDaily[key].idleHours += h;
                } else if (entry.job_id === 'housekeeping') {
                    allDaily[key].housekeepingHours += h;
                } else if (entry.job_id === 'training') {
                    allDaily[key].trainingHours += h;
                } else {
                    allDaily[key].productiveHours += h;
                }
                
                allDaily[key].availableHours += h;
            });

            return Object.values(allDaily)
                .filter(d => d.availableHours > 0)
                .map(d => {
                    // ✅ Available Hours = Productive + Idle + Housekeeping (exclude training & leave)
                    const availableHours = d.productiveHours + (d.idleHours || 0) + (d.housekeepingHours || 0);
                    
                    // ✅ Utilization = Productive / Available * 100 (exclude training & leave)
                    const utilization = availableHours > 0 
                        ? Math.round((d.productiveHours / availableHours) * 100) 
                        : 0;
                    
                    // ✅ Productivity = Productive / Total Logged * 100 (includes all recorded hours)
                    const totalLogged = d.productiveHours + (d.idleHours || 0) + (d.housekeepingHours || 0) + (d.trainingHours || 0);
                    const productivity = totalLogged > 0 
                        ? Math.round((d.productiveHours / totalLogged) * 100) 
                        : 0;
                    
                    return {
                        ...d,
                        availableHours,
                        dailyProductivePercentage: productivity,
                        dailyUtilizationPercentage: utilization,
                        breakdown: {
                            productivePercentage: totalLogged > 0 ? Math.round((d.productiveHours / totalLogged) * 100) : 0,
                            idlePercentage: totalLogged > 0 ? Math.round(((d.idleHours || 0) / totalLogged) * 100) : 0,
                            housekeepingPercentage: totalLogged > 0 ? Math.round(((d.housekeepingHours || 0) / totalLogged) * 100) : 0,
                            trainingPercentage: totalLogged > 0 ? Math.round(((d.trainingHours || 0) / totalLogged) * 100) : 0
                        }
                    };
                });
        } else {
            // Single technician fallback
            const techEntries = filteredEntries.filter(e => String(e.technician_id) === String(selectedTechnician));
            const dailyMap = {};

            techEntries.forEach(entry => {
                if (!entry?.log_date) return;
                const day = parseISO(entry.log_date);
                const key = format(day, 'yyyy-MM-dd');

                if (!dailyMap[key]) {
                    dailyMap[key] = {
                        date: format(day, 'dd'),
                        fullDate: format(day, 'MMM dd'),
                        totalHours: 0,
                        productiveHours: 0,
                        idleHours: 0,
                        housekeepingHours: 0,
                        trainingHours: 0,
                        availableHours: 0,
                        dailyProductivePercentage: 0,
                        dailyUtilizationPercentage: 0,
                        breakdown: { productivePercentage: 0, idlePercentage: 0, housekeepingPercentage: 0, trainingPercentage: 0 }
                    };
                }

                const h = Number(entry.hours_logged || 0);
                dailyMap[key].totalHours += h;
                
                // ✅ Categorize hours based on job type
                if (entry.is_idle) {
                    dailyMap[key].idleHours += h;
                } else if (entry.job_id === 'housekeeping') {
                    dailyMap[key].housekeepingHours += h;
                } else if (entry.job_id === 'training') {
                    dailyMap[key].trainingHours += h;
                } else {
                    dailyMap[key].productiveHours += h;
                }
                
                dailyMap[key].availableHours += h;
            });

            return Object.values(dailyMap)
                .filter(d => d.availableHours > 0)
                .map(d => {
                    // ✅ Available Hours = Productive + Idle + Housekeeping (exclude training & leave)
                    const availableHours = d.productiveHours + (d.idleHours || 0) + (d.housekeepingHours || 0);
                    
                    // ✅ Utilization = Productive / Available * 100 (exclude training & leave)
                    const utilization = availableHours > 0 
                        ? Math.round((d.productiveHours / availableHours) * 100) 
                        : 0;
                    
                    // ✅ Productivity = Productive / Total Logged * 100 (includes all recorded hours)
                    const totalLogged = d.productiveHours + (d.idleHours || 0) + (d.housekeepingHours || 0) + (d.trainingHours || 0);
                    const productivity = totalLogged > 0 
                        ? Math.round((d.productiveHours / totalLogged) * 100) 
                        : 0;
                    
                    return {
                        ...d,
                        availableHours,
                        dailyProductivePercentage: productivity,
                        dailyUtilizationPercentage: utilization,
                        breakdown: {
                            productivePercentage: totalLogged > 0 ? Math.round((d.productiveHours / totalLogged) * 100) : 0,
                            idlePercentage: totalLogged > 0 ? Math.round(((d.idleHours || 0) / totalLogged) * 100) : 0,
                            housekeepingPercentage: totalLogged > 0 ? Math.round(((d.housekeepingHours || 0) / totalLogged) * 100) : 0,
                            trainingPercentage: totalLogged > 0 ? Math.round(((d.trainingHours || 0) / totalLogged) * 100) : 0
                        }
                    };
                });
        }
    }, [monthlySummaries, selectedTechnician, filteredEntries]);

    // Status Distribution
    const statusDistribution = useMemo(() => [
        { name: 'Completed', value: filteredJobs.filter(j => j.status === 'completed').length, color: '#22c55e' },
        { name: 'In Progress', value: filteredJobs.filter(j => ['active', 'in_progress'].includes(j.status)).length, color: '#3b82f6' },
        { name: 'At Risk', value: filteredJobs.filter(j => j.status === 'at_risk').length, color: '#ef4444' },
        { name: 'Pending', value: filteredJobs.filter(j => j.status === 'pending_confirmation').length, color: '#94a3b8' }
    ].filter(s => s.value > 0), [filteredJobs]);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                        <SelectTrigger className="w-48 bg-white">
                            <SelectValue placeholder="All Technicians" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Technicians</SelectItem>
                            {technicians.filter(t => t.status === 'active').map(tech => (
                                <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-48 bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="font-semibold text-xs text-slate-500 px-2 py-1">WEEKLY</div>
                            <SelectItem value="thisWeek">This Week</SelectItem>
                            <SelectItem value="lastWeek">Last Week</SelectItem>
                            <SelectItem value="last2Weeks">Last 2 Weeks</SelectItem>
                            <SelectItem value="last3Weeks">Last 3 Weeks</SelectItem>
                            <div className="font-semibold text-xs text-slate-500 px-2 py-1 mt-1">MONTHLY</div>
                            <SelectItem value="current">This Month</SelectItem>
                            <SelectItem value="last">Last Month</SelectItem>
                            <SelectItem value="last2Months">Last 2 Months</SelectItem>
                            <SelectItem value="last3Months">Last 3 Months</SelectItem>
                            <SelectItem value="last6Months">Last 6 Months</SelectItem>
                            <SelectItem value="last12Months">Last 12 Months</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Labour Utilization Card */}
                <Card className="border-0 shadow-lg bg-white/95 lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <TrendingUp className="w-5 h-5 text-yellow-500" />
                            Labour Utilization
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-4xl font-bold text-slate-800">{utilization.toFixed(0)}%</div>
                                <div className="text-sm text-slate-500">Target 85%</div>
                            </div>
                            <div className="text-right text-sm text-slate-600">
                                <div>Utilized: {utilizedSum.toFixed(1)}h</div>
                                <div>Allocated: {allocatedSum.toFixed(1)}h</div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                <div className="text-green-700 font-medium">Productive Hours</div>
                                <div className="text-green-900 font-bold text-lg">
                                    {technicianEfficiency.reduce((sum, tech) => sum + (tech.productiveHours || 0), 0).toFixed(1)}h
                                </div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                <div className="text-red-700 font-medium">Non-Productive Hours</div>
                                <div className="text-red-900 font-bold text-lg">
                                    {technicianEfficiency.reduce((sum, tech) => sum + (tech.nonProductiveHours || 0), 0).toFixed(1)}h
                                </div>
                            </div>
                            {/* Add Normal & Overtime if needed */}
                        </div>

                        <div className="mt-4">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400" style={{ width: `${utilization}%` }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Efficiency Bar Chart */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <BarChart3 className="w-5 h-5 text-yellow-500" />
                            Efficiency by Technician
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {technicianEfficiency.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={technicianEfficiency} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="name" type="category" width={80} />
                                    <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Efficiency']} />
                                    <Bar dataKey="efficiency" fill="#facc15" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-slate-400">No data</div>
                        )}
                    </CardContent>
                </Card>

                {/* Job Status Pie */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <Award className="w-5 h-5 text-yellow-500" />
                            Job Status Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statusDistribution.length > 0 ? (
                            <div className="flex items-center">
                                <ResponsiveContainer width="60%" height={250}>
                                    <PieChart>
                                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value">
                                            {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-2 ml-4">
                                    {statusDistribution.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span>{item.name}</span>
                                            <Badge variant="outline" className="ml-auto">{item.value}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">No jobs found</div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Productivity */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <TrendingUp className="w-5 h-5 text-yellow-500" />
                            Daily Productivity (%)
                            {selectedTechnician === 'all' && <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullDate || l} />
                                    <Line type="monotone" dataKey="dailyProductivePercentage" stroke="#facc15" strokeWidth={3} dot={{ fill: '#facc15' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">No productivity data</div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Utilization */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Daily Utilization (%)
                            {selectedTechnician === 'all' && <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullDate || l} />
                                    <Line type="monotone" dataKey="dailyUtilizationPercentage" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">No utilization data</div>
                        )}
                    </CardContent>
                </Card>

                {/* Allocated vs Utilized Bar */}
                {selectedTechnician === 'all' && technicianEfficiency.length > 0 && (
                    <Card className="border-0 shadow-lg bg-white/95 lg:col-span-3">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                                <BarChart3 className="w-5 h-5 text-yellow-500" />
                                Hours: Allocated vs Utilized
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={technicianEfficiency}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="allocatedHours" name="Allocated Hours" fill="#3b82f6" />
                                    <Bar dataKey="utilizedHours" name="Utilized Hours" fill="#22c55e" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}``