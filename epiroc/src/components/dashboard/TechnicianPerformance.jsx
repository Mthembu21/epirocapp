import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Award } from 'lucide-react';

const HR_HOURS_PER_DAY = 8.5;
const PRODUCTIVE_HOURS_PER_DAY = 7.5;

const getPerformanceCategory = (efficiency) => {
    if (efficiency >= 95) return { label: 'Excellent', color: 'bg-green-100 text-green-700' };
    if (efficiency >= 85) return { label: 'Good', color: 'bg-blue-100 text-blue-700' };
    if (efficiency >= 70) return { label: 'Average', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700' };
};

export default function TechnicianPerformance({ technicians, jobs, timeEntries, month }) {
    const getStandardProductiveHoursForDate = (dateStr) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return 0;
        const dayIndex = d.getDay();
        if (dayIndex === 5) return 6;
        return 7;
    };

    // Calculate performance metrics for each technician
    const performanceData = technicians.map(tech => {
        // Get completed jobs for this technician
        const techJobs = jobs.filter(j => 
            j.assigned_technician_id === tech.id && 
            j.status === 'completed'
        );

        // Get time entries for this technician in the selected month
        const techEntries = timeEntries.filter(e => 
            e.technician_id === tech.id &&
            (month ? e.log_date?.startsWith(month) : true)
        );

        const totalAllocatedHours = techJobs.reduce((sum, j) => sum + (j.allocated_hours || 0), 0);
        const totalHours = techEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
        const totalOvertimeHours = techEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
        const productiveHours = techEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
        const nonProductiveHours = techEntries.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);

        const productivityRaw = totalHours > 0 ? (productiveHours / totalHours) * 100 : 0;
        const productivity = Math.max(0, Math.min(100, productivityRaw));

        const daily = new Map();
        for (const e of techEntries) {
            const dateKey = e?.log_date ? String(e.log_date).slice(0, 10) : '';
            if (!dateKey) continue;
            const prev = daily.get(dateKey) || { productive: 0, hr: 0 };
            prev.productive += (e.is_idle ? 0 : Number(e.hours_logged || 0));
            prev.hr += Number(e.hours_logged || 0);
            daily.set(dateKey, prev);
        }

        let availableProductive = 0;
        for (const [dateKey, v] of daily.entries()) {
            if ((v.hr || 0) > 0) {
                availableProductive += getStandardProductiveHoursForDate(dateKey);
            }
        }

        const utilizationRaw = availableProductive > 0 ? (productiveHours / availableProductive) * 100 : 0;
        const utilization = Math.max(0, Math.min(100, utilizationRaw));

        // Get total hours utilized from completed jobs
        const totalHoursUtilized = techJobs.reduce((sum, j) => 
            sum + (j.total_hours_utilized || j.consumed_hours || 0), 0
        );

        // Job Efficiency = (Allocated Hours / Hours Utilized) × 100
        const jobEfficiencyRaw = totalHoursUtilized > 0 
            ? (totalAllocatedHours / totalHoursUtilized) * 100 
            : 0;
        const jobEfficiency = Math.max(0, Math.min(100, jobEfficiencyRaw));

        const activeJobs = jobs.filter(j => 
            j.assigned_technician_id === tech.id && 
            ['active', 'in_progress'].includes(j.status)
        ).length;

        const jobsWithBottlenecks = jobs.filter(j => 
            j.assigned_technician_id === tech.id && 
            j.bottleneck_count > 0
        ).length;

        return {
            ...tech,
            completedJobs: techJobs.length,
            activeJobs,
            jobsWithBottlenecks,
            totalAllocatedHours,
            totalHours,
            totalOvertimeHours,
            productiveHours,
            nonProductiveHours,
            totalHoursUtilized,
            jobEfficiency,
            utilization,
            productivity,
            performance: getPerformanceCategory(jobEfficiency)
        };
    });

    return (
        <Card className="border-0 shadow-lg bg-white/95">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <TrendingUp className="w-5 h-5 text-yellow-500" />
                    Technician Performance Metrics
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead>Technician</TableHead>
                                <TableHead className="text-center">Active Jobs</TableHead>
                                <TableHead className="text-center">Completed</TableHead>
                                <TableHead className="text-center">Bottlenecks</TableHead>
                                <TableHead className="text-right">Total Hrs</TableHead>
                                <TableHead className="text-right">OT Hrs</TableHead>
                                <TableHead className="text-right">Prod Hrs</TableHead>
                                <TableHead className="text-right">Non-Prod</TableHead>
                                <TableHead className="text-right">Utilized</TableHead>
                                <TableHead className="text-right">Efficiency</TableHead>
                                <TableHead className="text-right">Utilization</TableHead>
                                <TableHead className="text-right">Productivity</TableHead>
                                <TableHead>Rating</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {performanceData.map((tech) => (
                                <TableRow key={tech.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{tech.name}</p>
                                            <p className="text-xs text-slate-500">{tech.employee_id}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-blue-50">
                                            {tech.activeJobs}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-green-50 text-green-700">
                                            {tech.completedJobs}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {tech.jobsWithBottlenecks > 0 ? (
                                            <Badge variant="outline" className="bg-red-50 text-red-700">
                                                {tech.jobsWithBottlenecks}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-slate-600">
                                        {tech.totalHours.toFixed(1)}h
                                    </TableCell>
                                    <TableCell className="text-right text-yellow-700">
                                        {tech.totalOvertimeHours.toFixed(1)}h
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {tech.productiveHours.toFixed(1)}h
                                    </TableCell>
                                    <TableCell className="text-right text-slate-600">
                                        {tech.nonProductiveHours.toFixed(1)}h
                                    </TableCell>
                                    <TableCell className="text-right text-purple-600 font-medium">
                                        {tech.totalHoursUtilized.toFixed(1)}h
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-blue-600">
                                        {tech.jobEfficiency.toFixed(0)}%
                                    </TableCell>
                                    <TableCell className="text-right text-slate-600">
                                        {tech.utilization.toFixed(0)}%
                                    </TableCell>
                                    <TableCell className="text-right text-slate-600">
                                        {tech.productivity.toFixed(0)}%
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={tech.performance.color}>
                                            {tech.performance.label}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}