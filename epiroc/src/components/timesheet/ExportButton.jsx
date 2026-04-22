import React from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExportButton({ entries, filename = "timesheet_export" }) {
    const exportToExcel = () => {
        if (!entries || entries.length === 0) {
            return;
        }

        const normalizeDateStr = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return String(d);
            return format(dt, 'yyyy-MM-dd');
        };

        const getDayStr = (d) => {
            try {
                return format(new Date(d), 'EEEE');
            } catch {
                return '';
            }
        };

        const workbook = XLSX.utils.book_new();

        // Sheet 1: All Entries
        const entriesData = entries.map(entry => ({
            'Technician': entry.technician_name,
            'Date': normalizeDateStr(entry.log_date),
            'Day': getDayStr(entry.log_date),
            'Job Number': entry.job_id || '',
            'Start Time': '',
            'End Time': '',
            'HR Hours': Number(entry.hours_logged || 0) || 0,
            'Productive Hours': entry.is_idle ? 0 : (Number(entry.hours_logged || 0) || 0),
            'Overtime Hours': Number(entry.overtime_hours || 0),
            'OT Rate': 1.5,
            'Weighted Overtime': Number(entry.overtime_hours || 0),
            'Notes': entry.notes || ''
        }));

        const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
        XLSX.utils.book_append_sheet(workbook, entriesSheet, 'All Entries');

        // Sheet 2: Summary by Technician
        const techSummary = {};
        entries.forEach(entry => {
            if (!techSummary[entry.technician_name]) {
                techSummary[entry.technician_name] = {
                    name: entry.technician_name,
                    totalEntries: 0,
                    hrHours: 0,
                    productiveHours: 0,
                    overtimeHours: 0,
                    weightedOvertime: 0
                };
            }
            techSummary[entry.technician_name].totalEntries++;
            techSummary[entry.technician_name].hrHours += Number(entry.hours_logged || 0) || 0;
            techSummary[entry.technician_name].productiveHours += entry.is_idle ? 0 : (Number(entry.hours_logged || 0) || 0);
            techSummary[entry.technician_name].overtimeHours += Number(entry.overtime_hours || 0);
            techSummary[entry.technician_name].weightedOvertime += Number(entry.overtime_hours || 0);
        });

        const summaryData = Object.values(techSummary).map(tech => ({
            'Technician': tech.name,
            'Total Entries': tech.totalEntries,
            'HR Hours': Math.round(tech.hrHours * 100) / 100,
            'Productive Hours': Math.round(tech.productiveHours * 100) / 100,
            'Overtime Hours': Math.round(tech.overtimeHours * 100) / 100,
            'Weighted Overtime': Math.round(tech.weightedOvertime * 100) / 100
        }));

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary by Technician');

        // Download
        XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <Button 
            onClick={exportToExcel}
            variant="outline"
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 h-10 px-4"
            disabled={!entries || entries.length === 0}
        >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
        </Button>
    );
}