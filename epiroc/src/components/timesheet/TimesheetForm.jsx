import React, { useState, useEffect } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Save, Calculator } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NORMAL_HOURS = 8.5;

export default function TimesheetForm({ technicians, onSubmit, isSubmitting }) {
    const [formData, setFormData] = useState({
        technician_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '17:00',
        notes: ''
    });

    const [calculations, setCalculations] = useState({
        dayOfWeek: '',
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        overtimeRate: 1.5,
        weightedOvertime: 0
    });

    useEffect(() => {
        calculateHours();
    }, [formData.date, formData.start_time, formData.end_time]);

    const calculateHours = () => {
        const { date, start_time, end_time } = formData;
        
        if (!date || !start_time || !end_time) return;

        const dayIndex = getDay(parseISO(date));
        const dayOfWeek = DAYS[dayIndex];
        
        // Calculate total hours
        const [startH, startM] = start_time.split(':').map(Number);
        const [endH, endM] = end_time.split(':').map(Number);
        
        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
        
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        
        // Determine overtime rate based on day
        let overtimeRate;
        if (dayIndex === 0) { // Sunday
            overtimeRate = 2;
        } else { // Weekdays and Saturday
            overtimeRate = 1.5;
        }

        // Calculate normal and overtime hours
        let normalHours, overtimeHours;
        
        if (dayIndex === 0) { // Sunday - all hours are overtime at 2x
            normalHours = 0;
            overtimeHours = totalHours;
        } else {
            normalHours = Math.min(totalHours, NORMAL_HOURS);
            overtimeHours = Math.max(0, totalHours - NORMAL_HOURS);
        }

        const weightedOvertime = Math.round(overtimeHours * overtimeRate * 100) / 100;

        setCalculations({
            dayOfWeek,
            totalHours,
            normalHours: Math.round(normalHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            overtimeRate,
            weightedOvertime
        });
    };

    useEffect(() => {
        calculateHours();
    }, [formData.date, formData.start_time, formData.end_time, calculateHours]);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const selectedTech = technicians.find(t => t.id === formData.technician_id);
        
        onSubmit({
            ...formData,
            technician_name: selectedTech?.name || '',
            day_of_week: calculations.dayOfWeek,
            total_hours: calculations.totalHours,
            normal_hours: calculations.normalHours,
            overtime_hours: calculations.overtimeHours,
            overtime_rate: calculations.overtimeRate,
            weighted_overtime: calculations.weightedOvertime
        });

        // Reset form
        setFormData(prev => ({
            ...prev,
            technician_id: '',
            notes: ''
        }));
    };

    return (
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    Log Timesheet Entry
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="technician">Technician</Label>
                            <Select
                                value={formData.technician_id}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, technician_id: value }))}
                            >
                                <SelectTrigger className="border-slate-300">
                                    <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.map(tech => (
                                        <SelectItem key={tech.id} value={tech.id}>
                                            {tech.name} {tech.employee_id && `(${tech.employee_id})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input
                                type="date"
                                id="date"
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="border-slate-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="start_time">Start Time</Label>
                            <Input
                                type="time"
                                id="start_time"
                                value={formData.start_time}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                className="border-slate-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="end_time">End Time</Label>
                            <Input
                                type="time"
                                id="end_time"
                                value={formData.end_time}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                className="border-slate-300"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Any additional notes..."
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="h-20 border-slate-300"
                        />
                    </div>

                    {/* Calculations Preview */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-3">
                            <Calculator className="w-4 h-4 text-yellow-400" />
                            <span className="font-medium text-white">Calculated Hours</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Day</p>
                                <p className="font-semibold text-white">{calculations.dayOfWeek || '-'}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Total Hours</p>
                                <p className="font-semibold text-white">{calculations.totalHours}h</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Normal Hours</p>
                                <p className="font-semibold text-green-400">{calculations.normalHours}h</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Overtime</p>
                                <p className="font-semibold text-amber-400">{calculations.overtimeHours}h</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Weighted OT ({calculations.overtimeRate}x)</p>
                                <p className="font-semibold text-yellow-400">{calculations.weightedOvertime}h</p>
                            </div>
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold"
                        disabled={!formData.technician_id || isSubmitting}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Saving...' : 'Save Entry'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}