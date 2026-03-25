import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { BarChart3, TrendingUp, Award, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isSameDay } from 'date-fns';

const COLORS = ['#facc15', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f97316'];

export default function PerformanceCharts({ technicians, jobs, timeEntries }) {
    const [selectedTechnician, setSelectedTechnician] = useState('all');
    const [timeRange, setTimeRange] = useState('current');
    const [monthlySummaries, setMonthlySummaries] = useState([]);

    // Fetch daily productive percentage data when time range or technicians change
    useEffect(() => {
        const fetchDailyProductivity = async () => {
            try {
                const { start, end } = getDateRange();
                const technicianIds = selectedTechnician === 'all' 
                    ? technicians.map(t => t.id) 
                    : [selectedTechnician];
                
                console.log('🔍 Fetching daily productivity:', {
                    selectedTechnician,
                    technicians: technicians.length,
                    technicianIds,
                    start,
                    end
                });
                
                const response = await fetch(`/api/time-entries/daily-productivity?start_date=${start.toISOString()}&end_date=${end.toISOString()}&technician_ids=${technicianIds.join(',')}`);
                
                console.log('🔍 API URL:', `/api/time-entries/daily-productivity?start_date=${start.toISOString()}&end_date=${end.toISOString()}&technician_ids=${technicianIds.join(',')}`);
                console.log('🔍 Response status:', response.status);
                console.log('🔍 Response ok:', response.ok);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('🔍 API Response Data:', data);
                    console.log('🔍 Data type:', typeof data);
                    console.log('🔍 Data keys:', Object.keys(data));
                    console.log('🔍 Data sample:', Object.values(data)[0]);
                    setMonthlySummaries(data); // Reusing state for daily productivity data
                } else {
                    console.error('🔍 API Response Error:', response.status, response.statusText);
                    // Try fallback to basic calculation if API fails
                    console.log('🔍 Using fallback calculation...');
                    const fallbackData = calculateFallbackDailyData();
                    setMonthlySummaries(fallbackData);
                }
            } catch (error) {
                console.error('🔍 Failed to fetch daily productivity data:', error);
                // Always provide fallback data
                const fallbackData = calculateFallbackDailyData();
                setMonthlySummaries(fallbackData);
            }
        };

        // Fallback calculation function
        const calculateFallbackDailyData = () => {
            console.log('🔍 Calculating fallback daily data from filteredEntries...');
            const { start, end } = getDateRange();
            
            if (selectedTechnician === 'all') {
                // For "all technicians", aggregate from filteredEntries
                const allDailyData = {};
                
                Object.values(monthlySummaries).forEach(techDailyData => {
                    if (Array.isArray(techDailyData)) {
                        techDailyData.forEach(dayData => {
                            const dateKey = format(dayData.date, 'yyyy-MM-dd');
                            if (!allDailyData[dateKey]) {
                                allDailyData[dateKey] = {
                                    date: dayData.date,
                                    totalHours: 0,
                                    productiveHours: 0,
                                    availableHours: 0,
                                    dailyProductivePercentage: 0,
                                    dailyUtilizationPercentage: 0,
                                    breakdown: {
                                        productivePercentage: 0,
                                        idlePercentage: 0,
                                        housekeepingPercentage: 0,
                                        trainingPercentage: 0
                                    }
                                };
                            }
                            // Use existing data if available
                            const day = allDailyData[dateKey];
                            day.totalHours += (dayData.totalHours || 0);
                            day.productiveHours += (dayData.productiveHours || 0);
                            day.availableHours += (dayData.availableHours || 0);
                            day.dailyProductivePercentage = Math.max(0, Math.min(100, dayData.dailyProductivePercentage || 0));
                            day.dailyUtilizationPercentage = Math.max(0, Math.min(100, dayData.dailyUtilizationPercentage || 0));
                            if (dayData.breakdown) {
                                day.breakdown.productivePercentage = Math.max(0, Math.min(100, dayData.breakdown.productivePercentage || 0));
                                day.breakdown.idlePercentage = Math.max(0, Math.min(100, dayData.breakdown.idlePercentage || 0));
                                day.breakdown.housekeepingPercentage = Math.max(0, Math.min(100, dayData.breakdown.housekeepingPercentage || 0));
                                day.breakdown.trainingPercentage = Math.max(0, Math.min(100, dayData.breakdown.trainingPercentage || 0));
                            }
                        });
                    }
                });
                
                const result = Object.values(allDailyData).filter(d => d.availableHours > 0);
                console.log('🔍 Fallback result:', result);
                return result;
            } else {
                // For specific technician, use their data directly
                const techDailyData = monthlySummaries[selectedTechnician];
                if (Array.isArray(techDailyData)) {
                    console.log('🔍 Using existing data for technician:', selectedTechnician, techDailyData);
                    return techDailyData.filter(d => d.availableHours > 0);
                }
            }
            
            // Final fallback - calculate from filteredEntries
            return eachDayOfInterval({ start, end }).map(day => {
                const dayEntries = filteredEntries.filter(e => e?.log_date && isSameDay(parseISO(e.log_date), day));
                
                const totalHours = dayEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
                const productiveHours = dayEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
                const availableHours = totalHours;
                
                return {
                    date: format(day, 'dd'),
                    fullDate: format(day, 'MMM dd'),
                    totalHours,
                    productiveHours,
                    availableHours,
                    dailyProductivePercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
                    dailyUtilizationPercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
                    breakdown: {
                        productivePercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
                        idlePercentage: 0,
                        housekeepingPercentage: 0,
                        trainingPercentage: 0
                    }
                };
            }).filter(d => d.availableHours > 0);
        };

        if (technicians.length > 0) {
            fetchDailyProductivity();
        }
    }, [timeRange, selectedTechnician, technicians]);

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
        const entryDate = e.log_date ? parseISO(e.log_date) : null;
        const inRange = entryDate && entryDate >= start && entryDate <= end;
        const techMatch = selectedTechnician === 'all' || e.technician_id === selectedTechnician;
        return inRange && techMatch;
    });

    const getStandardProductiveHoursForDate = (dateObj) => {
        const dayIndex = dateObj.getDay();
        if (dayIndex === 5) return 6;
        return 7;
    };

    const isTechOnJob = (job, techId) => {
        if (!job) return false;
        if ((job.technicians || []).some((t) => String(t?.technician_id) === String(techId))) return true;
        return (job.subtasks || []).some((st) => (st.assigned_technicians || []).some((a) => String(a?.technician_id) === String(techId)));
    };

    const filteredJobs = jobs.filter((j) => {
        const techMatch = selectedTechnician === 'all' || isTechOnJob(j, selectedTechnician);
        return techMatch;
    });

    const totalProductiveHours = filteredEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const totalNonProductiveHours = filteredEntries.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);
    const utilizationDenom = totalProductiveHours + totalNonProductiveHours;
    const utilizationRaw = utilizationDenom > 0 ? (totalProductiveHours / utilizationDenom) * 100 : 0;
    const utilization = Math.max(0, Math.min(100, utilizationRaw));

    // Calculate total utilized hours for display
    const utilizedSum = totalProductiveHours;

    // Calculate efficiency data per technician using monthly summaries when available
    const technicianEfficiency = technicians.map(tech => {
        const isTechOnJob = (job) => {
            if (!job) return false;
            if ((job.technicians || []).some((t) => String(t?.technician_id) === String(tech.id))) return true;
            return (job.subtasks || []).some((st) => (st.assigned_technicians || []).some((a) => String(a?.technician_id) === String(tech.id)));
        };

        const techJobs = filteredJobs.filter(j => isTechOnJob(j));
        const completedJobs = techJobs.filter(j => j.status === 'completed');
        const techEntries = filteredEntries.filter(e => e.technician_id === tech.id);

        // Try to get data from monthly summaries first
        const monthlySummary = monthlySummaries.find(summary => 
            summary.technician_id === tech.id
        );

        let totalProductiveHours, totalNonProductiveHours, totalOvertimeHours, totalNormalHours;
        
        if (monthlySummary) {
            // Use monthly summary data
            totalProductiveHours = monthlySummary.productive_hours || 0;
            totalNonProductiveHours = monthlySummary.non_productive_hours || 0;
            totalOvertimeHours = monthlySummary.overtime_hours || 0;
            totalNormalHours = monthlySummary.normal_hours || 0;
        } else {
            // Fall back to time entries calculation
            totalProductiveHours = techEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
            totalNonProductiveHours = techEntries.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);
            totalOvertimeHours = techEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
            totalNormalHours = techEntries.reduce((sum, e) => sum + (e.normal_hours || 0), 0);
        }

        const getAllocatedForTechOnJob = (job) => {
            const allocatedFromStages = (job?.subtasks || []).reduce((sum, st) => {
                const a = (st?.assigned_technicians || []).find((x) => String(x?.technician_id) === String(tech.id));
                return sum + Number(a?.allocated_hours || 0);
            }, 0);
            if (allocatedFromStages > 0) return allocatedFromStages;
            return Number(job?.allocated_hours || 0);
        };

        const totalAllocated = completedJobs.reduce((sum, j) => sum + getAllocatedForTechOnJob(j), 0);
        const totalUtilized = techEntries
            .filter((e) => !e.is_idle)
            .filter((e) => completedJobs.some((j) => String(j.job_number) === String(e.job_id)))
            .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);
        
        const efficiencyRaw = totalUtilized > 0 ? (totalAllocated / totalUtilized) * 100 : 0;
        const efficiency = Math.max(0, Math.min(100, efficiencyRaw));
        
        return {
            name: tech.name?.split(' ')[0] || 'Unknown',
            fullName: tech.name,
            efficiency,
            completedJobs: completedJobs.length,
            activeJobs: techJobs.filter(j => ['active', 'in_progress'].includes(j.status)).length,
            productiveHours: totalProductiveHours,
            nonProductiveHours: totalNonProductiveHours,
            overtimeHours: totalOvertimeHours,
            normalHours: totalNormalHours,
            allocatedHours: totalAllocated,
            utilizedHours: totalUtilized,
            utilizationRate: monthlySummary?.utilization_percentage || 0
        };
    }).filter(t => t.productiveHours > 0 || t.completedJobs > 0);

    // Calculate total allocated hours for display
    const allocatedSum = technicianEfficiency.reduce((sum, tech) => sum + tech.allocatedHours, 0);

    // Debug: Add logging to understand data flow
    console.log('🔍 DATA DEBUG:', {
        timeEntriesCount: timeEntries.length,
        filteredEntriesCount: filteredEntries.length,
        timeEntriesSample: timeEntries.slice(0, 3),
        filteredEntriesSample: filteredEntries.slice(0, 3),
        techniciansCount: technicians.length,
        selectedTechnician,
        dateRange: { start: getDateRange().start, end: getDateRange().end }
    });

    // Daily productivity data - using enhanced daily productive percentage API

    // Replace the entire dailyData useMemo with this:

