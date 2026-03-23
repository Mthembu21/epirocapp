import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO, addDays, isValid, endOfMonth } from 'date-fns';

export default function MonthlyArchiveManager({ timeEntries, technicians }) {
    const queryClient = useQueryClient();

    const tenantKey = useMemo(() => {
        try {
            const raw = localStorage.getItem('epiroc_user');
            const u = raw ? JSON.parse(raw) : null;
            return u?.supervisor_key || u?.supervisorKey || 'component';
        } catch {
            return 'component';
        }
    }, []);

    const periodStartStorageKey = useMemo(() => `monthlyArchive.periodStart.${tenantKey}`, [tenantKey]);
    const dismissedStorageKey = useMemo(() => `monthlyArchive.dismissedPeriodStart.${tenantKey}`, [tenantKey]);

    const initialPeriodStart = useMemo(() => {
        try {
            const stored = localStorage.getItem(periodStartStorageKey);
            if (stored) return stored;
            return format(new Date(), 'yyyy-MM-dd');
        } catch {
            return format(new Date(), 'yyyy-MM-dd');
        }
    }, [periodStartStorageKey]);

    const [periodStartDate, setPeriodStartDate] = useState(initialPeriodStart);

    const initialDismissed = useMemo(() => {
        try {
            return (localStorage.getItem(dismissedStorageKey) || '') === initialPeriodStart;
        } catch {
            return false;
        }
    }, [dismissedStorageKey, initialPeriodStart]);

    const [dismissed, setDismissed] = useState(initialDismissed);

    const normalizedPeriodStart = useMemo(() => {
        const d = parseISO(periodStartDate);
        return isValid(d) ? d : new Date();
    }, [periodStartDate]);

    const periodEntries = useMemo(() => {
        const start = normalizedPeriodStart;
        return (timeEntries || []).filter((e) => {
            if (!e?.log_date) return false;
            const d = parseISO(e.log_date);
            if (!isValid(d)) return false;
            return d >= start;
        });
    }, [timeEntries, normalizedPeriodStart]);

    const { calendarDaysCount, calendarDaysInMonth, shouldArchive } = useMemo(() => {
        const startDate = normalizedPeriodStart;
        const today = new Date();
        const monthEnd = endOfMonth(startDate);

        const end = today < monthEnd ? today : monthEnd;

        let count = 0;
        let currentDate = startDate;
        while (currentDate <= end) {
            count++;
            currentDate = addDays(currentDate, 1);
        }

        const dim = monthEnd.getDate();

        return {
            calendarDaysCount: count,
            calendarDaysInMonth: dim,
            shouldArchive: today >= monthEnd
        };
    }, [normalizedPeriodStart]);

    const { todayDayOfMonth, todayDaysInMonth } = useMemo(() => {
        const today = new Date();
        const dim = endOfMonth(today).getDate();
        return {
            todayDayOfMonth: Math.min(today.getDate(), dim),
            todayDaysInMonth: dim
        };
    }, []);

    const archiveMutation = useMutation({
        mutationFn: async () => {
            const startDate = normalizedPeriodStart;
            const today = new Date();
            
            // Calculate totals
            const totalHRHours = periodEntries.reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);
            const totalProductiveHours = periodEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : Number(e.hours_logged || 0)), 0);
            const totalWeightedOT = periodEntries.reduce((sum, e) => sum + Number(e.overtime_hours || 0), 0);
            
            // Calculate per technician
            const techniciansSummary = technicians.map(tech => {
                const techEntries = periodEntries.filter(e => e.technician_id === tech.id);
                return {
                    technician_id: tech.id,
                    technician_name: tech.name,
                    hr_hours: techEntries.reduce((sum, e) => sum + Number(e.hours_logged || 0), 0),
                    productive_hours: techEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : Number(e.hours_logged || 0)), 0),
                    weighted_overtime: techEntries.reduce((sum, e) => sum + Number(e.overtime_hours || 0), 0)
                };
            });
            
            // Create archive
            await base44.entities.MonthlyArchive.create({
                month_year: format(startDate, 'MMMM yyyy'),
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(today, 'yyyy-MM-dd'),
                working_days: calendarDaysCount,
                total_hr_hours: totalHRHours,
                total_productive_hours: totalProductiveHours,
                total_weighted_overtime: totalWeightedOT,
                technicians_summary: techniciansSummary,
                archived_date: new Date().toISOString()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });

            // Start a new period from today (the archive day is the first day of the next 20-day cycle)
            const nextStart = format(new Date(), 'yyyy-MM-dd');
            try {
                localStorage.setItem(periodStartStorageKey, nextStart);
                localStorage.removeItem(dismissedStorageKey);
            } catch {
                // ignore
            }
            setPeriodStartDate(nextStart);
            setDismissed(false);
        },
        onError: () => {
            // If archive fails, show the popup again
            try {
                localStorage.removeItem(dismissedStorageKey);
            } catch {
                // ignore
            }
            setDismissed(false);
        }
    });

    const showArchive = shouldArchive && !dismissed;

    if (!showArchive) {
        return (
            <Card className="border-0 bg-slate-800/60 backdrop-blur">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-slate-300">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <div>
                            <p className="text-sm font-medium">Working Days This Period</p>
                            <p className="text-xs text-slate-400">
                                {todayDayOfMonth} of {todayDaysInMonth} days
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
                    You have reached the end of the month. Archive this month's data and start fresh?
                </p>
                <Button
                    onClick={() => {
                        // Dismiss immediately (and persist) as soon as the user presses the button
                        try {
                            localStorage.setItem(dismissedStorageKey, periodStartDate);
                        } catch {
                            // ignore
                        }
                        setDismissed(true);
                        archiveMutation.mutate();
                    }}
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