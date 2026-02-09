import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

const WORKING_DAYS_PER_MONTH = 20;
const MONTH_START_DATE = '2026-02-02'; // February 2, 2026 (Sunday = day 0)

export default function MonthlyArchiveManager({ timeEntries, technicians }) {
    const queryClient = useQueryClient();

    const { workingDaysCount, shouldArchive } = useMemo(() => {
        // Count working days from start date
        const startDate = parseISO(MONTH_START_DATE);
        const today = new Date();

        // Count weekdays only (Mon-Fri)
        let count = 0;
        let currentDate = startDate;

        while (currentDate <= today) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
                count++;
            }
            currentDate = addDays(currentDate, 1);
        }

        return {
            workingDaysCount: count,
            shouldArchive: count >= WORKING_DAYS_PER_MONTH
        };
    }, []);

    const archiveMutation = useMutation({
        mutationFn: async () => {
            const startDate = parseISO(MONTH_START_DATE);
            const today = new Date();
            
            // Calculate totals
            const totalHRHours = timeEntries.reduce((sum, e) => sum + (e.hr_hours || 0), 0);
            const totalProductiveHours = timeEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0);
            const totalWeightedOT = timeEntries.reduce((sum, e) => sum + (e.weighted_overtime || 0), 0);
            
            // Calculate per technician
            const techniciansSummary = technicians.map(tech => {
                const techEntries = timeEntries.filter(e => e.technician_id === tech.id);
                return {
                    technician_id: tech.id,
                    technician_name: tech.name,
                    hr_hours: techEntries.reduce((sum, e) => sum + (e.hr_hours || 0), 0),
                    productive_hours: techEntries.reduce((sum, e) => sum + (e.productive_hours || 0), 0),
                    weighted_overtime: techEntries.reduce((sum, e) => sum + (e.weighted_overtime || 0), 0)
                };
            });
            
            // Create archive
            await base44.entities.MonthlyArchive.create({
                month_year: format(startDate, 'MMMM yyyy'),
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(today, 'yyyy-MM-dd'),
                working_days: workingDaysCount,
                total_hr_hours: totalHRHours,
                total_productive_hours: totalProductiveHours,
                total_weighted_overtime: totalWeightedOT,
                technicians_summary: techniciansSummary,
                archived_date: new Date().toISOString()
            });
            
            // Delete all time entries to reset the system
            for (const entry of timeEntries) {
                await base44.entities.DailyTimeEntry.delete(entry.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyTimeEntries'] });
            setShouldArchive(false);
            setWorkingDaysCount(0);
        }
    });

    if (!shouldArchive) {
        return (
            <Card className="border-0 bg-slate-800/60 backdrop-blur">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-slate-300">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <div>
                            <p className="text-sm font-medium">Working Days This Period</p>
                            <p className="text-xs text-slate-400">
                                {workingDaysCount} of {WORKING_DAYS_PER_MONTH} days (Mon-Fri)
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                    <AlertCircle className="w-5 h-5" />
                    Monthly Period Complete - Archive Required
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-slate-800 text-sm mb-4">
                    You have reached {workingDaysCount} working days. Archive this month's data and start fresh?
                </p>
                <Button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                >
                    <Archive className="w-4 h-4 mr-2" />
                    {archiveMutation.isPending ? 'Archiving...' : 'Archive & Reset for New Month'}
                </Button>
            </CardContent>
        </Card>
    );
}