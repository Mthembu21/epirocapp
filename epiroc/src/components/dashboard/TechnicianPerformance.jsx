import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Award } from 'lucide-react';
import { clampPercent } from '@/utils/kpiUtils';


const getPerformanceCategory = (efficiency) => {
    if (efficiency >= 95) return { label: 'Excellent', color: 'bg-green-100 text-green-700' };
    if (efficiency >= 85) return { label: 'Good', color: 'bg-blue-100 text-blue-700' };
    if (efficiency >= 70) return { label: 'Average', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Needs Improvement', color: 'bg-red-100 text-red-700' };
};

export default function TechnicianPerformance({ technicians = [], kpiData = {} }) {
    // Component expects kpiData from backend with pre-calculated KPIs
    // Do not calculate KPIs in frontend - all calculations must come from backend

    const performanceData = technicians.map(tech => {
        const techKPI = kpiData[tech.id] || {};

        return {
            ...tech,
            jobsWithBottlenecks: 0,
            activeJobs: techKPI.active_jobs || 0,
            completedJobs: techKPI.completed_jobs || 0,
            totalAllocatedHours: techKPI.total_allocated_hours || 0,
            totalHours: techKPI.total_hours || 0,
            totalOvertimeHours: techKPI.total_overtime_hours || 0,
            productiveHours: techKPI.total_productive_hours || 0,
            nonProductiveHours: techKPI.total_non_productive_hours || 0,
            totalHoursUtilized: techKPI.total_hours_utilized || 0,
            jobEfficiency: techKPI.efficiency_percent || 0,
            utilization: techKPI.utilization_percent || 0,
            productivity: techKPI.productivity_percent || 0,
            performance: getPerformanceCategory(techKPI.efficiency_percent || 0)
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
                                        {clampPercent(tech.utilization).toFixed(0)}%
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