const dailyData = useMemo(() => {
    console.log('🔍 Debug dailyData calculation:', {
        selectedTechnician,
        monthlySummariesLength: Array.isArray(monthlySummaries) ? monthlySummaries.length : 'not-array',
        filteredEntriesCount: filteredEntries.length
    });

    // 1. Prefer API data if available and not empty
    if (Array.isArray(monthlySummaries) && monthlySummaries.length > 0) {
        if (selectedTechnician === 'all') {
            // API returned array for "all" → use directly
            return monthlySummaries.map(day => ({
                date: format(new Date(day.date), 'dd'),
                fullDate: format(new Date(day.date), 'MMM dd'),
                totalHours: day.totalHours || 0,
                productiveHours: day.productiveHours || 0,
                availableHours: day.availableHours || 0,
                dailyProductivePercentage: Math.max(0, Math.min(100, day.dailyProductivePercentage || 0)),
                dailyUtilizationPercentage: Math.max(0, Math.min(100, day.dailyUtilizationPercentage || 0)),
                breakdown: day.breakdown || { productivePercentage: 0, idlePercentage: 0, housekeepingPercentage: 0, trainingPercentage: 0 },
                technicians: day.technicians || []
            })).filter(d => d.availableHours > 0);
        } else {
            // Single technician - API might return array or object
            const techData = Array.isArray(monthlySummaries) 
                ? monthlySummaries 
                : (monthlySummaries[selectedTechnician] || []);
            
            return techData.map(day => ({
                date: format(new Date(day.date), 'dd'),
                fullDate: format(new Date(day.date), 'MMM dd'),
                ...day,
                dailyProductivePercentage: Math.max(0, Math.min(100, day.dailyProductivePercentage || 0)),
                dailyUtilizationPercentage: Math.max(0, Math.min(100, day.dailyUtilizationPercentage || 0))
            })).filter(d => d.availableHours > 0);
        }
    }

    // 2. Fallback: calculate from filteredEntries (this is what was failing before)
    console.log('🔍 Using fallback from filteredEntries');

    if (selectedTechnician === 'all') {
        const allDailyData = {};

        filteredEntries.forEach(entry => {
            if (!entry?.log_date) return;
            
            const day = parseISO(entry.log_date);
            const dateKey = format(day, 'yyyy-MM-dd');

            if (!allDailyData[dateKey]) {
                allDailyData[dateKey] = {
                    date: format(day, 'dd'),
                    fullDate: format(day, 'MMM dd'),
                    totalHours: 0,
                    productiveHours: 0,
                    availableHours: 0,
                    dailyProductivePercentage: 0,
                    dailyUtilizationPercentage: 0,
                    breakdown: {
                        productivePercentage: 0,
                        idlePercentage: 0,
                        housekeepingPercentage: 0,
                        trainingPercentage: 0
                    },
                    technicians: []
                };
            }

            const dayObj = allDailyData[dateKey];
            const hours = entry.hours_logged || 0;
            const isProductive = !entry.is_idle;

            dayObj.totalHours += hours;
            dayObj.productiveHours += isProductive ? hours : 0;
            dayObj.availableHours += hours;
        });

        const result = Object.values(allDailyData)
            .filter(d => d.availableHours > 0)
            .map(d => ({
                ...d,
                dailyProductivePercentage: d.availableHours > 0 
                    ? Math.round((d.productiveHours / d.availableHours) * 100) 
                    : 0,
                dailyUtilizationPercentage: d.availableHours > 0 
                    ? Math.round((d.productiveHours / d.availableHours) * 100) 
                    : 0,
            }))
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

        console.log('🔍 Final fallback result for "all":', result);
        return result;
    } 
    else {
        // Single technician fallback
        const techEntries = filteredEntries.filter(e => e.technician_id === selectedTechnician);
        const dailyMap = {};

        techEntries.forEach(entry => {
            if (!entry?.log_date) return;
            const day = parseISO(entry.log_date);
            const dateKey = format(day, 'yyyy-MM-dd');

            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = {
                    date: format(day, 'dd'),
                    fullDate: format(day, 'MMM dd'),
                    totalHours: 0,
                    productiveHours: 0,
                    availableHours: 0,
                    dailyProductivePercentage: 0,
                    dailyUtilizationPercentage: 0,
                    breakdown: { productivePercentage: 0, idlePercentage: 0, housekeepingPercentage: 0, trainingPercentage: 0 }
                };
            }

            const dayObj = dailyMap[dateKey];
            const hours = entry.hours_logged || 0;
            dayObj.totalHours += hours;
            dayObj.productiveHours += entry.is_idle ? 0 : hours;
            dayObj.availableHours += hours;
        });

        return Object.values(dailyMap)
            .filter(d => d.availableHours > 0)
            .map(d => ({
                ...d,
                dailyProductivePercentage: d.availableHours > 0 ? Math.round((d.productiveHours / d.availableHours) * 100) : 0,
                dailyUtilizationPercentage: d.availableHours > 0 ? Math.round((d.productiveHours / d.availableHours) * 100) : 0,
            }))
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    }
}, [monthlySummaries, selectedTechnician, filteredEntries, start, end]);
    // const dailyData = useMemo(() => {
    //     console.log('🔍 Debug dailyData calculation:', {
    //         selectedTechnician,
    //         monthlySummaries,
    //         monthlySummariesKeys: Object.keys(monthlySummaries),
    //         monthlySummariesValues: Object.values(monthlySummaries),
    //         filteredEntriesCount: filteredEntries.length,
    //         dateRange: { start: getDateRange().start, end: getDateRange().end }
    //     });

    //                             productivePercentage: 0,
    //                             idlePercentage: 0,
    //                             housekeepingPercentage: 0,
    //                             trainingPercentage: 0
    //                         },
    //                         technicians: [] // Store per-technician breakdown
    //                     };
    //                 }

    //                 // Store technician breakdown for tooltips
    //                 if (!technicianBreakdowns[dateKey]) {
    //                     technicianBreakdowns[dateKey] = [];
    //                 }
    //                 technicianBreakdowns[dateKey].push({
    //                     technicianId: techId,
    //                     productiveHours: dayData.productiveHours || 0,
    //                     availableHours: dayData.availableHours || 0,
    //                     dailyProductivePercentage: dayData.dailyProductivePercentage || 0,
    //                     dailyUtilizationPercentage: dayData.dailyUtilizationPercentage || 0,
    //                     breakdown: dayData.breakdown || {
    //                         productivePercentage: 0,
    //                         idlePercentage: 0,
    //                         housekeepingPercentage: 0,
    //                         trainingPercentage: 0
    //                     }
    //                 });

    //                 // Aggregate all fields
    //                 const day = allDailyData[dateKey];
    //                 day.totalHours += (dayData.totalHours || 0);
    //                 day.productiveHours += (dayData.productiveHours || 0);
    //                 day.availableHours += (dayData.availableHours || 0);
    //                 day.unavailableHours += (dayData.unavailableHours || 0);
    //                 day.utilizationLossHours += (dayData.utilizationLossHours || 0);
    //                 day.trainingHours += (dayData.trainingHours || 0);
    //                 day.idleHours += (dayData.idleHours || 0);
    //                 day.housekeepingHours += (dayData.housekeepingHours || 0);
    //             });
    //             // Calculate percentage breakdowns for tooltip
    //             const productivePercentage = day.availableHours > 0 ? (day.productiveHours / day.availableHours) * 100 : 0;
    //             const idlePercentage = day.availableHours > 0 ? (day.idleHours / day.availableHours) * 100 : 0;
    //             const housekeepingPercentage = day.availableHours > 0 ? (day.housekeepingHours / day.availableHours) * 100 : 0;
    //             const trainingPercentage = day.totalHours > 0 ? (day.trainingHours / day.totalHours) * 100 : 0;
                
    //             const dateKey = format(day.date, 'yyyy-MM-dd');
                
    //             return {
    //                 date: format(day.date, 'dd'),
    //                 fullDate: format(day.date, 'MMM dd'),
    //                 totalHours: day.totalHours,
    //                 productiveHours: day.productiveHours,
    //                 availableHours: day.availableHours,
    //                 dailyProductivePercentage: Math.max(0, Math.min(100, overallProductivity)),
    //                 dailyUtilizationPercentage: Math.max(0, Math.min(100, overallUtilization)),
    //                 breakdown: {
    //                     productivePercentage: Math.max(0, Math.min(100, productivePercentage)),
    //                     idlePercentage: Math.max(0, Math.min(100, idlePercentage)),
    //                     housekeepingPercentage: Math.max(0, Math.min(100, housekeepingPercentage)),
    //                     trainingPercentage: Math.max(0, Math.min(100, trainingPercentage))
    //                 },
    //                 technicians: technicianBreakdowns[dateKey] || [] // Per-technician breakdown for tooltips
    //             };
    //         }).filter(d => d.availableHours > 0);
            
    //         console.log('🔍 Final result for "all":', result);
    //         return result;
    //     } else {
    //         // For specific technician, use their data directly
    //         const techDailyData = monthlySummaries[selectedTechnician];
    //         if (Array.isArray(techDailyData)) {
    //             return techDailyData.map(dayData => ({
    //                 date: format(dayData.date, 'dd'),
    //                 fullDate: format(dayData.date, 'MMM dd'),
    //                 totalHours: dayData.totalHours || 0,
    //                 productiveHours: dayData.productiveHours || 0,
    //                 availableHours: dayData.availableHours || 0,
    //                 dailyProductivePercentage: Math.max(0, Math.min(100, dayData.dailyProductivePercentage || 0)),
    //                 dailyUtilizationPercentage: Math.max(0, Math.min(100, dayData.dailyUtilizationPercentage || 0)),
    //                 breakdown: dayData.breakdown || {
    //                     productivePercentage: 0,
    //                     idlePercentage: 0,
    //                     housekeepingPercentage: 0,
    //                     trainingPercentage: 0
    //                 }
    //             })).filter(d => d.availableHours > 0);
    //         }
    //     }
        
    //     // Fallback to original calculation if no new data available
    //     return eachDayOfInterval({ start, end }).map(day => {
    //         const dayEntries = filteredEntries.filter(e => e?.log_date && isSameDay(parseISO(e.log_date), day));
            
    //         const totalHours = dayEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    //         const productiveHours = dayEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    //         const availableHours = totalHours; // Fallback - no categorization
            
    //         return {
    //             date: format(day, 'dd'),
    //             fullDate: format(day, 'MMM dd'),
    //             totalHours,
    //             productiveHours,
    //             availableHours,
    //             dailyProductivePercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
    //             dailyUtilizationPercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
    //             breakdown: {
    //                 productivePercentage: availableHours > 0 ? (productiveHours / availableHours) * 100 : 0,
    //                 idlePercentage: 0,
    //                 housekeepingPercentage: 0,
    //                 trainingPercentage: 0
    //             }
    //         };
    //     }).filter(d => d.availableHours > 0);
    // }, [monthlySummaries, selectedTechnician, filteredEntries, start, end]);

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
        
        const techJobs = jobs.filter(j => isTechOnJob(j, techId));
        const completedJobs = techJobs.filter(j => j.status === 'completed');
        const techEntries = timeEntries.filter(e => e.technician_id === techId);

        const getAllocatedForTechOnJob = (job) => {
            const allocatedFromStages = (job?.subtasks || []).reduce((sum, st) => {
                const a = (st?.assigned_technicians || []).find((x) => String(x?.technician_id) === String(techId));
                return sum + Number(a?.allocated_hours || 0);
            }, 0);
            if (allocatedFromStages > 0) return allocatedFromStages;
            return Number(job?.allocated_hours || 0);
        };

        const totalAllocated = completedJobs.reduce((sum, j) => sum + getAllocatedForTechOnJob(j), 0);
        const totalUtilized = techEntries
            .filter((e) => !e.is_idle)
            .filter((e) => completedJobs.some((j) => String(j.job_number) === String(e.job_id)))
            .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);
        const totalProductiveHours = techEntries.reduce((sum, e) => sum + (e.is_idle ? 0 : Number(e.hours_logged || 0)), 0);
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        
                        {/* Detailed hours breakdown */}
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
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div className="text-blue-700 font-medium">Normal Hours</div>
                                <div className="text-blue-900 font-bold text-lg">
                                    {technicianEfficiency.reduce((sum, tech) => sum + (tech.normalHours || 0), 0).toFixed(1)}h
                                </div>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                <div className="text-amber-700 font-medium">Overtime Hours</div>
                                <div className="text-amber-900 font-bold text-lg">
                                    {technicianEfficiency.reduce((sum, tech) => sum + (tech.overtimeHours || 0), 0).toFixed(1)}h
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400" style={{ width: `${utilization}%` }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
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
                            Daily Productivity (%)
                            {selectedTechnician === 'all' && (
                                <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis 
                                        tick={{ fill: '#64748b', fontSize: 12 }} 
                                        domain={[0, 100]}
                                        label={{ value: 'Productivity %', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip 
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                                        formatter={(value, name, props) => {
                                            const data = props?.payload;
                                            if (data && data.breakdown) {
                                                return [
                                                    `${data.dailyProductivePercentage.toFixed(1)}%`,
                                                    'Productivity (%)'
                                                ];
                                            }
                                            return [value, name];
                                        }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-sm">
                                                        <div className="font-semibold text-gray-800 mb-2">
                                                            {data.fullDate || label}
                                                        </div>
                                                        <div className="text-sm space-y-1">
                                                            <div className="font-medium text-green-700">
                                                                Overall Productivity: {data.dailyProductivePercentage.toFixed(1)}%
                                                            </div>
                                                            <div className="text-gray-600 text-xs mb-2">Breakdown:</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                <div className="text-green-600">
                                                                    • Productive: {data.breakdown?.productivePercentage.toFixed(1)}%
                                                                </div>
                                                                <div className="text-red-600">
                                                                    • Idle Time: {data.breakdown?.idlePercentage.toFixed(1)}%
                                                                </div>
                                                                <div className="text-orange-600">
                                                                    • Housekeeping: {data.breakdown?.housekeepingPercentage.toFixed(1)}%
                                                                </div>
                                                                <div className="text-blue-600">
                                                                    • Training: {data.breakdown?.trainingPercentage.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                                                Available: {data.availableHours.toFixed(1)}h | Productive: {data.productiveHours.toFixed(1)}h
                                                            </div>
                                                            {selectedTechnician === 'all' && data.technicians && data.technicians.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-gray-200">
                                                                    <div className="text-xs text-gray-600 mb-1">Per-Technician Breakdown:</div>
                                                                    <div className="space-y-1 max-h-20 overflow-y-auto">
                                                                        {data.technicians.map((tech, index) => {
                                                                            const techName = technicians.find(t => t.id === tech.technicianId)?.name || tech.technicianId;
                                                                            return (
                                                                                <div key={index} className="text-xs text-gray-700 flex justify-between">
                                                                                    <span className="truncate">{techName}:</span>
                                                                                    <span>{tech.dailyProductivePercentage.toFixed(1)}%</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="dailyProductivePercentage" 
                                        stroke="#facc15" 
                                        strokeWidth={3}
                                        dot={{ fill: '#facc15', strokeWidth: 2 }}
                                        name="Productivity (%)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">
                                No productivity data for selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Utilization Line Chart */}
                <Card className="border-0 shadow-lg bg-white/95">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            Daily Utilization (%)
                            {selectedTechnician === 'all' && (
                                <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis 
                                        tick={{ fill: '#64748b', fontSize: 12 }} 
                                        domain={[0, 100]}
                                        label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip 
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                                        formatter={(value, name, props) => {
                                            const data = props?.payload;
                                            if (data && data.breakdown) {
                                                return [
                                                    `${data.dailyUtilizationPercentage.toFixed(1)}%`,
                                                    'Utilization (%)'
                                                ];
                                            }
                                            return [value, name];
                                        }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 max-w-sm">
                                                        <div className="font-semibold text-gray-800 mb-2">
                                                            {data.fullDate || label}
                                                        </div>
                                                        <div className="text-sm space-y-1">
                                                            <div className="font-medium text-blue-700">
                                                                Overall Utilization: {data.dailyUtilizationPercentage.toFixed(1)}%
                                                            </div>
                                                            <div className="text-gray-600 text-xs mb-2">Breakdown:</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                <div className="text-green-600">
                                                                    • Productive: {data.breakdown?.productivePercentage.toFixed(1)}%
                                                                </div>
                                                                <div className="text-red-600">
                                                                    • Loss Hours: {(data.breakdown?.idlePercentage + data.breakdown?.housekeepingPercentage).toFixed(1)}%
                                                                </div>
                                                                <div className="text-blue-600">
                                                                    • Training: {data.breakdown?.trainingPercentage.toFixed(1)}%
                                                                </div>
                                                                <div className="text-gray-600">
                                                                    • Available: {data.availableHours.toFixed(1)}h
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                                                Total Hours: {data.totalHours.toFixed(1)}h | Productive: {data.productiveHours.toFixed(1)}h
                                                            </div>
                                                            {selectedTechnician === 'all' && data.technicians && data.technicians.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-gray-200">
                                                                    <div className="text-xs text-gray-600 mb-1">Per-Technician Breakdown:</div>
                                                                    <div className="space-y-1 max-h-20 overflow-y-auto">
                                                                        {data.technicians.map((tech, index) => {
                                                                            const techName = technicians.find(t => t.id === tech.technicianId)?.name || tech.technicianId;
                                                                            return (
                                                                                <div key={index} className="text-xs text-gray-700 flex justify-between">
                                                                                    <span className="truncate">{techName}:</span>
                                                                                    <span>{tech.dailyUtilizationPercentage.toFixed(1)}%</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="dailyUtilizationPercentage" 
                                        stroke="#3b82f6" 
                                        strokeWidth={3}
                                        dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                                        name="Utilization (%)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-slate-400">
                                No utilization data for selected period
                            </div>
                        )}
                    </CardContent>
                </div>

            {/* Hours Comparison - Moved up for better layout */}
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

            {/* Individual Performance Radar - Temporarily Commented Out */}
            {/* <Card className="border-0 shadow-lg bg-white/95">
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
                </Card> */}
        </div>
    );
};