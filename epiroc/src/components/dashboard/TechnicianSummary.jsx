import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Calendar, Clock } from 'lucide-react';

export default function TechnicianSummary({ technicians, entries }) {
    const [searchDate, setSearchDate] = useState('');
    const [searchName, setSearchName] = useState('');

    // Calculate totals per technician
    const technicianStats = technicians.map(tech => {
        const techEntries = entries.filter(e => e.technician_id === tech.id);
        const totalHours = techEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
        const normalHours = techEntries.reduce((sum, e) => sum + (e.normal_hours || 0), 0);
        const overtimeHours = techEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
        const weightedOT = techEntries.reduce((sum, e) => sum + (e.weighted_overtime || 0), 0);

        return {
            ...tech,
            entries: techEntries,
            totalEntries: techEntries.length,
            totalHours: Math.round(totalHours * 100) / 100,
            normalHours: Math.round(normalHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            weightedOT: Math.round(weightedOT * 100) / 100
        };
    });

    // Filter by search criteria
    let filteredStats = technicianStats;

    if (searchName) {
        filteredStats = filteredStats.filter(tech => 
            tech.name.toLowerCase().includes(searchName.toLowerCase())
        );
    }

    if (searchDate) {
        filteredStats = filteredStats.filter(tech => {
            const hasEntryOnDate = tech.entries.some(e => e.date === searchDate);
            return hasEntryOnDate;
        });
    }

    // Get entries for selected date
    const getEntriesForDate = (tech) => {
        if (!searchDate) return null;
        return tech.entries.find(e => e.date === searchDate);
    };

    return (
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Users className="w-5 h-5 text-yellow-500" />
                    Technician Overview
                </CardTitle>
                
                {/* Search Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search by name..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="date"
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="pl-10 w-full sm:w-48"
                            placeholder="Filter by date"
                        />
                    </div>
                    {searchDate && (
                        <button 
                            onClick={() => setSearchDate('')}
                            className="text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                            Clear date
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {filteredStats.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No technicians found</p>
                        {searchDate && <p className="text-sm">No one worked on this date</p>}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-800 hover:bg-slate-800">
                                    <TableHead className="text-white font-semibold">Technician</TableHead>
                                    <TableHead className="text-white font-semibold">Department</TableHead>
                                    <TableHead className="text-white font-semibold text-right">Entries</TableHead>
                                    <TableHead className="text-white font-semibold text-right">Total Hours</TableHead>
                                    <TableHead className="text-white font-semibold text-right">Normal Hours</TableHead>
                                    <TableHead className="text-white font-semibold text-right">OT Hours</TableHead>
                                    <TableHead className="text-white font-semibold text-right">Weighted OT</TableHead>
                                    {searchDate && (
                                        <TableHead className="text-white font-semibold">Hours on {format(parseISO(searchDate), 'dd MMM')}</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStats.map((tech) => {
                                    const dateEntry = getEntriesForDate(tech);
                                    return (
                                        <TableRow key={tech.id} className="hover:bg-yellow-50/50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-slate-800 font-bold text-sm">
                                                        {tech.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800">{tech.name}</p>
                                                        {tech.employee_id && (
                                                            <p className="text-xs text-slate-500">{tech.employee_id}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-slate-50">
                                                    {tech.department || 'General'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{tech.totalEntries}</TableCell>
                                            <TableCell className="text-right font-semibold text-slate-800">{tech.totalHours}h</TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">{tech.normalHours}h</TableCell>
                                            <TableCell className="text-right text-amber-600 font-medium">{tech.overtimeHours}h</TableCell>
                                            <TableCell className="text-right text-yellow-600 font-semibold">{tech.weightedOT}h</TableCell>
                                            {searchDate && (
                                                <TableCell>
                                                    {dateEntry ? (
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-green-500" />
                                                            <span className="text-sm">
                                                                {dateEntry.start_time} - {dateEntry.end_time}
                                                                <span className="text-slate-500 ml-2">({dateEntry.total_hours}h)</span>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">Not working</span>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}