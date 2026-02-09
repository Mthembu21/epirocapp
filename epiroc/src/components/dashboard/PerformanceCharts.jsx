import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { BarChart3, TrendingUp, Award, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';

const COLORS = ['#facc15', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f97316'];

export default function PerformanceCharts({ technicians, jobs, timeEntries }) {
    const [selectedTechnician, setSelectedTechnician] = useState('all');
    const [timeRange, setTimeRange] = useState('current');

    const getDateRange = () => {
        const now = new Date();
        if (timeRange === 'current') {
            return { start: startOfMonth(now), end: endOfMonth(now) };
        } else if (timeRange === 'last') {
            const lastMonth = subMonths(now, 1);
            return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        } else {
            return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
        }
    };

    const { start, end } = getDateRange();

    // Filter data based on selection
    const filteredEntries = timeEntries.filter(e => {
        const entryDate = e.date ? parseISO(e.date) : null;
        const inRange = entryDate && entryDate >= start && entryDate <= end;
        const techMatch = selectedTechnician === 'all' || e.technician_id === selectedTechnician;
        return inRange && techMatch;
    });

    const filteredJobs = jobs.filter(j => {
        const techMatch = selectedTechnician === 'all' || j.assigned_technician_id === selectedTechnician;
        return techMatch;
    });

    // Calculate efficiency data per technician
    const technicianEfficiency = technicians.map(tech => {
        const techJobs = filteredJobs.filter(j => j.assigned_technician_id === tech.id);
        const completedJobs = techJobs.filter(j => j.status === 'completed');
        const techEntries = filteredEntries.filter(e => e.technician_id === tech.id);
        
        const totalAllocated = completedJobs.reduce((sum, j) => sum + (j.allocated_hours || 0), 0);
        const totalUtilized = completedJobs.reduce((sum, j) => sum + (j.total_hours_utilized || j.consumed_hours || 0), 0);
        const totalProductiveHours = techEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0);
        
        const efficiency = totalUtilized > 0 ? (totalAllocated / totalUtilized) * 100 : 0;
        
        return {
            name: tech.name?.split(' ')[0] || 'Unknown',
            fullName: tech.name,
            efficiency: Math.min(efficiency, 150),
            completedJobs: completedJobs.length,
            activeJobs: techJobs.filter(j => ['active', 'in_progress'].includes(j.status)).length,
            productiveHours: totalProductiveHours,
            allocatedHours: totalAllocated,
            utilizedHours: totalUtilized
        };
    }).filter(t => t.productiveHours > 0 || t.completedJobs > 0);

    // Daily productivity data
    const dailyData = eachDayOfInterval({ start, end }).map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayEntries = filteredEntries.filter(e => e.date === dayStr);
        
        return {
            date: format(day, 'dd'),
            fullDate: format(day, 'MMM dd'),
            productiveHours: dayEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0),
            entries: dayEntries.length
        };
    }).filter(d => d.productiveHours > 0);

    // Job status distribution
    const statusDistribution = [
        { name: 'Completed', value: filteredJobs.filter(j => j.status === 'completed').length, color: '#22c55e' },
        { name: 'In Progress', value: filteredJobs.filter(j => ['active', 'in_progress'].includes(j.status)).length, color: '#3b82f6' },
        { name: 'At Risk', value: filteredJobs.filter(j => j.status === 'at_risk').length, color: '#ef4444' },
        { name: 'Pending', value: filteredJobs.filter(j => j.status === 'pending_confirmation').length, color: '#94a3b8' }
    ].filter(s => s.value > 0);

    // Individual technician radar data
    const getRadarData = (techId) => {
        const tech = technicians.find(t => t.id === techId);
        if (!tech) return [];
        
        const techJobs = jobs.filter(j => j.assigned_technician_id === techId);
        const completedJobs = techJobs.filter(j => j.status === 'completed');
        const techEntries = timeEntries.filter(e => e.technician_id === techId);
        
        const totalAllocated = completedJobs.reduce((sum, j) => sum + (j.allocated_hours || 0), 0);
        const totalUtilized = completedJobs.reduce((sum, j) => sum + (j.total_hours_utilized || j.consumed_hours || 0), 0);
        const totalProductiveHours = techEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0);
        const bottlenecks = techJobs.reduce((sum, j) => sum + (j.bottleneck_count || 0), 0);
        
        const efficiency = totalUtilized > 0 ? Math.min((totalAllocated / totalUtilized) * 100, 100) : 0;
        const completion = techJobs.length > 0 ? (completedJobs.length / techJobs.length) * 100 : 0;
        const reliability = techJobs.length > 0 ? Math.max(0, 100 - (bottlenecks / techJobs.length) * 20) : 100;
        
        return [
            { metric: 'Efficiency', value: efficiency, fullMark: 100 },
            { metric: 'Completion', value: completion, fullMark: 100 },
            { metric: 'Reliability', value: reliability, fullMark: 100 },
            { metric: 'Jobs Done', value: Math.min(completedJobs.length * 10, 100), fullMark: 100 },
            { metric: 'Hours Logged', value: Math.min(totalProductiveHours, 100), fullMark: 100 }
        ];
    };

    const selectedTechData = selectedTechnician !== 'all' ? getRadarData(selectedTechnician) : [];

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
                        <SelectTrigger className="w-40 bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current">This Month</SelectItem>
                            <SelectItem value="last">Last Month</SelectItem>
                            <SelectItem value="quarter">Last 3 Months</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Efficiency Comparison Bar Chart */}
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
                                    <XAxis type="number" domain={[0, 150]} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value) => [`${value.toFixed(1)}%`, 'Efficiency']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar 
                                        dataKey="efficiency" 
                                        fill="#facc15" 
                                        radius={[0, 4, 4, 0]}
                                        label={{ position: 'right', fill: '#64748b', fontSize: 11, formatter: (v) => `${v.toFixed(0)}%` }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-slate-400">
                                No data available for selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Job Status Distribution */}
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
                                        <Pie
                                            data={statusDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statusDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-2">
                                    {statusDistribution.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm text-slate-600">{item.name}</span>
                                            <Badge variant="outline" className="ml-auto">{item.value}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">
                                No jobs found
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Productivity Line Chart */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <TrendingUp className="w-5 h-5 text-yellow-500" />
                            Daily Productive Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip 
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="productiveHours" 
                                        stroke="#facc15" 
                                        strokeWidth={3}
                                        dot={{ fill: '#facc15', strokeWidth: 2 }}
                                        name="Productive Hours"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">
                                No time entries for selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Individual Performance Radar */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <Award className="w-5 h-5 text-yellow-500" />
                            Individual Performance Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {selectedTechnician !== 'all' && selectedTechData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={selectedTechData}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <Radar
                                        name="Performance"
                                        dataKey="value"
                                        stroke="#facc15"
                                        fill="#facc15"
                                        fillOpacity={0.5}
                                    />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">
                                Select a technician to view individual performance
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Hours Comparison */}
            {selectedTechnician === 'all' && technicianEfficiency.length > 0 && (
                <Card className="border-0 shadow-lg bg-white/95">
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
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="allocatedHours" name="Allocated Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="utilizedHours" name="Utilized Hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}