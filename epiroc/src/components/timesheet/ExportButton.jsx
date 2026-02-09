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

        const workbook = XLSX.utils.book_new();

        // Sheet 1: All Entries
        const entriesData = entries.map(entry => ({
            'Technician': entry.technician_name,
            'Date': entry.date,
            'Day': entry.day_of_week,
            'Job Number': entry.job_number || '',
            'Start Time': entry.start_time,
            'End Time': entry.end_time,
            'HR Hours': entry.hr_hours || 8.5,
            'Productive Hours': entry.productive_hours || 7.5,
            'Overtime Hours': entry.overtime_hours || 0,
            'OT Rate': entry.overtime_rate || 1.5,
            'Weighted Overtime': entry.weighted_overtime || 0,
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
            techSummary[entry.technician_name].hrHours += entry.hr_hours || 8.5;
            techSummary[entry.technician_name].productiveHours += entry.productive_hours || 7.5;
            techSummary[entry.technician_name].overtimeHours += entry.overtime_hours || 0;
            techSummary[entry.technician_name].weightedOvertime += entry.weighted_overtime || 0;
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
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
            disabled={!entries || entries.length === 0}
        >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
        </Button>
    );
}