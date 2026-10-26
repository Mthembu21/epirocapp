import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { appliedRateFor } from '@/utils/overtime';

const HR_HOURS_PER_DAY = 8.5;

// Pay figures for one entry: overtime hours weighted at the day's rate (1.5x Mon-Sat,
// 2x Sunday/public holiday), and payable = normal hours + weighted overtime. Overtime
// is part of the hours worked, so it isn't added on top of them a second time.
const payFor = (entry) => {
    const hrHours = Number(entry.hours_logged || 0) || HR_HOURS_PER_DAY;
    const overtime = Number(entry.overtime_hours || 0);
    const rate = appliedRateFor(entry);
    const weightedOvertime = overtime * rate;
    return { hrHours, overtime, rate, weightedOvertime, payable: Math.max(0, hrHours - overtime) + weightedOvertime };
};
const IDLE_JOB_ID = 'IDLE / NON-PRODUCTIVE';

// An approved entry's hours: what the supervisor approved, falling back to what was
// logged for older entries approved before approved_hours was recorded (same rule
// the backend's job progress uses).
const approvedHoursOf = (entry) => (Number(entry.approved_hours) > 0
    ? Number(entry.approved_hours)
    : Number(entry.hours_logged || 0));

// A booking against a real job (not idle/leave/training/site work logged without a job number).
const isApprovedJobBooking = (entry) => !entry.is_idle
    && entry.job_id
    && String(entry.job_id) !== IDLE_JOB_ID
    && entry.approval_status === 'approved'
    && approvedHoursOf(entry) > 0;

