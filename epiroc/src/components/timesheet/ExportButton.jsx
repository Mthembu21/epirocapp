import React from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// Mirrors TimeLog.determineTimeCategory on the backend: these categories are
// either productive (Site Work) or not-available (Leave/Sick/Team Building),
// so they never count as non-productive time.
const EXCLUDED_NON_PRODUCTIVE_CATEGORIES = ['Site Work', 'Leave', 'Sick', 'Team Building'];
const NON_PRODUCTIVE_CATEGORIES = ['Training', 'Housekeeping', 'Admin', 'Waiting for Parts'];

const isNonProductiveEntry = (entry) => {
    if (entry.is_leave || EXCLUDED_NON_PRODUCTIVE_CATEGORIES.includes(entry.category)) return false;
    if (['non_productive', 'idle'].includes(entry.time_category)) return true;
    return !!entry.is_idle || NON_PRODUCTIVE_CATEGORIES.includes(entry.category);
};

// Housekeeping is logged as category 'Idle' with sub-reason 'Housekeeping'
// (or as the legacy 'Housekeeping' category), so surface it as its own type.
const getNonProductiveType = (entry) => {
    if (entry.category === 'Idle') {
        return entry.category_detail === 'Housekeeping' ? 'Housekeeping' : 'Idle';
    }
    return entry.category || 'Idle';
};

export default function ExportButton({ entries, technicians = [], filename = "timesheet_export" }) {
    const exportToExcel = () => {
        if (!entries || entries.length === 0) {
            return;
        }

        const technicianNameById = (technicians || []).reduce((acc, t) => {
            const id = String(t?.id || t?._id || t?.technician_id || '');
            if (id) acc[id] = t?.name || t?.technician_name || acc[id];
            return acc;
        }, {});
        const getTechnicianName = (entry) => entry.technician_name
            || technicianNameById[String(entry.technician_id?._id || entry.technician_id || '')]
            || entry.technician_id?.name
            || String(entry.technician_id || '');

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

        // Sheet 1: Non-Productive Hours (Idle, Training, Housekeeping, etc.)
        const nonProductiveEntries = entries
            .filter(isNonProductiveEntry)
            .map(entry => ({
                name: getTechnicianName(entry),
                date: normalizeDateStr(entry.log_date),
                day: getDayStr(entry.log_date),
                type: getNonProductiveType(entry),
                reason: entry.category_detail || '',
                hours: Number(entry.hours_logged || 0) || 0,
                notes: entry.category_note || entry.notes || ''
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date));

        const nonProductiveData = nonProductiveEntries.map(e => ({
            'Technician': e.name,
            'Date': e.date,
            'Day': e.day,
            'Non-Productive Type': e.type,
            'Reason': e.reason,
            'Hours': Math.round(e.hours * 100) / 100,
            'Notes': e.notes
        }));
        const nonProductiveSheet = nonProductiveData.length > 0
            ? XLSX.utils.json_to_sheet(nonProductiveData)
            : XLSX.utils.aoa_to_sheet([['Technician', 'Date', 'Day', 'Non-Productive Type', 'Reason', 'Hours', 'Notes']]);
        XLSX.utils.book_append_sheet(workbook, nonProductiveSheet, 'Non-Productive Hours');

        // Sheet 2: Non-Productive Summary — hours per technician, one column per type
        const npTypes = [...new Set(['Idle', 'Training', 'Housekeeping', ...nonProductiveEntries.map(e => e.type)])];
        const npByTech = {};
        nonProductiveEntries.forEach(e => {
            if (!npByTech[e.name]) npByTech[e.name] = { total: 0 };
            npByTech[e.name][e.type] = (npByTech[e.name][e.type] || 0) + e.hours;
            npByTech[e.name].total += e.hours;
        });
        const npSummaryData = Object.entries(npByTech)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, totals]) => ({
                'Technician': name,
                ...Object.fromEntries(npTypes.map(t => [`${t} Hours`, Math.round((totals[t] || 0) * 100) / 100])),
                'Total Non-Productive Hours': Math.round(totals.total * 100) / 100
            }));
        const npSummarySheet = npSummaryData.length > 0
            ? XLSX.utils.json_to_sheet(npSummaryData)
            : XLSX.utils.aoa_to_sheet([['Technician', ...npTypes.map(t => `${t} Hours`), 'Total Non-Productive Hours']]);
        XLSX.utils.book_append_sheet(workbook, npSummarySheet, 'Non-Productive Summary');

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