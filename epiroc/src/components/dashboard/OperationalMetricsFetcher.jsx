import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/apiClient';

export default function OperationalMetricsFetcher({ technicians, onOperationalMetricsUpdate }) {
    const [monthlySummaries, setMonthlySummaries] = useState([]);

    useEffect(() => {
        const fetchOperationalMetrics = async () => {
            try {
                const dateRange = format(new Date(), 'yyyy-MM');
                console.log('OperationalMetricsFetcher: Fetching data for dateRange:', dateRange, 'techId: all');
                
                // Use the same API client as Dashboard
                const data = await base44.entities.Utilization.daily('all', dateRange);
                console.log('OperationalMetricsFetcher: Raw API response:', data);
                console.log('OperationalMetricsFetcher: Data type:', typeof data);
                console.log('OperationalMetricsFetcher: Is array?', Array.isArray(data));
                
                // Normalize to always be an array
                const dataArray = Array.isArray(data) ? data : [];
                console.log('OperationalMetricsFetcher: Normalized data array length:', dataArray.length);
                console.log('OperationalMetricsFetcher: Sample data item:', dataArray[0]);
                console.log('OperationalMetricsFetcher: onOperationalMetricsUpdate exists?', !!onOperationalMetricsUpdate);
                setMonthlySummaries(dataArray);
                
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
