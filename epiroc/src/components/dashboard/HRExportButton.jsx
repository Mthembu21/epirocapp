import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const HR_HOURS_PER_DAY = 8.5;

export default function HRExportButton({ timeEntries, technicians }) {
    const exportHRData = () => {
        const wb = XLSX.utils.book_new();

        const getDayStr = (d) => {
            try {
                return format(new Date(d), 'EEE');
            } catch {
                return '';
            }
        };

        const normalizeDateStr = (d) => {
            if (!d) return '';
            // TimeLog uses log_date; sometimes serialized as ISO string
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return String(d);
            return format(dt, 'yyyy-MM-dd');
        };

        // Sheet 1: Attendance Records
        const attendanceData = timeEntries.map(entry => ({
            'Date': normalizeDateStr(entry.log_date),
            'Day': getDayStr(entry.log_date),
            'Technician': entry.technician_name,
            'Start Time': '',
            'End Time': '',
            'HR Hours': Number(entry.hours_logged || 0) || HR_HOURS_PER_DAY,
            'Overtime Hours': Number(entry.overtime_hours || 0),
            'Overtime Rate': 1.5,
            'Weighted Overtime': Number(entry.overtime_hours || 0),
            'Total Payable Hours': (Number(entry.hours_logged || 0) || HR_HOURS_PER_DAY) + Number(entry.overtime_hours || 0)
        }));
        
        const attendanceSheet = XLSX.utils.json_to_sheet(attendanceData);
        XLSX.utils.book_append_sheet(wb, attendanceSheet, 'Attendance Records');

        // Sheet 2: Payroll Summary by Technician
        const techSummary = technicians.map(tech => {
            const techEntries = timeEntries.filter(e => e.technician_id === tech.id);
            const totalHRHours = techEntries.reduce((sum, e) => sum + (Number(e.hours_logged || 0) || HR_HOURS_PER_DAY), 0);
            const totalOvertimeHours = techEntries.reduce((sum, e) => sum + Number(e.overtime_hours || 0), 0);
            const totalWeightedOT = totalOvertimeHours;
            const daysWorked = techEntries.length;

            return {
                'Employee ID': tech.employee_id,
                'Technician Name': tech.name,
                'Department': tech.department || '-',
                'Days Worked': daysWorked,
                'Total HR Hours': totalHRHours.toFixed(1),
                'Total Overtime Hours': totalOvertimeHours.toFixed(1),
                'Total Weighted Overtime': totalWeightedOT.toFixed(1),
                'Total Payable Hours': (totalHRHours + totalWeightedOT).toFixed(1)
            };
        });

        const summarySheet = XLSX.utils.json_to_sheet(techSummary);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Payroll Summary');

        // Sheet 3: Monthly Summary
        const monthlyData = {};
        timeEntries.forEach(entry => {
            const d = normalizeDateStr(entry.log_date);
            const month = d ? d.substring(0, 7) : '';
            if (!monthlyData[month]) {
                monthlyData[month] = {
                    totalHRHours: 0,
                    totalOvertimeHours: 0,
                    totalWeightedOT: 0,
                    daysWorked: 0
                };
            }
            monthlyData[month].totalHRHours += (Number(entry.hours_logged || 0) || HR_HOURS_PER_DAY);
            monthlyData[month].totalOvertimeHours += Number(entry.overtime_hours || 0);
            monthlyData[month].totalWeightedOT += Number(entry.overtime_hours || 0);
            monthlyData[month].daysWorked += 1;
        });

        const monthlySummary = Object.entries(monthlyData).map(([month, data]) => ({
            'Month': month,
            'Total Days': data.daysWorked,
            'Total HR Hours': data.totalHRHours.toFixed(1),
            'Total Overtime': data.totalOvertimeHours.toFixed(1),
            'Total Weighted OT': data.totalWeightedOT.toFixed(1),
            'Total Payable': (data.totalHRHours + data.totalWeightedOT).toFixed(1)
        }));

        const monthlySheet = XLSX.utils.json_to_sheet(monthlySummary);
        XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Summary');

        // Download
        XLSX.writeFile(wb, `HR_Payroll_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <Button 
            onClick={exportHRData} 
            variant="outline" 
            className="border-green-500 text-green-700 hover:bg-green-50 h-10 px-4"
            disabled={!timeEntries || timeEntries.length === 0}
        >
            <Download className="w-4 h-4 mr-2" />
            Export HR Data
        </Button>
    );
}