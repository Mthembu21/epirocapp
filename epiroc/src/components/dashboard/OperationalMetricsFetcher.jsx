import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/apiClient';

export default function OperationalMetricsFetcher({ technicians, onOperationalMetricsUpdate, onMonthlySummariesUpdate }) {
    const [monthlySummaries, setMonthlySummaries] = useState([]);

    useEffect(() => {
        const fetchOperationalMetrics = async () => {
            try {
                const dateRange = format(new Date(), 'yyyy-MM');
                console.log('OperationalMetricsFetcher: Fetching data for dateRange:', dateRange, 'techId: all');
                
                // Use existing working API calls instead of failing utilization endpoint
                // Get daily time entries which we know work
                const timeEntries = await base44.entities.DailyTimeEntry.list('-log_date', 500);
                console.log('OperationalMetricsFetcher: Using timeEntries data instead:', timeEntries.length, 'items');
                
                // Filter entries for current month and calculate metrics
                const currentMonthEntries = timeEntries.filter(entry => {
                    const entryDate = new Date(entry.log_date);
                    const entryMonth = format(entryDate, 'yyyy-MM');
                    return entryMonth === dateRange;
                });
                
                console.log('OperationalMetricsFetcher: Current month entries:', currentMonthEntries.length);
                
                // Convert time entries to utilization format
                const aggregatedData = currentMonthEntries.reduce((acc, entry) => {
                    const dateKey = format(new Date(entry.log_date), 'yyyy-MM-dd');
                    if (!acc[dateKey]) {
                        acc[dateKey] = {
                            date: dateKey,
                            productiveHours: 0,
                            nonProductiveHours: 0,
                            idleHours: 0,
                            notAvailableHours: 0,
                            totalHours: 0
                        };
                    }
                    
                    const day = acc[dateKey];
                    day.totalHours += Number(entry.hours_logged || 0);
                    
                    if (entry.is_idle) {
                        day.idleHours += Number(entry.hours_logged || 0);
                    } else if (entry.is_productive === false) {
                        day.nonProductiveHours += Number(entry.hours_logged || 0);
                    } else {
                        day.productiveHours += Number(entry.hours_logged || 0);
                    }
                    
                    return acc;
                }, {});
                
                const data = Object.values(aggregatedData);
                console.log('OperationalMetricsFetcher: Processed utilization data:', data);
                console.log('OperationalMetricsFetcher: Data type:', typeof data);
                console.log('OperationalMetricsFetcher: Is array?', Array.isArray(data));
                
                // Normalize to always be an array
                const dataArray = Array.isArray(data) ? data : [];
                console.log('OperationalMetricsFetcher: Normalized data array length:', dataArray.length);
                console.log('OperationalMetricsFetcher: Sample data item:', dataArray[0]);
                console.log('OperationalMetricsFetcher: onOperationalMetricsUpdate exists?', !!onOperationalMetricsUpdate);
                console.log('OperationalMetricsFetcher: onMonthlySummariesUpdate exists?', !!onMonthlySummariesUpdate);
                setMonthlySummaries(dataArray);
                
                // Update Dashboard with monthly summaries for charts
                if (onMonthlySummariesUpdate) {
                    console.log('OperationalMetricsFetcher: Calling onMonthlySummariesUpdate callback with', dataArray.length, 'items');
                    onMonthlySummariesUpdate(dataArray);
                }
                
                // Calculate operational metrics and share with Dashboard
                if (onOperationalMetricsUpdate && dataArray.length > 0) {
                    console.log('OperationalMetricsFetcher: Processing operational metrics from', dataArray.length, 'items');
                    
                    const aggregateMetrics = dataArray.reduce((acc, day) => {
                        acc.productiveHours += day.productiveHours || 0;
                        acc.nonProductiveHours += day.nonProductiveHours || 0;
                        acc.idleHours += day.idleHours || 0;
                        acc.notAvailableHours += day.notAvailableHours || 0;
                        acc.totalContractedHours += day.totalHours || 0;
                        return acc;
                    }, {
                        productiveHours: 0,
                        nonProductiveHours: 0,
                        idleHours: 0,
                        notAvailableHours: 0,
                        totalContractedHours: 0
                    });
                    
                    // Calculate final percentages using new operational formulas
                    const adjustedAvailableHours = aggregateMetrics.totalContractedHours - aggregateMetrics.notAvailableHours;
                    const utilization = adjustedAvailableHours > 0 ? (aggregateMetrics.productiveHours / adjustedAvailableHours) * 100 : 0;
                    const workingHours = aggregateMetrics.productiveHours + aggregateMetrics.nonProductiveHours;
                    const productivity = workingHours > 0 ? (aggregateMetrics.productiveHours / workingHours) * 100 : 0;
                    const idlePercentage = adjustedAvailableHours > 0 ? (aggregateMetrics.idleHours / adjustedAvailableHours) * 100 : 0;
                    
                    const metrics = {
                        utilization,
                        productivity,
                        idlePercentage,
                        ...aggregateMetrics
                    };
                    
                    console.log('OperationalMetricsFetcher: Calculated operational metrics:', metrics);
                    console.log('OperationalMetricsFetcher: Calling onOperationalMetricsUpdate callback');
                    
                    onOperationalMetricsUpdate(metrics);
                } else {
                    console.log('OperationalMetricsFetcher: No data or callback available');
                }
            } catch (error) {
                console.error('OperationalMetricsFetcher: Failed to fetch daily productivity:', error);
                console.error('OperationalMetricsFetcher: Error details:', error.message);
            }
        };

        if (technicians.length > 0) {
            fetchOperationalMetrics();
        }
    }, [technicians, onOperationalMetricsUpdate]);

    // This component doesn't render anything visible
    return null;
}