export default function HRExportButton({ timeEntries, technicians, loadEntries }) {
    const [isExporting, setIsExporting] = useState(false);

    const exportHRData = async () => {
        setIsExporting(true);
        let entries = timeEntries || [];
        try {
            if (loadEntries) entries = await loadEntries();
            // The automatic daily allocation (meetings & breaks) belongs in non-productive
            // reporting only, not in attendance/payroll hours.
            entries = (entries || []).filter((e) => !e.system_generated);
        } catch (e) {
            alert(`Could not load all time entries for this period: ${e?.message || 'Unknown error'}`);
            setIsExporting(false);
            return;
        }

        const techById = (technicians || []).reduce((acc, t) => {
            const id = String(t?.id || t?._id || t?.technician_id || '');
            if (id) acc[id] = t;
            return acc;
        }, {});
        const techIdOf = (entry) => String(entry.technician_id?._id || entry.technician_id || '');
        const techNameOf = (entry) => entry.technician_name
            || techById[techIdOf(entry)]?.name
            || entry.technician_id?.name
            || techIdOf(entry);

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
        const attendanceData = entries.map(entry => {
            const pay = payFor(entry);
            return {
                'Date': normalizeDateStr(entry.log_date),
                'Day': getDayStr(entry.log_date),
                'Technician': techNameOf(entry),
                'Start Time': '',
                'End Time': '',
                'HR Hours': pay.hrHours,
                'Overtime Hours': pay.overtime,
                'Overtime Rate': pay.rate,
                'Weighted Overtime': pay.weightedOvertime,
                'Total Payable Hours': pay.payable
            };
        });

        const attendanceSheet = XLSX.utils.json_to_sheet(attendanceData);
        XLSX.utils.book_append_sheet(wb, attendanceSheet, 'Attendance Records');

        // Sheet 2: Payroll Summary by Technician
        const techSummary = (technicians || []).map(tech => {
            const techEntries = entries.filter(e => techIdOf(e) === String(tech.id));
            const totalHRHours = techEntries.reduce((sum, e) => sum + payFor(e).hrHours, 0);
            const totalOvertimeHours = techEntries.reduce((sum, e) => sum + payFor(e).overtime, 0);
            const totalWeightedOT = techEntries.reduce((sum, e) => sum + payFor(e).weightedOvertime, 0);
            const totalPayable = techEntries.reduce((sum, e) => sum + payFor(e).payable, 0);
            const daysWorked = techEntries.length;

            return {
                'Employee ID': tech.employee_id,
                'Technician Name': tech.name,
                'Department': tech.department || '-',
                'Days Worked': daysWorked,
                'Total HR Hours': totalHRHours.toFixed(1),
                'Total Overtime Hours': totalOvertimeHours.toFixed(1),
                'Total Weighted Overtime': totalWeightedOT.toFixed(1),
                'Total Payable Hours': totalPayable.toFixed(1)
            };
        });

        const summarySheet = XLSX.utils.json_to_sheet(techSummary);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Payroll Summary');

        // Sheet 3: Monthly Summary
        const monthlyData = {};
        entries.forEach(entry => {
            const d = normalizeDateStr(entry.log_date);
            const month = d ? d.substring(0, 7) : '';
            if (!monthlyData[month]) {
                monthlyData[month] = {
                    totalHRHours: 0,
                    totalOvertimeHours: 0,
                    totalWeightedOT: 0,
                    totalPayable: 0,
                    daysWorked: 0
                };
            }
            const pay = payFor(entry);
            monthlyData[month].totalHRHours += pay.hrHours;
            monthlyData[month].totalOvertimeHours += pay.overtime;
            monthlyData[month].totalWeightedOT += pay.weightedOvertime;
            monthlyData[month].totalPayable += pay.payable;
            monthlyData[month].daysWorked += 1;
        });

        const monthlySummary = Object.entries(monthlyData).map(([month, data]) => ({
            'Month': month,
            'Total Days': data.daysWorked,
            'Total HR Hours': data.totalHRHours.toFixed(1),
            'Total Overtime': data.totalOvertimeHours.toFixed(1),
            'Total Weighted OT': data.totalWeightedOT.toFixed(1),
            'Total Payable': data.totalPayable.toFixed(1)
        }));

        const monthlySheet = XLSX.utils.json_to_sheet(monthlySummary);
        XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Summary');

        // Sheet 4: Job Bookings — every approved booking against a job
        const bookings = entries
            .filter(isApprovedJobBooking)
            .map(entry => ({
                name: techNameOf(entry),
                employeeId: techById[techIdOf(entry)]?.employee_id || '',
                date: normalizeDateStr(entry.log_date),
                day: getDayStr(entry.log_date),
                job: String(entry.job_id),
                stage: entry.subtask_title || '',
                hours: approvedHoursOf(entry),
                overtime: Number(entry.overtime_hours || 0),
                approvedBy: entry.approved_by || '',
                approvedAt: entry.approved_at ? normalizeDateStr(entry.approved_at) : ''
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date) || a.job.localeCompare(b.job));

        const bookingHeaders = ['Technician', 'Employee ID', 'Date', 'Day', 'Job Number', 'Stage', 'Approved Hours', 'Overtime Hours', 'Approved By', 'Approved On'];
        const bookingsSheet = bookings.length > 0
            ? XLSX.utils.json_to_sheet(bookings.map(b => ({
                'Technician': b.name,
                'Employee ID': b.employeeId,
                'Date': b.date,
                'Day': b.day,
                'Job Number': b.job,
                'Stage': b.stage,
                'Approved Hours': Math.round(b.hours * 100) / 100,
                'Overtime Hours': Math.round(b.overtime * 100) / 100,
                'Approved By': b.approvedBy,
                'Approved On': b.approvedAt
            })))
            : XLSX.utils.aoa_to_sheet([bookingHeaders]);
        XLSX.utils.book_append_sheet(wb, bookingsSheet, 'Job Bookings');

        // Sheet 5: Job Hours Summary — approved hours per technician per job
        const byTechJob = {};
        bookings.forEach(b => {
            const key = `${b.name}|${b.job}`;
            if (!byTechJob[key]) byTechJob[key] = { name: b.name, employeeId: b.employeeId, job: b.job, days: new Set(), hours: 0, overtime: 0 };
            byTechJob[key].days.add(b.date);
            byTechJob[key].hours += b.hours;
            byTechJob[key].overtime += b.overtime;
        });
        const jobSummaryHeaders = ['Technician', 'Employee ID', 'Job Number', 'Days Booked', 'Approved Hours', 'Overtime Hours'];
        const jobSummaryRows = Object.values(byTechJob)
            .sort((a, b) => a.name.localeCompare(b.name) || a.job.localeCompare(b.job))
            .map(r => ({
                'Technician': r.name,
                'Employee ID': r.employeeId,
                'Job Number': r.job,
                'Days Booked': r.days.size,
                'Approved Hours': Math.round(r.hours * 100) / 100,
                'Overtime Hours': Math.round(r.overtime * 100) / 100
            }));
        const jobSummarySheet = jobSummaryRows.length > 0
            ? XLSX.utils.json_to_sheet(jobSummaryRows)
            : XLSX.utils.aoa_to_sheet([jobSummaryHeaders]);
        XLSX.utils.book_append_sheet(wb, jobSummarySheet, 'Job Hours Summary');

        // Download
        XLSX.writeFile(wb, `HR_Payroll_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        setIsExporting(false);
    };

    return (
        <Button
            onClick={exportHRData}
            variant="outline"
            className="border-green-500 text-green-700 hover:bg-green-50 h-10 px-4"
            disabled={isExporting || ((!timeEntries || timeEntries.length === 0) && !loadEntries)}
        >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export HR Data'}
        </Button>
    );
}
