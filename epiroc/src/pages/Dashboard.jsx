import React, { useState } from 'react';
import epirocLogo from '../assets/epirocLogo.png';
import { base44 } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Trash2, Edit2, Save, X, CheckCircle, AlertTriangle, Plus, Wrench, LogOut, Briefcase, TrendingUp, Pencil, Award, ClipboardList, Printer } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addDays } from 'date-fns';

import StatsCard from '../components/timesheet/StatsCard';
import ExportButton from '../components/timesheet/ExportButton';
import TechnicianModal from '../components/technician/TechnicianModal';
import GlobalTechnicianSelector from '../components/technician/GlobalTechnicianSelector';
import TechnicianList from '../components/technician/TechnicianList';
import JobAllocationModal from '../components/jobs/JobAllocationModal';
import JobList from '../components/jobs/JobList';
import AtRiskJobs from '../components/jobs/AtRiskJobs';
import TechnicianPerformance from '@/components/dashboard/TechnicianPerformance';
import TechnicianActivityLog from '@/components/dashboard/TechnicianActivityLog';
import OperationalMetricsFetcher from '@/components/dashboard/OperationalMetricsFetcher';
import PerformanceCharts from '../components/dashboard/PerformanceCharts';
import HRExportButton from '../components/dashboard/HRExportButton';
import WeeklyExecutiveReport from '../components/dashboard/WeeklyExecutiveReport';
import MonthlyArchiveManager from '../components/dashboard/MonthlyArchiveManager';
import ManagementKPIHeader from '@/components/kpi/ManagementKPIHeader.jsx';
import DateRangeFilter from '@/components/filters/DateRangeFilter.jsx';
import AlertsList from '@/components/alerts/AlertsList.jsx';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { appliedRateFor, payableHoursFor } from '@/utils/overtime';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, LabelList
} from 'recharts';

// Extra top/side room so the always-visible % labels above points near 100%
// (and on the first/last day) aren't clipped by the chart edge.
const DAILY_CHART_MARGIN = { top: 24, right: 16, left: 12, bottom: 0 };

// Always-visible percentage label drawn above each point on the daily line charts.
// The white outline (paintOrder stroke) keeps it readable over grid lines and the line.
const renderPercentLabel = ({ x, y, value }) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return (
        <text
            x={x}
            y={y - 10}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#334155"
            stroke="#ffffff"
            strokeWidth={3}
            paintOrder="stroke"
        >
            {`${Math.round(Number(value))}%`}
        </text>
    );
};

// Hours are now calculated per entry, not constants

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// yyyy-mm-dd key (in local calendar time, matching how dates are displayed
// elsewhere via toLocaleDateString) for matching a report's date against a
// time entry's date. Reads the local date fields straight off the parsed
// instant with no setHours/toISOString round-trip - mixing local mutation
// with a UTC read shifts every key by a day in any timezone ahead of UTC
// (e.g. UTC+2), which silently mismatched every note-to-entry join and
// shifted every detected gap day by one.
function dayKey(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Builds a clean, print-ready A4 job report (active or completed) and is opened in a
// new tab for the browser's print dialog (Save as PDF). Built as its own document
// rather than printing the in-app dialog, which is a scroll-clipped overlay.
//
// Layout: one row per time entry booked on the job — date, technician, hours, what was
// done (the technician's daily report filed with that entry) and any issue reported
// (bottleneck) or "No issues" — then hours per technician (logged / allocated / left)
// and the job's overall allocated / consumed / remaining hours.
function buildJobReportPrintHtml(j) {
    const isCompleted = j.status === 'completed';
    const statusLabel = String(j.status || 'in progress').replace(/_/g, ' ');
    const fmtDate = (d) => {
        const dt = d ? new Date(d) : null;
        return dt && !Number.isNaN(dt.getTime())
            ? dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
    };
    const h = (n) => `${Number(n || 0).toFixed(1)}h`;

    // Declined entries never counted, so they're left out of the log and every total.
    // Older report data has no effective_hours yet; fall back to the logged hours.
    const hoursOf = (e) => Number(e.effective_hours ?? e.hours ?? 0);
    const entries = (j.time_entries || [])
        .filter((e) => e.approval_status !== 'declined')
        .slice()
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    // Attach each daily report to the entry it was filed with; reports whose entry no
    // longer exists fall back to the same technician + day, else are listed on their own.
    const entryIds = new Set(entries.map((e) => String(e.id || '')).filter(Boolean));
    const firstEntryForTechDay = new Map();
    for (const e of entries) {
        const key = `${String(e.technician_id || '')}|${dayKey(e.date)}`;
        if (!firstEntryForTechDay.has(key)) firstEntryForTechDay.set(key, String(e.id || key));
    }
    const reportsByEntry = new Map();
    const unmatchedReports = [];
    for (const r of (j.job_reports || [])) {
        const linked = r.daily_time_entry_id && entryIds.has(String(r.daily_time_entry_id)) ? String(r.daily_time_entry_id) : null;
        const target = linked || firstEntryForTechDay.get(`${String(r.technician_id || '')}|${dayKey(r.date)}`);
        if (!target) { unmatchedReports.push(r); continue; }
        if (!reportsByEntry.has(target)) reportsByEntry.set(target, []);
        reportsByEntry.get(target).push(r);
    }
    const reportsFor = (e) => reportsByEntry.get(String(e.id || `${String(e.technician_id || '')}|${dayKey(e.date)}`)) || [];

    const workDoneHtml = (e, reports) => {
        const stage = e.subtask_title ? `<div class="stage">${escapeHtml(e.subtask_title)}</div>` : '';
        const notes = reports.map((r) => String(r.work_completed || '').trim()).filter(Boolean);
        return stage + (notes.length
            ? notes.map((n) => `<div class="work">${escapeHtml(n)}</div>`).join('')
            : '<div class="muted">No report submitted</div>');
    };
    const issuesHtml = (reports) => {
        const issues = reports.filter((r) => r.has_bottleneck);
        if (!issues.length) return '<span class="ok">No issues</span>';
        return issues.map((r) => {
            const category = String(r.bottleneck_category || 'Bottleneck').replace(/_/g, ' ');
            const lost = Number(r.bottleneck_time_lost_hours || 0);
            return `<div class="issue"><strong>Bottleneck: ${escapeHtml(category)}</strong>${lost > 0 ? ` · ${lost.toFixed(1)}h lost` : ''}${
                r.bottleneck_description ? `<div>${escapeHtml(r.bottleneck_description)}</div>` : ''}</div>`;
        }).join('');
    };

    // Hours per technician: logged on this job vs their own allocation across stages.
    const techs = new Map();
    for (const a of (j.technician_allocations || [])) {
        techs.set(String(a.technician_id), { name: a.technician_name || 'Technician', allocated: Number(a.allocated_hours || 0), logged: 0 });
    }
    for (const e of entries) {
        const id = String(e.technician_id || '');
        if (!techs.has(id)) techs.set(id, { name: e.technician_name || 'Technician', allocated: 0, logged: 0 });
        const t = techs.get(id);
        t.logged += hoursOf(e);
        if (!t.name || t.name === 'Technician') t.name = e.technician_name || t.name;
    }
    const techRows = Array.from(techs.values()).sort((a, b) => a.name.localeCompare(b.name));
    const techAllocatedTotal = techRows.reduce((s, t) => s + t.allocated, 0);
    const techLoggedTotal = techRows.reduce((s, t) => s + t.logged, 0);
    const leftCell = (allocated, logged) => {
        if (allocated <= 0) return '<td class="num muted">—</td>';
        const left = allocated - logged;
        return left >= 0
            ? `<td class="num">${h(left)}</td>`
            : `<td class="num over">Over by ${h(-left)}</td>`;
    };

    const allocated = Number(j.allocated_hours || 0);
    const consumed = entries.reduce((s, e) => s + hoursOf(e), 0);
    const remaining = allocated - consumed;
    const issueCount = (j.job_reports || []).filter((r) => r.has_bottleneck).length;
    const pendingCount = entries.filter((e) => e.approval_status === 'pending').length;

    const logRows = entries.map((e) => {
        const reports = reportsFor(e);
        return `<tr${reports.some((r) => r.has_bottleneck) ? ' class="has-issue"' : ''}>
          <td class="nowrap">${escapeHtml(fmtDate(e.date))}</td>
          <td>${escapeHtml(e.technician_name || '—')}</td>
          <td class="num">${h(hoursOf(e))}${e.approval_status === 'pending' ? '<div class="tag">pending</div>' : ''}</td>
          <td>${workDoneHtml(e, reports)}</td>
          <td>${issuesHtml(reports)}</td>
        </tr>`;
    }).join('') + unmatchedReports.map((r) => `<tr${r.has_bottleneck ? ' class="has-issue"' : ''}>
          <td class="nowrap">${escapeHtml(fmtDate(r.date))}</td>
          <td>${escapeHtml(r.technician_name || '—')}</td>
          <td class="num muted">—</td>
          <td>${String(r.work_completed || '').trim() ? `<div class="work">${escapeHtml(r.work_completed)}</div>` : '<div class="muted">No report submitted</div>'}</td>
          <td>${issuesHtml([r])}</td>
        </tr>`).join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Job Report - ${escapeHtml(j.job_number)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8px; color: #94a3b8; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1e293b; font-size: 10.5px; line-height: 1.45; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-toolbar { text-align: right; margin-bottom: 10px; }
  .print-toolbar button { font: inherit; font-size: 12px; padding: 7px 16px; border: none; border-radius: 4px; background: #eab308; color: #1e293b; font-weight: 700; cursor: pointer; }
  @media print { .print-toolbar { display: none; } }

  .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 3px solid #eab308; }
  .brand { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #b45309; }
  h1 { font-size: 20px; margin: 2px 0 0; color: #0f172a; }
  .desc { color: #475569; font-size: 11px; margin-top: 2px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: capitalize; }
  .status.done { background: #dcfce7; color: #166534; }
  .status.active { background: #dbeafe; color: #1e40af; }
  .meta { text-align: right; font-size: 9px; color: #64748b; line-height: 1.7; }

  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin: 12px 0 4px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .facts > div { padding: 7px 10px; border-right: 1px solid #e2e8f0; }
  .facts > div:last-child { border-right: none; }
  .facts .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 600; }
  .facts .v { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 1px; }

  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; page-break-after: avoid; }
  h2 .count { font-weight: 400; color: #64748b; text-transform: none; letter-spacing: normal; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; background: #f1f5f9; padding: 6px 7px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  .stage { font-size: 8.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 1px; }
  .work { white-space: pre-wrap; }
  .work + .work { margin-top: 3px; }
  .muted { color: #94a3b8; font-style: italic; }
  .ok { color: #15803d; }
  .issue { color: #92400e; }
  .issue strong { text-transform: capitalize; }
  .issue + .issue { margin-top: 4px; }
  tr.has-issue td { background: #fffbeb; }
  .tag { font-size: 8px; color: #64748b; font-weight: 400; }
  .over { color: #b91c1c; font-weight: 700; }
  tfoot td { font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1; border-bottom: none; }
  .empty { color: #94a3b8; font-style: italic; padding: 8px 0; }

  .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; page-break-inside: avoid; }
  .totals > div { border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; }
  .totals .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 600; }
  .totals .v { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .totals .v.over { color: #b91c1c; }
  .note { font-size: 8.5px; color: #64748b; margin-top: 8px; }
  .footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="print-toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>

  <div class="header">
    <div>
      <div class="brand">EPIROC · LABOUR UTILIZATION</div>
      <h1>Job ${escapeHtml(j.job_number)}</h1>
      <div class="desc">${escapeHtml(j.description || '')}</div>
    </div>
    <div class="meta">
      <span class="status ${isCompleted ? 'done' : 'active'}">${escapeHtml(isCompleted ? 'Completed' : statusLabel)}</span><br/>
      Workshop: ${escapeHtml(j.supervisor_key || '—')}<br/>
      Generated ${escapeHtml(new Date().toLocaleString())}
    </div>
  </div>

  <div class="facts">
    <div><div class="k">First booking</div><div class="v">${escapeHtml(fmtDate(j.first_log_date || j.start_date))}</div></div>
    <div><div class="k">${isCompleted ? 'Completed' : 'Last booking'}</div><div class="v">${escapeHtml(fmtDate(isCompleted ? (j.end_date || j.completed_at) : j.last_log_date))}</div></div>
    <div><div class="k">Technicians</div><div class="v">${techRows.length}</div></div>
    <div><div class="k">Issues reported</div><div class="v">${issueCount}</div></div>
  </div>

  <h2>Work Log <span class="count">(${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})</span></h2>
  ${entries.length || unmatchedReports.length ? `
  <table>
    <thead><tr>
      <th style="width:13%">Date</th><th style="width:16%">Technician</th><th class="num" style="width:8%">Hours</th>
      <th style="width:38%">What was done</th><th style="width:25%">Issues</th>
    </tr></thead>
    <tbody>${logRows}</tbody>
  </table>` : '<div class="empty">No hours have been booked on this job yet.</div>'}

  <h2>Hours Summary</h2>
  ${techRows.length ? `
  <table>
    <thead><tr><th>Technician</th><th class="num">Hours Logged</th><th class="num">Hours Allocated</th><th class="num">Hours Left</th></tr></thead>
    <tbody>${techRows.map((t) => `<tr>
      <td>${escapeHtml(t.name)}</td>
      <td class="num">${h(t.logged)}</td>
      <td class="num">${t.allocated > 0 ? h(t.allocated) : '<span class="muted">—</span>'}</td>
      ${leftCell(t.allocated, t.logged)}
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td>All technicians</td><td class="num">${h(techLoggedTotal)}</td>
      <td class="num">${techAllocatedTotal > 0 ? h(techAllocatedTotal) : '—'}</td>
      ${leftCell(techAllocatedTotal, techLoggedTotal)}
    </tr></tfoot>
  </table>` : '<div class="empty">No technicians have booked hours on this job.</div>'}

  <div class="totals">
    <div><div class="k">Job hours allocated</div><div class="v">${h(allocated)}</div></div>
    <div><div class="k">Hours consumed</div><div class="v">${h(consumed)}</div></div>
    <div><div class="k">${remaining >= 0 ? 'Hours remaining' : 'Over allocation by'}</div><div class="v${remaining < 0 ? ' over' : ''}">${h(Math.abs(remaining))}</div></div>
  </div>
  <div class="note">
    Hours count approved hours, plus hours still awaiting approval${pendingCount ? ` (${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} marked pending)` : ''}; declined entries are excluded.
    A technician's allocation is the hours assigned to them across the job's stages.
  </div>

  <div class="footer">EPIROC Labour Utilization — Job ${escapeHtml(j.job_number)} — ${escapeHtml(isCompleted ? 'Completion' : 'Progress')} report printed ${escapeHtml(new Date().toLocaleString())}</div>
</body>
</html>`;
}

function printJobReport(j) {
    const html = buildJobReportPrintHtml(j);
    const win = window.open('', '_blank');
    if (!win) {
        alert('Please allow pop-ups to print this report.');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
}

export default function Dashboard() {
    const [techModalOpen, setTechModalOpen] = useState(false);
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [globalTechSelectorOpen, setGlobalTechSelectorOpen] = useState(false);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [editingLogId, setEditingLogId] = useState(null);
    const [editLogDraft, setEditLogDraft] = useState({ hours_logged: '', category: '', category_detail: '' });
    const [selectedJobDetails, setSelectedJobDetails] = useState(null);
    const [isEditingJob, setIsEditingJob] = useState(false);
    const [jobEditDraft, setJobEditDraft] = useState({ job_number: '', description: '', allocated_hours: '', status: '', hours_change_reason: '' });
    const [jobAddTechnicianId, setJobAddTechnicianId] = useState('');
    const [selectedJobTechnicianId, setSelectedJobTechnicianId] = useState('');
    const [techStageAllocDraft, setTechStageAllocDraft] = useState({});
    const [techStageReasonDraft, setTechStageReasonDraft] = useState({});
    const [approvalHoursDraft, setApprovalHoursDraft] = useState({});
    const [selectedApprovalIds, setSelectedApprovalIds] = useState(() => new Set());
    const [bulkApprovalProgress, setBulkApprovalProgress] = useState(null); // { done, total } while running
    const [completedDialogOpen, setCompletedDialogOpen] = useState(false);
    const [completedJobsReportOpen, setCompletedJobsReportOpen] = useState(false);
    const [selectedJobReport, setSelectedJobReport] = useState(null);
    const [completedJobSearch, setCompletedJobSearch] = useState('');
    // Which jobs the Jobs Report dialog lists: 'completed' or 'active'.
    const [jobReportScope, setJobReportScope] = useState('completed');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [operationalMetrics, setOperationalMetrics] = useState(null);
    const [lastOperationalMetrics, setLastOperationalMetrics] = useState(null);
    const [showAtRiskDetails, setShowAtRiskDetails] = useState(false);
    const [showOvertimeDetails, setShowOvertimeDetails] = useState(false);
    const [showProductiveDetails, setShowProductiveDetails] = useState(false);
    const [showUtilizationDetails, setShowUtilizationDetails] = useState(false);
    const [showNonProductiveDetails, setShowNonProductiveDetails] = useState(false);
    const [showEfficiencyDetails, setShowEfficiencyDetails] = useState(false);
    const [showAvailabilityDetails, setShowAvailabilityDetails] = useState(false);
    const [showTrainingDetails, setShowTrainingDetails] = useState(false);
    const [monthlySummaries, setMonthlySummaries] = useState([]);
    // Incrementing this triggers an immediate KPI re-fetch after any mutation that
    // changes hours (approve/decline/delete time entries, job deletion, etc.).
    const [kpiRefreshKey, setKpiRefreshKey] = useState(0);

    // Dashboard filters
    const [selectedView, setSelectedView] = useState('daily'); // daily, weekly, monthly
    const [selectedWorkshop, setSelectedWorkshop] = useState(null);

    // Clear KPI metrics immediately when time view changes so stale data isn't shown
    const handleViewChange = React.useCallback((view) => {
        setSelectedView(view);
        setOperationalMetrics(null);
        setLastOperationalMetrics(null);
    }, []);

    // Stable week boundaries — computed once per session (current week doesn't change
    // while the dashboard is open). Using useMemo prevents new Date objects on every
    // render, which would make OperationalMetricsFetcher's useEffect dep array see a
    // "change" every render and trigger an infinite fetch loop.
    const weekStart = React.useMemo(() => {
        const now = new Date();
        const diffToMonday = (now.getDay() + 6) % 7;
        const d = new Date(now);
        d.setDate(now.getDate() - diffToMonday);
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const weekEnd = React.useMemo(() => {
        const now = new Date();
        const diffToMonday = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        const d = new Date(monday);
        d.setDate(monday.getDate() + 6);
        d.setHours(23, 59, 59, 999);
        return d;
    }, []);

    // Last week's boundaries — same Monday-Sunday computation, shifted back 7 days.
    const lastWeekStart = React.useMemo(() => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        return d;
    }, [weekStart]);

    const lastWeekEnd = React.useMemo(() => {
        const d = new Date(weekEnd);
        d.setDate(d.getDate() - 7);
        return d;
    }, [weekEnd]);

    // Period label for the KPI header and detail dialogs.
    const periodLabel = React.useMemo(() => {
        if (selectedView === 'daily') return 'Today';
        if (selectedView === 'weekly') return 'This Week';
        if (selectedView === 'last_week') return 'Last Week';
        if (selectedMonth) {
            try { return new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }); }
            catch { return selectedMonth; }
        }
        return 'This Month';
    }, [selectedView, selectedMonth]);

    // Stable callbacks — excluded from OperationalMetricsFetcher's dep array by design,
    // but wrapping in useCallback keeps them from being recreated on every render anyway.
    const handleOperationalMetricsUpdate = React.useCallback((metrics) => {
        setOperationalMetrics(metrics);
        setLastOperationalMetrics(metrics);
    }, []);

    const handleMonthlySummariesUpdate = React.useCallback((summaries) => {
        setMonthlySummaries(summaries);
    }, []);

    const handleProductiveClick    = React.useCallback(() => setShowProductiveDetails(true),    []);
    const handleUtilizationClick   = React.useCallback(() => setShowUtilizationDetails(true),   []);
    const handleNonProductiveClick = React.useCallback(() => setShowNonProductiveDetails(true), []);
    const handleEfficiencyClick    = React.useCallback(() => setShowEfficiencyDetails(true),    []);
    const handleAvailabilityClick  = React.useCallback(() => setShowAvailabilityDetails(true),  []);
    const handleTrainingClick      = React.useCallback(() => setShowTrainingDetails(true),      []);

    const [dashboardAlerts, setDashboardAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    React.useEffect(() => {
        console.log('[KPI TRACE] Dashboard — operationalMetrics state updated:', {
            hasData: operationalMetrics?.hasData,
            _kpiShapeValid: operationalMetrics?._kpiShapeValid,
            metrics: operationalMetrics,
        });
    }, [operationalMetrics]);

    // Temporary user/debug logging to trace why supervisor_key is missing

    React.useEffect(() => {
        console.log('Current User:', currentUser);
        console.log('Supervisor Key:', currentUser?.supervisor_key);
        console.log('User ID:', currentUser?.id);
        console.log('User Role:', currentUser?.role);
    }, [currentUser]);

    const queryClient = useQueryClient();

    // Clear selected technician when job modal closes
    React.useEffect(() => {
        if (!jobModalOpen) {
            setSelectedTechnician(null);
        }
    }, [jobModalOpen]);

    React.useEffect(() => {
        const validateSession = async () => {
            const storedUser = localStorage.getItem('epiroc_user');
            if (!storedUser) {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            const parsed = JSON.parse(storedUser);
            if (parsed.type !== 'supervisor') {
                window.location.href = createPageUrl('WorkshopLogin');
                return;
            }
            setCurrentUser(parsed);
            try {
                const me = await base44.auth.me();
                if (me?.user) {
                    setCurrentUser(me.user);
                    localStorage.setItem('epiroc_user', JSON.stringify(me.user));
                }
                setIsAuthenticated(true);
            } catch {
                // Session expired — redirect to login
                localStorage.removeItem('epiroc_user');
                window.location.href = createPageUrl('WorkshopLogin');
            }
        };
        validateSession();
    }, []);

    // Operational metrics are now provided by PerformanceCharts component via callback
    // No separate API call needed - PerformanceCharts handles the data fetching

    const supervisorKey = currentUser?.supervisor_key;
    const supervisorRole = currentUser?.role || 'supervisor';
    const supervisorAccess = Array.isArray(currentUser?.access) ? currentUser.access : [];

    const workshopButtons = [
        { key: 'component', label: 'Components', accessKey: 'components' },
        { key: 'pdis', label: 'PDI', accessKey: 'pdi' },
        { key: 'rebuild', label: 'Rebuild', accessKey: 'rebuild' }
    ].filter((w) => supervisorAccess.includes(w.accessKey));

    const handleSwitchWorkshop = async (nextKey) => {
        if (!nextKey || nextKey === currentUser?.supervisor_key) return;
        try {
            const result = await base44.auth.switchTenant(nextKey);
            if (result?.user) {
                setCurrentUser(result.user);
                localStorage.setItem('epiroc_user', JSON.stringify(result.user));
            }
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobReports'] });
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
        } catch (e) {
            alert(e?.message || 'Could not switch workshop');
        }
    };
    const dashboardLabel = supervisorKey === 'rebuild'
        ? 'REBUILD DASHBOARD'
        : supervisorKey === 'pdis'
            ? 'PDIS DASHBOARD'
            : supervisorKey === 'kathu'
                ? 'KATHU DASHBOARD'
                : 'COMPONENT DASHBOARD';

    const handleLogout = async () => {
        try { await base44.auth.logout(); } catch {}
        localStorage.removeItem('epiroc_user');
        window.location.href = createPageUrl('WorkshopLogin');
    };

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => base44.entities.Technician.list(),
        enabled: isAuthenticated,
        // A technician can be permanently transferred out by another workshop's
        // supervisor in a separate session - without polling, this dashboard's
        // cached roster wouldn't know they left until a manual reload.
        refetchInterval: isAuthenticated ? 10000 : false
    });

    // Technicians can log hours on jobs owned by other workshops (temporary
    // assignments), so their record may not be in the current tenant's
    // `technicians` list above. Fetch the global list too so names still
    // resolve instead of falling back to the raw technician_id.
    const { data: allTechniciansGlobal = [] } = useQuery({
        queryKey: ['technicians', 'all'],
        queryFn: () => base44.entities.Technician.getAll(),
        enabled: isAuthenticated
    });

    const updateSubtaskMutation = useMutation({
        mutationFn: async ({ jobNumber, subtaskId, data }) => base44.entities.Job.subtasks.update(jobNumber, subtaskId, data),
        onSuccess: async (_updatedSubtask, vars) => {
            const latest = await base44.entities.Job.getByJobNumber(vars.jobNumber);
            setSelectedJobDetails(latest);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
        onError: (e) => {
            alert(e?.message || 'Failed to update stage allocation');
        }
    });

    const { data: jobs = [], isError: isJobsError, error: jobsError, isFetching: isFetchingJobs } = useQuery({
        queryKey: ['jobs'],
        queryFn: () => base44.entities.Job.list('-created_date', 200),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 5000 : false
    });

    const { data: timeLogs = [] } = useQuery({
        queryKey: ['timeLogs'],
        queryFn: () => base44.entities.DailyTimeEntry.list('-log_date', 500),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 10000 : false
    });

    const { data: idleInfo } = useQuery({
        queryKey: ['idleCategories'],
        queryFn: () => base44.entities.DailyTimeEntry.idleCategories(),
        enabled: isAuthenticated
    });

    const { data: jobReports = [] } = useQuery({
        queryKey: ['jobReports'],
        queryFn: () => base44.entities.JobReport.list('-date', 200),
        enabled: isAuthenticated
    });

    const { data: completedJobsReport = [], isFetching: isFetchingCompletedJobsReport } = useQuery({
        queryKey: ['completedJobsReport', supervisorKey],
        queryFn: () => base44.entities.Job.completedReport({ limit: 500 }),
        // Also load when the dialog is opened from the KPI card, which only sets completedDialogOpen.
        enabled: isAuthenticated && (completedJobsReportOpen || completedDialogOpen) && jobReportScope === 'completed',
        keepPreviousData: true,
        staleTime: 1000 * 60
    });

    const { data: activeJobsReport = [], isFetching: isFetchingActiveJobsReport } = useQuery({
        queryKey: ['activeJobsReport', supervisorKey],
        queryFn: () => base44.entities.Job.activeReport({ limit: 500 }),
        enabled: isAuthenticated && completedDialogOpen && jobReportScope === 'active',
        keepPreviousData: true,
        staleTime: 1000 * 60
    });

    const isForeman = currentUser?.type === 'supervisor' && ['foreman', 'manager'].includes(currentUser?.role);
    // Foreman specifically (not manager, which has its own separate multi-workshop
    // Workshop Overview page) gets KPI numbers combined across all their workshops
    // from the backend, instead of only whichever single workshop is switched to.
    const hasCombinedWorkshopKpis = currentUser?.type === 'supervisor' && currentUser?.role === 'foreman';
    const isComponentSupervisor = currentUser?.type === 'supervisor' && currentUser?.supervisor_key === 'component';
    
    // Enable approvals for component supervisors and foreman (but different scopes)
    const approvalEnabled = isAuthenticated && (isComponentSupervisor || isForeman) && !!currentUser?.supervisor_key;

    const { data: pendingApprovals = [], error: approvalError } = useQuery({
        queryKey: ['pendingApprovals', currentUser?.supervisor_key],
        queryFn: async () => {
            console.log('🔍 Fetching pending approvals for supervisor:', currentUser?.supervisor_key, currentUser?.name);
            try {
                const result = await base44.entities.DailyTimeEntry.approvals.pending({ supervisor_key: currentUser?.supervisor_key });
                console.log('✅ Pending approvals API response:', result);
                console.log('📊 Pending approvals count:', Array.isArray(result) ? result.length : 'Not an array');
                return result;
            } catch (error) {
                console.log('❌ Error fetching pending approvals:', error);
                throw error;
            }
        },
        enabled: approvalEnabled,
        refetchInterval: approvalEnabled ? 10000 : false,
        retry: (failureCount, error) => {
            // Don't retry on 401 errors (session expired)
            if (error?.response?.status === 401) {
                return false;
            }
            return failureCount < 3;
        },
        // Ensure we always have an array to prevent React errors
        select: (data) => {
            console.log('Raw API response:', data);
            // Always return an array, even if data is malformed
            if (Array.isArray(data)) {
                return data;
            }
            // If data is an object with keys, convert to array
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                console.log('Converting object to array:', Object.keys(data));
                return Object.values(data || {});
            }
            // Fallback to empty array
            console.log('Returning fallback array');
            return [];
        }
    });

    const createTechnicianMutation = useMutation({
        mutationFn: (data) => base44.entities.Technician.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicians'] }),
        onError: (error) => alert(error?.message || 'Failed to add technician')
    });

    const updateTechnicianMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Technician.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicians'] })
    });

    const deleteTechnicianMutation = useMutation({
        // The backend already cascades deletion of time entries/time logs/job reports
        // for this technician in one atomic call - no need to delete them one by one here.
        mutationFn: (id) => base44.entities.Technician.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['technicians'] });
            const previousTechnicians = queryClient.getQueryData(['technicians']);
            // Remove instantly from the UI instead of waiting on a refetch
            queryClient.setQueryData(['technicians'], (old = []) => old.filter((t) => t.id !== id));
            return { previousTechnicians };
        },
        onError: (error, _id, context) => {
            if (context?.previousTechnicians) {
                queryClient.setQueryData(['technicians'], context.previousTechnicians);
            }
            alert(error?.message || 'Failed to delete technician');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const createJobMutation = useMutation({
        mutationFn: (data) => base44.entities.Job.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        onError: (error) => {
            // JobAllocationModal shows this inline via its own try/catch around mutateAsync;
            // this just makes sure it's also visible in server logs / browser console.
            console.error('Job creation failed:', error);
        }
    });

    const deleteJobMutation = useMutation({
        mutationFn: (id) => base44.entities.Job.delete(id),
        onSuccess: () => {
            // Backend cascade deletes the job's TimeLogs and JobReports too.
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['completedJobsReport'] });
            setKpiRefreshKey(k => k + 1);
        }
    });

    const updateTimeLogMutation = useMutation({
        mutationFn: ({ id, timeLog }) => base44.entities.DailyTimeEntry.update(id, { timeLog }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setKpiRefreshKey(k => k + 1);
            setEditingLogId(null);
            setEditLogDraft({ hours_logged: '', category: '', category_detail: '' });
        },
        onError: (error) => {
            alert(`Failed to update time log: ${error?.message || 'Unknown error'}`);
        }
    });

    const deleteTimeLogMutation = useMutation({
        mutationFn: (id) => base44.entities.DailyTimeEntry.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setKpiRefreshKey(k => k + 1);
        }
    });

    const approveTimeLogMutation = useMutation({
        mutationFn: ({ id, approved_hours, note }) => base44.entities.DailyTimeEntry.approvals.approve(id, { approved_hours, note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            setKpiRefreshKey(k => k + 1);
        },
        onError: (error) => {
            alert(`Failed to approve: ${error?.message || 'Unknown error'}`);
        }
    });

    const declineTimeLogMutation = useMutation({
        mutationFn: ({ id, note }) => base44.entities.DailyTimeEntry.approvals.decline(id, { note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
            setKpiRefreshKey(k => k + 1);
        },
        onError: (error) => {
            alert(`Failed to decline: ${error?.message || 'Unknown error'}`);
        }
    });

    // Approves each selected entry with the hours shown in its row. Runs one at a time,
    // not in parallel: every approval re-saves the job document's consumed hours and
    // stage progress, so concurrent approvals on the same job would overwrite each other.
    const approveSelectedTimeLogs = async () => {
        const toApprove = (Array.isArray(pendingApprovals) ? pendingApprovals : [])
            .filter((log) => selectedApprovalIds.has(log.id));
        if (!toApprove.length) return;
        const totalHours = toApprove.reduce((sum, log) => {
            const val = Number(approvalHoursDraft[log.id] ?? log?.hours_logged ?? 0);
            return sum + (Number.isNaN(val) ? 0 : val);
        }, 0);
        if (!window.confirm(`Approve ${toApprove.length} time entr${toApprove.length === 1 ? 'y' : 'ies'} (${totalHours.toFixed(1)}h total)?`)) return;

        const failures = [];
        setBulkApprovalProgress({ done: 0, total: toApprove.length });
        for (let i = 0; i < toApprove.length; i++) {
            const log = toApprove[i];
            const val = Number(approvalHoursDraft[log.id] ?? log?.hours_logged ?? 0);
            try {
                await base44.entities.DailyTimeEntry.approvals.approve(log.id, { approved_hours: Number.isNaN(val) ? 0 : val });
            } catch (e) {
                const who = log?.technician_id?.name || log?.technician_name || '';
                const when = log?.log_date ? format(new Date(log.log_date), 'yyyy-MM-dd') : '';
                failures.push(`${who} ${when} ${log?.job_id || ''}: ${e?.message || 'Unknown error'}`.trim());
            }
            setBulkApprovalProgress({ done: i + 1, total: toApprove.length });
        }
        setBulkApprovalProgress(null);
        setSelectedApprovalIds(new Set());
        queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        setKpiRefreshKey(k => k + 1);

        if (failures.length) {
            alert(`Approved ${toApprove.length - failures.length} of ${toApprove.length}. These failed:\n\n${failures.join('\n')}`);
        }
    };

    const recoverTechnicalComplexityMutation = useMutation({
        mutationFn: async (jobNumber) => base44.entities.Job.recoverTechnicalComplexity(jobNumber),
        onSuccess: (updatedJob) => {
            setSelectedJobDetails(updatedJob);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobReports'] });
            queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        }
    });

    const updateJobByNumberMutation = useMutation({
        mutationFn: async ({ jobNumber, data }) => base44.entities.Job.updateByJobNumber(jobNumber, data),
        onSuccess: (updatedJob, variables) => {
            setSelectedJobDetails(updatedJob);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });

            if (!variables?.keepEditing) {
                setIsEditingJob(false);
                setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '', hours_change_reason: '' });
                setJobAddTechnicianId('');
            }
        },
        onError: (e) => {
            alert(e?.message || 'Failed to update job');
        }
    });

    // "Make Active" on a completed job: brings it back to the active list (even with its
    // hours used up) and opens it, so the supervisor can add hours or edit it straight away.
    const reopenJobMutation = useMutation({
        mutationFn: ({ jobNumber, remaining }) => base44.entities.Job.reopenByJobNumber(jobNumber, {
            technician_id: currentUser?.id,
            reason: remaining > 0
                ? 'Job made active again by supervisor - has remaining hours'
                : 'Job made active again by supervisor to continue work'
        }),
        onSuccess: async (_data, { jobNumber, remaining }) => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['completedJobsReport'] });
            queryClient.invalidateQueries({ queryKey: ['activeJobsReport'] });
            try {
                setSelectedJobDetails(await base44.entities.Job.getByJobNumber(jobNumber));
            } catch {
                // The job is active again either way; opening it is just a convenience.
            }
            alert(remaining > 0
                ? `Job ${jobNumber} is active again. Technicians can book its remaining ${remaining.toFixed(1)}h.`
                : `Job ${jobNumber} is active again. It has no hours left, so use Edit Job to add hours for the technicians before they can book on it.`);
        },
        onError: (e) => {
            alert(e?.message || 'Could not reopen job');
        }
    });

    const openJobDetails = async (job) => {
        try {
            const jobNumber = job?.job_number;
            if (!jobNumber) return;
            const latest = await base44.entities.Job.getByJobNumber(jobNumber);
            setSelectedJobDetails(latest);
        } catch (e) {
            alert(e?.message || 'Could not load job details');
        }
    };

    const reassignJobMutation = useMutation({
        mutationFn: async ({ jobId, newTechnicianId, newTechnicianName, previousTechnicianId, previousTechnicianName, reason, subtask_allocations }) => {
            const job = jobs.find(j => j.id === jobId);
            const reassignmentHistory = job?.reassignment_history || [];
            
            reassignmentHistory.push({
                from_technician_id: previousTechnicianId,
                from_technician_name: previousTechnicianName,
                to_technician_id: newTechnicianId,
  
                to_technician_name: newTechnicianName,
                reassigned_date: new Date().toISOString(),
                reason: reason || ''
            });

            await base44.entities.Job.update(jobId, { reassignment_history: reassignmentHistory });

            // Assign an additional technician to the same job (do not create a new job)
            await base44.entities.Job.assignTechnicianByJobNumber(
                job?.job_number,
                newTechnicianId,
                newTechnicianName
            );

            const allocations = Array.isArray(subtask_allocations) ? subtask_allocations : [];
            if (allocations.length) {
                const latest = await base44.entities.Job.getByJobNumber(job?.job_number);
                for (const a of allocations) {
                    const st = (latest?.subtasks || []).find((s) => String(s?._id || s?.id) === String(a.subtaskId));
                    if (!st) continue;
                    const assigned = Array.isArray(st.assigned_technicians) ? st.assigned_technicians : [];
                    const exists = assigned.some((x) => String(x?.technician_id) === String(newTechnicianId));
                    const nextAssigned = exists
                        ? assigned.map((x) => String(x?.technician_id) === String(newTechnicianId)
                            ? { ...x, allocated_hours: Number(a.allocated_hours || 0) }
                            : x
                        )
                        : [...assigned, { technician_id: newTechnicianId, technician_name: newTechnicianName, allocated_hours: Number(a.allocated_hours || 0) }];
                    await base44.entities.Job.subtasks.update(job?.job_number, String(st?._id || st?.id), { assigned_technicians: nextAssigned });
                }
            }

            const latestAfter = await base44.entities.Job.getByJobNumber(job?.job_number);
            return latestAfter;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] })
    });

    const blockTechnicianMutation = useMutation({
        mutationFn: ({ jobNumber, technicianId, reason }) => base44.entities.Job.blockTechnician(jobNumber, technicianId, true, reason),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        onError: (e) => {
            alert(e?.message || 'Could not block technician');
        }
    });

    const unblockTechnicianMutation = useMutation({
        mutationFn: ({ jobNumber, technicianId }) => base44.entities.Job.blockTechnician(jobNumber, technicianId, false),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        onError: (e) => {
            alert(e?.message || 'Could not lift block');
        }
    });

    const addTechnicianMutation = useMutation({
        mutationFn: async ({ jobId, jobNumber, technicianId, technicianName, allocated_hours, subtask_allocations }) => {
            await base44.entities.Job.assignTechnicianByJobNumber(
                jobNumber,
                technicianId,
                technicianName
            );

            const allocations = Array.isArray(subtask_allocations) ? subtask_allocations : [];
            if (allocations.length) {
                const latest = await base44.entities.Job.getByJobNumber(jobNumber);
                for (const a of allocations) {
                    const st = (latest?.subtasks || []).find((s) => String(s?._id || s?.id) === String(a.subtaskId));
                    if (!st) continue;
                    const assigned = Array.isArray(st.assigned_technicians) ? st.assigned_technicians : [];
                    const exists = assigned.some((x) => String(x?.technician_id) === String(technicianId));
                    const nextAssigned = exists
                        ? assigned.map((x) => String(x?.technician_id) === String(technicianId)
                            ? { ...x, allocated_hours: Number(a.allocated_hours || 0) }
                            : x
                        )
                        : [...assigned, { technician_id: technicianId, technician_name: technicianName, allocated_hours: Number(a.allocated_hours || 0) }];
                    await base44.entities.Job.subtasks.update(jobNumber, String(st?._id || st?.id), { assigned_technicians: nextAssigned });
                }
            }

            const desiredAllocated = allocated_hours === '' || typeof allocated_hours === 'undefined' || allocated_hours === null
                ? null
                : Number(allocated_hours);

            if (desiredAllocated !== null && !Number.isNaN(desiredAllocated)) {
                const current = jobs.find(j => j.id === jobId);
                const currentAllocated = Number(current?.allocated_hours);
                if (!Number.isNaN(currentAllocated) && desiredAllocated !== currentAllocated) {
                    await base44.entities.Job.update(jobId, { allocated_hours: desiredAllocated });
                }
            }

            const latestAfter = await base44.entities.Job.getByJobNumber(jobNumber);
            return latestAfter;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        onError: (e) => alert(e?.message || 'Failed to add technician to job')
    });

    // Jobs list should show only jobs that are still pending/active (exclude completed)
    // Active states in our domain:
    // - pending_confirmation
    // - active
    // - in_progress
    // - at_risk
    // - over_allocated
    // - reopened
    //
    // Also keep bottleneck>=2 jobs visible even if status isn't in the explicit list.
    const activeJobs = jobs.filter((j) => {
        const status = j?.status;
        if (!status) return false;
        if (String(status) === 'completed') return false;

        const isActiveState = ['pending_confirmation', 'active', 'in_progress', 'at_risk', 'over_allocated', 'overrun', 'reopened'].includes(status);
        const hasBottleneck = Number(j?.bottleneck_count || 0) >= 2;
        return isActiveState || hasBottleneck;
    });
    const atRiskJobs = jobs.filter(j => j.status === 'at_risk' || j.bottleneck_count >= 2);
    const completedJobs = jobs.filter(j => j.status === 'completed');

    const technicianNameById = [...(allTechniciansGlobal || []), ...(technicians || [])].reduce((acc, t) => {
        const id = String(t?.id || t?._id || t?.technician_id || '');
        if (!id) return acc;
        acc[id] = t?.name || t?.technician_name || acc[id];
        return acc;
    }, {});

    // Normalize the completed jobs report API response to a flat array.
    // The new /completed-report endpoint returns a plain array of enriched job objects.
    const completedJobsData = React.useMemo(() => {
        const raw = completedJobsReport;
        const arr = Array.isArray(raw) ? raw
            : Array.isArray(raw?.data) ? raw.data
            : [];
        return arr.filter(j => j?.job_number).sort((a, b) => {
            const at = a.completed_at ? new Date(a.completed_at).getTime() : 0;
            const bt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
            return bt - at;
        });
    }, [completedJobsReport]);

    const activeJobsData = React.useMemo(() => {
        const raw = activeJobsReport;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        return arr.filter(j => j?.job_number).sort((a, b) =>
            String(b.last_log_date || '').localeCompare(String(a.last_log_date || '')));
    }, [activeJobsReport]);

    // The dialog lists either completed or active jobs; search applies to whichever is shown.
    const reportJobsData = jobReportScope === 'active' ? activeJobsData : completedJobsData;
    const isFetchingReportJobs = jobReportScope === 'active' ? isFetchingActiveJobsReport : isFetchingCompletedJobsReport;
    const filteredCompletedJobsData = React.useMemo(() => {
        const q = completedJobSearch.trim().toLowerCase();
        if (!q) return reportJobsData;
        return reportJobsData.filter(j => String(j.job_number || '').toLowerCase().includes(q));
    }, [reportJobsData, completedJobSearch]);

    
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
    const todayDateStr = format(new Date(), 'yyyy-MM-dd');
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');
    const lastWeekStartStr = format(lastWeekStart, 'yyyy-MM-dd');
    const lastWeekEndStr   = format(lastWeekEnd,   'yyyy-MM-dd');
    const isLogInSelectedPeriod = (e) => {
        if (!e?.log_date) return false;
        const logLocalDate = format(new Date(e.log_date), 'yyyy-MM-dd');
        if (selectedView === 'daily') {
            return logLocalDate === todayDateStr;
        }
        if (selectedView === 'weekly') {
            return logLocalDate >= weekStartStr && logLocalDate <= weekEndStr;
        }
        if (selectedView === 'last_week') {
            return logLocalDate >= lastWeekStartStr && logLocalDate <= lastWeekEndStr;
        }
        const d = parseISO(e.log_date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
    };
    // timeLogs / jobReports only hold the workshop's latest 500 entries / 200 reports,
    // which reach back about a month — so picking an earlier month (e.g. August) showed
    // every technician at zero. The selected period is loaded in full instead (padded a
    // day each side for the server's UTC day boundaries, then trimmed with the same
    // local-date rule). Keys sit under ['timeLogs'] / ['jobReports'] so the existing
    // invalidations after edits and approvals refresh them too.
    const [periodStartStr, periodEndStr] = selectedView === 'daily' ? [todayDateStr, todayDateStr]
        : selectedView === 'weekly' ? [weekStartStr, weekEndStr]
        : selectedView === 'last_week' ? [lastWeekStartStr, lastWeekEndStr]
        : [format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')];
    const padDay = (s, days) => format(addDays(parseISO(s), days), 'yyyy-MM-dd');
    const periodRange = { start_date: padDay(periodStartStr, -1), end_date: padDay(periodEndStr, 1) };

    const { data: periodTimeLogs } = useQuery({
        queryKey: ['timeLogs', 'period', periodRange.start_date, periodRange.end_date],
        queryFn: () => base44.entities.DailyTimeEntry.listRange(periodRange),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 30000 : false
    });
    const { data: periodJobReports } = useQuery({
        queryKey: ['jobReports', 'period', periodRange.start_date, periodRange.end_date],
        queryFn: () => base44.entities.JobReport.listRange(periodRange),
        enabled: isAuthenticated
    });

    // Falls back to the latest-500 list only until the period's own entries arrive.
    const timeLogsForMonth = (Array.isArray(periodTimeLogs) ? periodTimeLogs : (timeLogs || [])).filter(isLogInSelectedPeriod);
    const jobReportsForPeriod = Array.isArray(periodJobReports) ? periodJobReports : (jobReports || []);

    // Technician Activities (and its PDF report) shows everything this workshop's own
    // technicians booked, including hours on other workshops' jobs, which are stored
    // under that workshop and missed by the workshop-only lists above. Read-only view,
    // so it doesn't affect the editable Time Logs tab or approvals.
    const { data: activityTimeLogs } = useQuery({
        queryKey: ['timeLogs', 'activity', periodRange.start_date, periodRange.end_date],
        queryFn: () => base44.entities.DailyTimeEntry.listRange({ ...periodRange, scope: 'own_technicians' }),
        enabled: isAuthenticated,
        refetchInterval: isAuthenticated ? 60000 : false
    });
    const { data: activityJobReports } = useQuery({
        queryKey: ['jobReports', 'activity', periodRange.start_date, periodRange.end_date],
        queryFn: () => base44.entities.JobReport.listRange({ ...periodRange, scope: 'own_technicians' }),
        enabled: isAuthenticated
    });
    const activityLogsForPeriod = Array.isArray(activityTimeLogs) ? activityTimeLogs.filter(isLogInSelectedPeriod) : timeLogsForMonth;
    const activityReportsForPeriod = Array.isArray(activityJobReports) ? activityJobReports : jobReportsForPeriod;

    // Exports fetch the period fresh at click time so they never use a stale list.
    const loadTimeLogsForPeriod = async () => {
        const logs = await base44.entities.DailyTimeEntry.listRange(periodRange);
        return (Array.isArray(logs) ? logs : []).filter(isLogInSelectedPeriod);
    };

    const totalHours = timeLogsForMonth.reduce((sum, e) => sum + (e.hours_logged || 0), 0);
    const totalOvertimeHours = timeLogsForMonth.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const totalProductiveHours = timeLogsForMonth.reduce((sum, e) => sum + (e.is_idle ? 0 : (e.hours_logged || 0)), 0);
    const totalNonProductiveHours = timeLogsForMonth.reduce((sum, e) => sum + (e.is_idle ? (e.hours_logged || 0) : 0), 0);

    // Training hours come from the same KPI engine (details.technicians[].training_hours)
    // as the Availability/Utilization dialogs already use, NOT the separate TrainingLog
    // collection — technicians log training as a time-entry category ("Training"), never
    // through the disconnected TrainingForm/TrainingLog pipeline. Reusing kpiDetails keeps
    // this number consistent with what's already shown elsewhere, and it's already scoped
    // to the current daily/weekly/last_week/monthly view since operationalMetrics refetches
    // on selectedView changes.
    const totalTrainingHours = React.useMemo(() => {
        const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
        return (kpiDetails?.technicians || []).reduce((sum, t) => sum + Number(t.training_hours ?? 0), 0);
    }, [operationalMetrics, lastOperationalMetrics]);

    const overtimeRowsForMonth = React.useMemo(() => {
        // overtime_hours on time log rows (already scoped to selectedMonth by timeLogsForMonth)
        const rows = (timeLogsForMonth || [])
            .filter((l) => Number(l?.overtime_hours || 0) > 0)
            .map((l) => {
                const techId = l?.technician_id;
                const technicianName =
                    l?.technician_name ||
                    technicianNameById[String(techId ?? '')] ||
                    (typeof techId === 'string' ? techId : '');

                const logDate = l?.log_date ? parseISO(l.log_date) : null;
                const dateLabel = logDate ? logDate.toISOString().slice(0, 10) : '-';

                return {
                    id: l?.id || l?._id || `${techId}-${l?.log_date || ''}-${l?.job_id || ''}`,
                    technician_id: techId,
                    technician_name: technicianName,
                    date: dateLabel,
                    overtime_hours: Number(l?.overtime_hours || 0),
                    job_id: l?.job_id || l?.job_number || ''
                };
            });

        // Sort desc by date, then by technician name
        return rows.sort((a, b) => {
            const ad = a.date === '-' ? '' : a.date;
            const bd = b.date === '-' ? '' : b.date;
            return bd.localeCompare(ad) || String(a.technician_name || '').localeCompare(String(b.technician_name || ''));
        });
    }, [timeLogsForMonth, technicianNameById]);

    const overtimeByTechnician = React.useMemo(() => {
        const map = new Map();
        for (const r of overtimeRowsForMonth) {
            const key = String(r?.technician_id ?? '');
            if (!map.has(key)) {
                map.set(key, {
                    technician_id: r?.technician_id,
                    technician_name: r?.technician_name,
                    total_overtime_hours: 0,
                    entries: []
                });
            }
            const item = map.get(key);
            item.total_overtime_hours += Number(r.overtime_hours || 0);
            item.entries.push(r);
        }

        return Array.from(map.values()).sort((a, b) => b.total_overtime_hours - a.total_overtime_hours);
    }, [overtimeRowsForMonth]);

    const techKpiData = React.useMemo(() => {
        const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
        if (!kpiDetails?.technicians?.length) return {};

        const result = {};
        for (const td of kpiDetails.technicians) {
            const id = String(td.technician_id);

            let activeJobs = 0;
            let completedJobs = 0;
            let totalAllocatedHours = 0;
            for (const job of (jobs || [])) {
                const techEntry = (job.technicians || []).find(
                    t => String(t.technician_id) === id
                );
                if (!techEntry) continue;
                if (job.status === 'completed') {
                    completedJobs++;
                } else {
                    activeJobs++;
                }
                totalAllocatedHours += Number(techEntry.allocated_hours || 0);
            }

            const overtimeHours = (timeLogsForMonth || [])
                .filter(e => String(e.technician_id?._id || e.technician_id || '') === id)
                .reduce((sum, e) => sum + Number(e.overtime_hours || 0), 0);

            result[id] = {
                active_jobs:               activeJobs,
                completed_jobs:            completedJobs,
                total_allocated_hours:     totalAllocatedHours,
                total_hours:               td.available_hours,
                total_overtime_hours:      overtimeHours,
                total_productive_hours:    td.productive_hours,
                total_non_productive_hours: td.non_productive_hours + td.idle_hours,
                total_hours_utilized:      td.productive_hours + td.training_hours,
                efficiency_percent:        td.efficiency_percent,
                utilization_percent:       td.utilization_percent,
                productivity_percent:      td.productivity_percent,
                leave_days:                td.leave_days || 0,
                sick_days:                 td.sick_days || 0,
                team_building_days:        td.team_building_days || 0,
                training_hours:            td.training_hours || 0,
            };
        }
        return result;
    }, [operationalMetrics, lastOperationalMetrics, jobs, timeLogsForMonth]);

    const selectedJobIssues = selectedJobDetails

        ? (jobReports || []).filter((r) => {
            if (!r?.has_bottleneck) return false;
            const rid = String(r?.job_id || '');
            const jobId = String(selectedJobDetails?.id || '');
            const jobNumber = String(selectedJobDetails?.job_number || '');
            return (rid && jobId && rid === jobId) || (rid && jobNumber && rid === jobNumber);
        })
        : [];

    // The job dialog loads this job's own entries and reports. The workshop-wide
    // timeLogs/jobReports lists only hold the latest 500/200, so older or long-running
    // jobs were missing entries and notes. Keys sit under ['timeLogs'] / ['jobReports']
    // so the existing invalidations after edits/approvals refresh these too.
    const selectedJobNumber = selectedJobDetails?.job_number ? String(selectedJobDetails.job_number) : '';
    const { data: selectedJobLogsData } = useQuery({
        queryKey: ['timeLogs', 'job', selectedJobNumber],
        queryFn: () => base44.entities.DailyTimeEntry.listForJob(selectedJobNumber),
        enabled: isAuthenticated && !!selectedJobNumber
    });
    const { data: selectedJobReportsData } = useQuery({
        queryKey: ['jobReports', 'job', selectedJobNumber],
        queryFn: () => base44.entities.JobReport.listForJob(selectedJobNumber),
        enabled: isAuthenticated && !!selectedJobNumber
    });

    const selectedJobWorkLogs = selectedJobNumber
        ? (Array.isArray(selectedJobLogsData) ? selectedJobLogsData : (timeLogs || []))
            .filter((l) => !l?.is_idle && String(l?.job_id) === selectedJobNumber)
            .slice()
            .sort((a, b) => String(b.log_date || '').localeCompare(String(a.log_date || '')))
        : [];

    const selectedJobReportEntries = selectedJobNumber
        ? (Array.isArray(selectedJobReportsData) ? selectedJobReportsData : (jobReports || []))
            .filter((r) => String(r?.job_id || '') === selectedJobNumber)
        : [];

    // Each report belongs to the time entry it was filed with (daily_time_entry_id).
    // Reports whose entry was since deleted fall back to the same technician + day.
    // Anything still unmatched is listed separately so no note is ever hidden.
    const { reportsByLogId: selectedJobReportsByLogId, unmatchedReports: selectedJobUnmatchedReports } = (() => {
        const byLogId = new Map();
        const unmatched = [];
        const logIds = new Set(selectedJobWorkLogs.map((l) => String(l.id || l._id)));
        const firstLogForTechDay = new Map();
        for (const l of selectedJobWorkLogs) {
            const key = `${String(l.technician_id?._id || l.technician_id || '')}|${dayKey(l.log_date)}`;
            if (!firstLogForTechDay.has(key)) firstLogForTechDay.set(key, String(l.id || l._id));
        }
        for (const r of selectedJobReportEntries) {
            const linked = r?.daily_time_entry_id ? String(r.daily_time_entry_id) : '';
            const logId = (linked && logIds.has(linked))
                ? linked
                : firstLogForTechDay.get(`${String(r?.technician_id || '')}|${dayKey(r?.date)}`);
            if (logId) {
                if (!byLogId.has(logId)) byLogId.set(logId, []);
                byLogId.get(logId).push(r);
            } else {
                unmatched.push(r);
            }
        }
        return { reportsByLogId: byLogId, unmatchedReports: unmatched };
    })();

    const getSubtaskTitle = (subtaskId) => {
        if (!selectedJobDetails || !subtaskId) return '';
        const st = (selectedJobDetails.subtasks || []).find((s) => String(s?._id || s?.id) === String(subtaskId));
        return st?.title || '';
    };

    const productivityRaw = totalHours > 0 ? (totalProductiveHours / totalHours) * 100 : 0;
    const productivity = Math.max(0, Math.min(100, productivityRaw));

    const getStandardProductiveHoursForDate = (dateObj) => {
        const dayIndex = dateObj.getDay();
        if (dayIndex === 5) return 6;
        return 7;
    };

    const utilizationDenom = totalProductiveHours + totalNonProductiveHours;
    const labourUtilizationRaw = utilizationDenom > 0
        ? (totalProductiveHours / utilizationDenom) * 100
        : 0;
    const labourUtilization = Math.max(0, Math.min(100, labourUtilizationRaw));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/90 backdrop-blur-lg border-b border-yellow-500/20 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3">
                                <div className="p-1 rounded-xl bg-yellow-400/20 backdrop-blur">
                                    <img
                                        src={epirocLogo}
                                        alt="Epiroc"
                                        className="h-12 w-12 object-contain"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-yellow-400 tracking-tight">EPIROC</h1>
                                    <p className="text-slate-400 text-xs tracking-widest">{dashboardLabel}</p>
                                    {currentUser?.email && (
                                        <p className="text-slate-500 text-xs">{currentUser.email}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {supervisorRole === 'manager' && supervisorAccess.includes('workshop_overview') && (
                                <Button
                                    variant="outline"
                                    className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10 h-10 px-4"
                                    onClick={() => { window.location.href = createPageUrl('WorkshopOverview'); }}
                                >
                                    Workshop Overview
                                </Button>
                            )}

                            {workshopButtons.map((w) => (
                                <Button
                                    key={w.key}
                                    variant={supervisorKey === w.key ? 'default' : 'outline'}
                                    className={
                                        supervisorKey === w.key
                                            ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold h-10 px-4'
                                            : 'border-slate-600 text-slate-200 hover:bg-slate-700/40 h-10 px-4'
                                    }
                                    onClick={() => handleSwitchWorkshop(w.key)}
                                >
                                    {w.label}
                                </Button>
                            ))}

                            <HRExportButton timeEntries={timeLogsForMonth} technicians={technicians} loadEntries={loadTimeLogsForPeriod} />
                            <ExportButton entries={timeLogsForMonth} technicians={technicians} filename="epiroc_timesheet" loadEntries={loadTimeLogsForPeriod} />
                            <WeeklyExecutiveReport supervisorKey={supervisorKey} technicians={technicians} />
                            <JobAllocationModal 
                                technicians={technicians}
                                existingJobs={jobs}
                                onSubmit={createJobMutation.mutateAsync}
                                isOpen={jobModalOpen}
                                setIsOpen={setJobModalOpen}
                                preselectedTechnician={selectedTechnician}
                            />
                            <GlobalTechnicianSelector
                                isOpen={globalTechSelectorOpen}
                                setIsOpen={setGlobalTechSelectorOpen}
                                onTechnicianSelect={(technician) => {
                                    // Set the selected technician and open job allocation modal
                                    setSelectedTechnician(technician);
                                    setGlobalTechSelectorOpen(false);
                                    setJobModalOpen(true);
                                }}
                                currentSupervisorKey={currentUser?.supervisor_key}
                            />
                            <TechnicianModal
                                onAdd={createTechnicianMutation.mutateAsync}
                                isOpen={techModalOpen}
                                setIsOpen={setTechModalOpen}
                            />
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <MonthlyArchiveManager timeEntries={timeLogs} technicians={technicians} />
                    <div className="flex items-center gap-2">
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => {
                                const next = e.target.value;
                                if (!next) return;
                                setSelectedMonth(next);
                                handleViewChange('monthly');
                            }}
                            className="w-44 bg-white"
                        />
                    </div>
                </div>

                {/* Management KPI Header */}
                <div className="mb-8">
                    {(() => {
                        const m          = operationalMetrics ?? lastOperationalMetrics;
                        const kpiHasData = m?.hasData ?? null;

                        console.log('[KPI TRACE] Dashboard — rendering KPI header', { hasData: kpiHasData, periodLabel, m });

                        const showEmptyBanner = !isLoading && operationalMetrics !== null && kpiHasData === false;

                        return (
                            <>
                                {showEmptyBanner && (
                                    <div className="flex items-start gap-2 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                        <span className="mt-0.5 flex-shrink-0 text-lg" role="img" aria-label="warning">!</span>
                                        <span>
                                            {selectedView === 'daily' && new Date().getHours() < 10
                                                ? "No data yet - it's still early in the day. KPIs will update as activity is recorded."
                                                : `No activity data recorded yet for ${periodLabel}. KPIs will appear once work is logged.`
                                            }
                                        </span>
                                    </div>
                                )}

                                <ManagementKPIHeader
                                    metricsData={{
                                        productive_percent:     m?.productivity_percent    ?? null,
                                        non_productive_percent: m?.non_productive_percent  ?? null,
                                        idle_percent:           m?.idle_percent            ?? null,
                                        efficiency_percent:     m?.efficiency_percent      ?? null,
                                        availability_percent:   m?.availability_percent    ?? null,
                                        utilization_percent:    m?.utilization_percent     ?? null,
                                        completed_jobs:    hasCombinedWorkshopKpis ? (m?.completed_jobs ?? completedJobs.length) : completedJobs.length,
                                        jobs_at_risk:      hasCombinedWorkshopKpis ? (m?.jobs_at_risk ?? atRiskJobs.length) : atRiskJobs.length,
                                        overtime_hours:    hasCombinedWorkshopKpis ? (m?.overtime_hours ?? totalOvertimeHours) : totalOvertimeHours,
                                        training_hours:    hasCombinedWorkshopKpis ? (m?.training_hours ?? totalTrainingHours) : totalTrainingHours,
                                        total_technicians: hasCombinedWorkshopKpis ? (m?.total_technicians ?? technicians.filter(t => t.status === 'active').length) : technicians.filter(t => t.status === 'active').length,
                                    }}
                                    hasData={kpiHasData}
                                    isLoading={isLoading || operationalMetrics === null}
                                    currentUser={currentUser}
                                    selectedDate={periodLabel}
                                    onJobsAtRiskClick={() => { setShowAtRiskDetails(true); }}
                                    onCompletedJobsClick={() => { setCompletedDialogOpen(true); }}
                                    onOvertimeHoursClick={() => { setShowOvertimeDetails(true); }}
                                    onProductiveHoursClick={handleProductiveClick}
                                    onUtilizationClick={handleUtilizationClick}
                                    onNonProductiveClick={handleNonProductiveClick}
                                    onEfficiencyClick={handleEfficiencyClick}
                                    onAvailabilityClick={handleAvailabilityClick}
                                    onTrainingClick={handleTrainingClick}
                                />
                            </>
                        );
                    })()}
                </div>

                {/* Date Range Filters */}
                <div className="mb-8">
                    <DateRangeFilter
                        selectedView={selectedView}
                        onViewChange={handleViewChange}
                        workshopId={selectedWorkshop}
                        onWorkshopChange={setSelectedWorkshop}
                        compact={false}
                    />
                </div>







                {/* Hidden component to fetch operational metrics for KPI cards */}
                <div style={{ display: 'none' }}>
                    <OperationalMetricsFetcher
                        technicians={technicians}
                        selectedMonth={selectedMonth}
                        supervisorKey={supervisorKey}
                        timeView={
                            selectedView === 'daily' ? 'daily'
                            : selectedView === 'weekly' ? 'weekly'
                            : selectedView === 'last_week' ? 'last_week'
                            : 'monthly'
                        }
                        weekStart={weekStart}
                        weekEnd={weekEnd}
                        lastWeekStart={lastWeekStart}
                        lastWeekEnd={lastWeekEnd}
                        onOperationalMetricsUpdate={handleOperationalMetricsUpdate}
                        onMonthlySummariesUpdate={handleMonthlySummariesUpdate}
                        refreshKey={kpiRefreshKey}
                    />
                </div>


                <Dialog open={showAtRiskDetails} onOpenChange={setShowAtRiskDetails}>
                    <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Jobs at Risk</DialogTitle>
                            <DialogDescription className="sr-only">
                                List of jobs that require supervisor attention.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="overflow-y-auto max-h-[calc(85vh-6rem)]">
                            {atRiskJobs.length === 0 ? (
                                <div className="p-6 text-center text-slate-500">
                                    No jobs at risk.
                                </div>
                            ) : (
                                <AtRiskJobs
                                    jobs={atRiskJobs}
                                    jobReports={jobReports}
                                    onSelectJob={(job) => {
                                        openJobDetails(job);
                                        setShowAtRiskDetails(false);
                                    }}
                                />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={showOvertimeDetails} onOpenChange={setShowOvertimeDetails}>
                    <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Overtime Details</DialogTitle>
                            <DialogDescription className="sr-only">
                                List of technicians and overtime hours booked during the selected month.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="overflow-y-auto max-h-[calc(85vh-6rem)]">
                            {overtimeByTechnician.length === 0 ? (
                                <div className="p-6 text-center text-slate-500">
                                    No overtime booked in this month.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {overtimeByTechnician.map((t) => (
                                        <div key={String(t?.technician_id ?? '')} className="rounded-lg border border-slate-200 bg-white/95">
                                            <div className="p-4 border-b border-slate-100 flex items-baseline justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-800">
                                                        {t?.technician_name || 'Technician'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">Technician overtime summary</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-orange-700">
                                                        {Number(t?.total_overtime_hours || 0).toFixed(1)} hrs
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-slate-50">
                                                                <TableHead>Date</TableHead>
                                                                <TableHead className="text-right">Overtime Hours</TableHead>
                                                                <TableHead className="text-right">Job ID</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {Array.isArray(t?.entries) && t.entries.length > 0 ? (
                                                                t.entries
                                                                    .slice()
                                                                    .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))
                                                                    .map((r, idx) => (
                                                                        <TableRow key={String(r?.id || `${t?.technician_id}-${idx}`)}>
                                                                            <TableCell>{r?.date || '-'}</TableCell>
                                                                            <TableCell className="text-right">{Number(r?.overtime_hours || 0).toFixed(1)}h</TableCell>
                                                                            <TableCell className="text-right font-mono text-xs">{r?.job_id || '-'}</TableCell>
                                                                        </TableRow>
                                                                    ))
                                                            ) : (
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-center text-slate-500 py-6">
                                                                        No overtime entries.
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Productive Hours — per-technician performance ──────────── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = (kpiDetails?.technicians || [])
                        .filter(t => t.productive_hours > 0 || t.available_productive_hours > 0)
                        .sort((a, b) => b.productivity_percent - a.productivity_percent);
                    return (
                        <Dialog open={showProductiveDetails} onOpenChange={setShowProductiveDetails}>
                            <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Productive Hours — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Productivity % = Productive ÷ Available Productive hours. Sorted highest to lowest.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)] space-y-5">
                                    {techs.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500">No productive hours recorded for this period.</div>
                                    ) : (
                                        <>
                                            {/* ── Per-technician summary ── */}
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                        <TableHead>Technician</TableHead>
                                                        <TableHead className="text-right">Productive hrs</TableHead>
                                                        <TableHead className="text-right">Available hrs</TableHead>
                                                        <TableHead className="text-right font-semibold">Productivity %</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {techs.map(t => {
                                                        const pct = Number(t.productivity_percent ?? 0);
                                                        const color = pct >= 85 ? 'text-green-700' : pct >= 70 ? 'text-yellow-600' : 'text-red-600';
                                                        const badge = pct >= 85 ? 'Excellent' : pct >= 70 ? 'Good' : 'Low';
                                                        const badgeBg = pct >= 85 ? 'bg-green-100 text-green-800' : pct >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                                                        return (
                                                            <TableRow key={t.technician_id}>
                                                                <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                                <TableCell className="text-right text-green-700 font-medium">{Number(t.productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-500">{Number(t.available_productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className={`text-right font-bold ${color}`}>{pct.toFixed(1)}%</TableCell>
                                                                <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badge}</span></TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {techs.length > 0 && (() => {
                                                        const prod   = techs.reduce((s, t) => s + Number(t.productive_hours ?? 0), 0);
                                                        const avProd = techs.reduce((s, t) => s + Number(t.available_productive_hours ?? 0), 0);
                                                        const pct = avProd > 0 ? (prod / avProd * 100) : 0;
                                                        return (
                                                            <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                                <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                                <TableCell className="text-right text-green-800">{prod.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-700">{avProd.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-800 font-bold">{pct.toFixed(1)}%</TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        );
                                                    })()}
                                                </TableBody>
                                            </Table>

                                            {/* ── Per-technician entry detail ── */}
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Entry Detail</p>
                                                {techs.filter(t => t.productive_hours > 0).map(t => (
                                                    <div key={t.technician_id} className="rounded-lg border border-slate-200 bg-white/95">
                                                        <div className="px-4 py-2 border-b border-slate-100 flex items-baseline justify-between">
                                                            <span className="font-semibold text-slate-800 text-sm">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</span>
                                                            <span className="text-sm font-bold text-green-700">{Number(t.productive_hours).toFixed(1)}h</span>
                                                        </div>
                                                        <div className="p-3">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-slate-50">
                                                                        <TableHead>Date</TableHead>
                                                                        <TableHead>Job ID</TableHead>
                                                                        <TableHead className="text-right">Hours</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(t.productive_entries || []).map((e, i) => (
                                                                        <TableRow key={i}>
                                                                            <TableCell>{e.date}</TableCell>
                                                                            <TableCell className="font-mono text-sm">{e.job_id || '—'}</TableCell>
                                                                            <TableCell className="text-right">{Number(e.hours).toFixed(1)}h</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                {/* ── Utilization — per-technician performance ───────────────── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = [...(kpiDetails?.technicians || [])]
                        .sort((a, b) => b.utilization_percent - a.utilization_percent);
                    return (
                        <Dialog open={showUtilizationDetails} onOpenChange={setShowUtilizationDetails}>
                            <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Utilization Breakdown — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Utilization % = (Productive + Training) ÷ Available Productive hours. Sorted highest to lowest.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)] space-y-5">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                <TableHead>Technician</TableHead>
                                                <TableHead className="text-right">Productive</TableHead>
                                                <TableHead className="text-right">Training</TableHead>
                                                <TableHead className="text-right">Non-Prod</TableHead>
                                                <TableHead className="text-right">Idle</TableHead>
                                                <TableHead className="text-right">Leave</TableHead>
                                                <TableHead className="text-right">Scheduled</TableHead>
                                                <TableHead className="text-right font-semibold">Utilization %</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {techs.map(t => {
                                                const pct = Number(t.utilization_percent ?? 0);
                                                const color = pct >= 85 ? 'text-green-700' : pct >= 70 ? 'text-yellow-600' : 'text-red-600';
                                                const badge = pct >= 85 ? 'Excellent' : pct >= 70 ? 'Good' : 'Low';
                                                const badgeBg = pct >= 85 ? 'bg-green-100 text-green-800' : pct >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                                                return (
                                                    <TableRow key={t.technician_id}>
                                                        <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                        <TableCell className="text-right text-green-700 font-medium">{Number(t.productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-blue-700">{Number(t.training_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-orange-700">{Number(t.non_productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-slate-500">{Number(t.idle_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-red-500">{Number(t.not_available_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-slate-500">{Number(t.scheduled_hours ?? 0).toFixed(1)}h</TableCell>
                                                        <TableCell className={`text-right font-bold ${color}`}>{pct.toFixed(1)}%</TableCell>
                                                        <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badge}</span></TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {techs.length > 0 && (() => {
                                                const prod  = techs.reduce((s, t) => s + Number(t.productive_hours     ?? 0), 0);
                                                const train = techs.reduce((s, t) => s + Number(t.training_hours       ?? 0), 0);
                                                const np    = techs.reduce((s, t) => s + Number(t.non_productive_hours ?? 0), 0);
                                                const idle  = techs.reduce((s, t) => s + Number(t.idle_hours           ?? 0), 0);
                                                const leave = techs.reduce((s, t) => s + Number(t.not_available_hours  ?? 0), 0);
                                                const sched = techs.reduce((s, t) => s + Number(t.scheduled_hours      ?? 0), 0);
                                                const pct = sched > 0 ? ((prod + train) / sched * 100) : 0;
                                                return (
                                                    <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                        <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                        <TableCell className="text-right text-green-800">{prod.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-blue-800">{train.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-orange-800">{np.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-slate-700">{idle.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-red-700">{leave.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-slate-700">{sched.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-right text-slate-800 font-bold">{pct.toFixed(1)}%</TableCell>
                                                        <TableCell />
                                                    </TableRow>
                                                );
                                            })()}
                                        </TableBody>
                                    </Table>

                                    {/* ── Entry detail: job + training entries (utilization numerator) ── */}
                                    {techs.some(t => (t.productive_hours ?? 0) > 0 || (t.training_hours ?? 0) > 0) && (
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Entry Detail — Value-Adding Time</p>
                                            {techs
                                                .filter(t => (t.productive_hours ?? 0) > 0 || (t.training_hours ?? 0) > 0)
                                                .map(t => {
                                                    const combined = [
                                                        ...(t.productive_entries || []).map(e => ({ ...e, _type: 'productive' })),
                                                        ...(t.training_entries   || []).map(e => ({ ...e, _type: 'training'  })),
                                                    ].sort((a, b) => a.date.localeCompare(b.date));
                                                    return (
                                                        <div key={t.technician_id} className="rounded-lg border border-slate-200 bg-white/95">
                                                            <div className="px-4 py-2 border-b border-slate-100 flex items-baseline justify-between gap-3">
                                                                <span className="font-semibold text-slate-800 text-sm">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</span>
                                                                <div className="flex gap-3 text-xs">
                                                                    {(t.productive_hours ?? 0) > 0 && <span className="text-green-700">{Number(t.productive_hours).toFixed(1)}h productive</span>}
                                                                    {(t.training_hours ?? 0) > 0  && <span className="text-blue-700">{Number(t.training_hours).toFixed(1)}h training</span>}
                                                                </div>
                                                            </div>
                                                            <div className="p-3">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-slate-50">
                                                                            <TableHead>Date</TableHead>
                                                                            <TableHead>Job / Category</TableHead>
                                                                            <TableHead>Type</TableHead>
                                                                            <TableHead className="text-right">Hours</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {combined.map((e, i) => (
                                                                            <TableRow key={i}>
                                                                                <TableCell>{e.date}</TableCell>
                                                                                <TableCell>
                                                                                    <span className={e._type === 'training' ? 'text-blue-700 font-medium' : 'text-green-700 font-medium'}>
                                                                                        {e._type === 'training' ? (e.category || 'Training') : (e.job_id || '—')}
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell className="text-xs text-slate-400 capitalize">
                                                                                    {e._type === 'training' ? 'Training' : 'Productive'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">{Number(e.hours).toFixed(1)}h</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                {/* ── Non-Productive — per-technician performance ────────────── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = (kpiDetails?.technicians || [])
                        .filter(t => (t.training_hours + t.non_productive_hours + t.idle_hours) > 0)
                        .sort((a, b) => b.non_productive_percent - a.non_productive_percent);
                    return (
                        <Dialog open={showNonProductiveDetails} onOpenChange={setShowNonProductiveDetails}>
                            <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Non-Productive & Idle Hours — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Non-Productive % = (Training + Non-Productive + Idle) ÷ Available productive hours (7.5h Mon-Thu, 6h Fri). Sorted highest (worst) first.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)] space-y-5">
                                    {techs.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500">No non-productive or idle hours recorded for this period.</div>
                                    ) : (
                                        <>
                                            {/* ── Per-technician summary ── */}
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                        <TableHead>Technician</TableHead>
                                                        <TableHead className="text-right text-blue-700">Training</TableHead>
                                                        <TableHead className="text-right text-orange-700">Non-Productive</TableHead>
                                                        <TableHead className="text-right text-slate-500">Idle</TableHead>
                                                        <TableHead className="text-right">Available</TableHead>
                                                        <TableHead className="text-right font-semibold">Non-Prod %</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {techs.map(t => {
                                                        const pct = Number(t.non_productive_percent ?? 0);
                                                        const color = pct <= 20 ? 'text-green-700' : pct <= 35 ? 'text-yellow-600' : 'text-red-600';
                                                        const badge = pct <= 20 ? 'Good' : pct <= 35 ? 'Moderate' : 'High';
                                                        const badgeBg = pct <= 20 ? 'bg-green-100 text-green-800' : pct <= 35 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                                                        return (
                                                            <TableRow key={t.technician_id}>
                                                                <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                                <TableCell className="text-right text-blue-700">{Number(t.training_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-orange-700">{Number(t.non_productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-500">{Number(t.idle_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-500">{Number(t.available_productive_hours ?? t.available_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className={`text-right font-bold ${color}`}>{pct.toFixed(1)}%</TableCell>
                                                                <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badge}</span></TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {techs.length > 0 && (() => {
                                                        const train = techs.reduce((s, t) => s + Number(t.training_hours       ?? 0), 0);
                                                        const np    = techs.reduce((s, t) => s + Number(t.non_productive_hours ?? 0), 0);
                                                        const idle  = techs.reduce((s, t) => s + Number(t.idle_hours           ?? 0), 0);
                                                        const avHrs = techs.reduce((s, t) => s + Number(t.available_productive_hours ?? t.available_hours ?? 0), 0);
                                                        const pct = avHrs > 0 ? ((train + np + idle) / avHrs * 100) : 0;
                                                        return (
                                                            <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                                <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                                <TableCell className="text-right text-blue-800">{train.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-orange-800">{np.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-700">{idle.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-700">{avHrs.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-800 font-bold">{pct.toFixed(1)}%</TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        );
                                                    })()}
                                                </TableBody>
                                            </Table>

                                            {/* ── Per-technician entry detail ── */}
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Entry Detail</p>
                                                {techs.map(t => {
                                                    const combined = [
                                                        ...(t.training_entries       || []).map(e => ({ ...e, _type: 'training' })),
                                                        ...(t.non_productive_entries || []).map(e => ({ ...e, _type: 'non_productive' })),
                                                        ...(t.idle_entries           || []).map(e => ({ ...e, _type: 'idle' })),
                                                    ].sort((a, b) => a.date.localeCompare(b.date));
                                                    return (
                                                        <div key={t.technician_id} className="rounded-lg border border-slate-200 bg-white/95">
                                                            <div className="px-4 py-2 border-b border-slate-100 flex items-baseline justify-between gap-3">
                                                                <span className="font-semibold text-slate-800 text-sm">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</span>
                                                                <div className="flex gap-3 text-xs">
                                                                    {t.training_hours > 0 && <span className="text-blue-700">{Number(t.training_hours).toFixed(1)}h training</span>}
                                                                    {t.non_productive_hours > 0 && <span className="text-orange-700">{Number(t.non_productive_hours).toFixed(1)}h non-prod</span>}
                                                                    {t.idle_hours > 0 && <span className="text-slate-500">{Number(t.idle_hours).toFixed(1)}h idle</span>}
                                                                </div>
                                                            </div>
                                                            <div className="p-3">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-slate-50">
                                                                            <TableHead>Date</TableHead>
                                                                            <TableHead>Category</TableHead>
                                                                            <TableHead>Type</TableHead>
                                                                            <TableHead className="text-right">Hours</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {combined.map((e, i) => (
                                                                            <TableRow key={i}>
                                                                                <TableCell>{e.date}</TableCell>
                                                                                <TableCell>
                                                                                    <span className={
                                                                                        e._type === 'training' ? 'text-blue-700 font-medium'
                                                                                        : e._type === 'idle'   ? 'text-slate-500'
                                                                                        : 'text-orange-700'
                                                                                    }>
                                                                                        {e._type === 'idle' && e.sub_reason ? `${e.category} – ${e.sub_reason}` : e.category}
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell className="text-xs text-slate-400 capitalize">
                                                                                    {e._type === 'training' ? 'Training' : e._type === 'idle' ? 'Idle' : 'Non-Productive'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">{Number(e.hours).toFixed(1)}h</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                {/* ── Efficiency — per-technician performance ────────────────── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = [...(kpiDetails?.technicians || [])]
                        .sort((a, b) => b.efficiency_percent - a.efficiency_percent);
                    return (
                        <Dialog open={showEfficiencyDetails} onOpenChange={setShowEfficiencyDetails}>
                            <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Efficiency Breakdown — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Efficiency % = Productive ÷ All Logged hours (productive + training + non-productive + idle). Sorted highest to lowest.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)]">
                                    {techs.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500">No data recorded for this period.</div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead className="text-right text-green-700">Productive</TableHead>
                                                    <TableHead className="text-right text-blue-700">Training</TableHead>
                                                    <TableHead className="text-right text-orange-700">Non-Productive</TableHead>
                                                    <TableHead className="text-right text-slate-500">Idle</TableHead>
                                                    <TableHead className="text-right">Total Logged</TableHead>
                                                    <TableHead className="text-right font-semibold">Efficiency %</TableHead>
                                                    <TableHead className="text-right">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {techs.map(t => {
                                                    const prod  = Number(t.productive_hours      ?? 0);
                                                    const train = Number(t.training_hours        ?? 0);
                                                    const np    = Number(t.non_productive_hours  ?? 0);
                                                    const idle  = Number(t.idle_hours            ?? 0);
                                                    const total = prod + train + np + idle;
                                                    const pct   = Number(t.efficiency_percent ?? 0);
                                                    const color = pct >= 85 ? 'text-green-700' : pct >= 70 ? 'text-yellow-600' : 'text-red-600';
                                                    const badge = pct >= 85 ? 'Excellent' : pct >= 70 ? 'Good' : 'Low';
                                                    const badgeBg = pct >= 85 ? 'bg-green-100 text-green-800' : pct >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                                                    return (
                                                        <TableRow key={t.technician_id}>
                                                            <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                            <TableCell className="text-right text-green-700 font-medium">{prod.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-blue-700">{train.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-orange-700">{np.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-slate-500">{idle.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-slate-600">{total.toFixed(1)}h</TableCell>
                                                            <TableCell className={`text-right font-bold ${color}`}>{pct.toFixed(1)}%</TableCell>
                                                            <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badge}</span></TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                {techs.length > 0 && (() => {
                                                    const prod  = techs.reduce((s, t) => s + Number(t.productive_hours     ?? 0), 0);
                                                    const train = techs.reduce((s, t) => s + Number(t.training_hours       ?? 0), 0);
                                                    const np    = techs.reduce((s, t) => s + Number(t.non_productive_hours ?? 0), 0);
                                                    const idle  = techs.reduce((s, t) => s + Number(t.idle_hours           ?? 0), 0);
                                                    const total = prod + train + np + idle;
                                                    const pct   = total > 0 ? (prod / total * 100) : 0;
                                                    return (
                                                        <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                            <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                            <TableCell className="text-right text-green-800">{prod.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-blue-800">{train.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-orange-800">{np.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-slate-700">{idle.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-slate-700">{total.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-slate-800 font-bold">{pct.toFixed(1)}%</TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    );
                                                })()}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                {/* ── Availability — per-technician leave/sick/training ──────── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = (kpiDetails?.technicians || [])
                        .filter(t => (t.not_available_hours ?? 0) > 0 || (t.training_hours ?? 0) > 0)
                        .sort((a, b) => {
                            const pctA = (a.scheduled_hours ?? 0) > 0 ? ((a.available_hours ?? 0) / a.scheduled_hours * 100) : 100;
                            const pctB = (b.scheduled_hours ?? 0) > 0 ? ((b.available_hours ?? 0) / b.scheduled_hours * 100) : 100;
                            return pctA - pctB; // lowest availability first (worst first)
                        });
                    return (
                        <Dialog open={showAvailabilityDetails} onOpenChange={setShowAvailabilityDetails}>
                            <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Availability Breakdown — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Availability % = Available hours ÷ Scheduled hours. Sorted lowest (worst) first.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)] space-y-5">
                                    {techs.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500">No leave, sick, or training hours recorded for this period.</div>
                                    ) : (
                                        <>
                                            {/* ── Per-technician summary ── */}
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                        <TableHead>Technician</TableHead>
                                                        <TableHead className="text-right text-red-600">Leave / Sick</TableHead>
                                                        <TableHead className="text-right text-blue-700">Training</TableHead>
                                                        <TableHead className="text-right">Scheduled</TableHead>
                                                        <TableHead className="text-right font-semibold">Availability %</TableHead>
                                                        <TableHead className="text-right">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {techs.map(t => {
                                                        const avPct = (t.scheduled_hours ?? 0) > 0
                                                            ? ((t.available_hours ?? 0) / t.scheduled_hours * 100)
                                                            : 100;
                                                        const color  = avPct >= 95 ? 'text-green-700' : avPct >= 80 ? 'text-yellow-600' : 'text-red-600';
                                                        const badge  = avPct >= 95 ? 'Excellent' : avPct >= 80 ? 'Good' : 'Low';
                                                        const badgeBg = avPct >= 95 ? 'bg-green-100 text-green-800' : avPct >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                                                        return (
                                                            <TableRow key={t.technician_id}>
                                                                <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                                <TableCell className="text-right text-red-600 font-medium">{Number(t.not_available_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-blue-700">{Number(t.training_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-500">{Number(t.scheduled_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className={`text-right font-bold ${color}`}>{avPct.toFixed(1)}%</TableCell>
                                                                <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badge}</span></TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {techs.length > 0 && (() => {
                                                        const leave   = techs.reduce((s, t) => s + Number(t.not_available_hours ?? 0), 0);
                                                        const train   = techs.reduce((s, t) => s + Number(t.training_hours       ?? 0), 0);
                                                        const sched   = techs.reduce((s, t) => s + Number(t.scheduled_hours      ?? 0), 0);
                                                        const avail   = techs.reduce((s, t) => s + Number(t.available_hours      ?? 0), 0);
                                                        const pct     = sched > 0 ? (avail / sched * 100) : 100;
                                                        return (
                                                            <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                                <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                                <TableCell className="text-right text-red-700">{leave.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-blue-800">{train.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-700">{sched.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-800 font-bold">{pct.toFixed(1)}%</TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        );
                                                    })()}
                                                </TableBody>
                                            </Table>

                                            {/* ── Per-technician entry detail ── */}
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Entry Detail</p>
                                                {techs.map(t => {
                                                    const combined = [
                                                        ...(t.not_available_entries || []).map(e => ({ ...e, _type: 'leave'    })),
                                                        ...(t.training_entries      || []).map(e => ({ ...e, _type: 'training' })),
                                                    ].sort((a, b) => a.date.localeCompare(b.date));
                                                    if (combined.length === 0) return null;
                                                    return (
                                                        <div key={t.technician_id} className="rounded-lg border border-slate-200 bg-white/95">
                                                            <div className="px-4 py-2 border-b border-slate-100 flex items-baseline justify-between gap-3">
                                                                <span className="font-semibold text-slate-800 text-sm">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</span>
                                                                <div className="flex gap-3 text-xs">
                                                                    {(t.not_available_hours ?? 0) > 0 && <span className="text-red-600">{Number(t.not_available_hours).toFixed(1)}h leave/sick</span>}
                                                                    {(t.training_hours      ?? 0) > 0 && <span className="text-blue-700">{Number(t.training_hours).toFixed(1)}h training</span>}
                                                                </div>
                                                            </div>
                                                            <div className="p-3">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-slate-50">
                                                                            <TableHead>Date</TableHead>
                                                                            <TableHead>Category</TableHead>
                                                                            <TableHead>Type</TableHead>
                                                                            <TableHead className="text-right">Hours</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {combined.map((e, i) => (
                                                                            <TableRow key={i}>
                                                                                <TableCell>{e.date}</TableCell>
                                                                                <TableCell>
                                                                                    <span className={e._type === 'training' ? 'text-blue-700 font-medium' : 'text-red-600 font-medium'}>
                                                                                        {e.category || (e._type === 'training' ? 'Training' : 'Leave')}
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell className="text-xs text-slate-400 capitalize">
                                                                                    {e._type === 'training' ? 'Training' : (e.full_day ? 'Full day' : 'Partial')}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">{Number(e.hours).toFixed(1)}h</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                {/* ── Training — per-technician training hours for the selected period ── */}
                {(() => {
                    const kpiDetails = (operationalMetrics ?? lastOperationalMetrics)?.details;
                    const techs = (kpiDetails?.technicians || [])
                        .filter(t => (t.training_hours ?? 0) > 0)
                        .sort((a, b) => (b.training_hours ?? 0) - (a.training_hours ?? 0));

                    return (
                        <Dialog open={showTrainingDetails} onOpenChange={setShowTrainingDetails}>
                            <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle className="text-slate-800">Training — {periodLabel}</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-sm">
                                        Training hours logged for the selected period.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[calc(85vh-7rem)] space-y-5">
                                    {techs.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500">No training logged for this period.</div>
                                    ) : (
                                        <>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                        <TableHead>Technician</TableHead>
                                                        <TableHead className="text-right">Sessions</TableHead>
                                                        <TableHead className="text-right">Hours</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {techs.map((t) => (
                                                        <TableRow key={t.technician_id}>
                                                            <TableCell className="font-medium">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</TableCell>
                                                            <TableCell className="text-right">{(t.training_entries || []).length}</TableCell>
                                                            <TableCell className="text-right text-indigo-700 font-medium">{Number(t.training_hours ?? 0).toFixed(1)}h</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                        <TableCell className="font-bold text-slate-800">TEAM TOTAL</TableCell>
                                                        <TableCell className="text-right">{techs.reduce((s, t) => s + (t.training_entries || []).length, 0)}</TableCell>
                                                        <TableCell className="text-right text-indigo-800">{totalTrainingHours.toFixed(1)}h</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>

                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-400 uppercase tracking-wide px-1">Entry Detail</p>
                                                {techs.map((t) => {
                                                    const entries = [...(t.training_entries || [])].sort((a, b) => a.date.localeCompare(b.date));
                                                    if (entries.length === 0) return null;
                                                    return (
                                                        <div key={t.technician_id} className="rounded-lg border border-slate-200 bg-white/95">
                                                            <div className="px-4 py-2 border-b border-slate-100 flex items-baseline justify-between gap-3">
                                                                <span className="font-semibold text-slate-800 text-sm">{technicianNameById[String(t.technician_id)] || String(t.technician_id)}</span>
                                                                <span className="text-xs text-indigo-700">{Number(t.training_hours ?? 0).toFixed(1)}h training</span>
                                                            </div>
                                                            <div className="p-3">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-slate-50">
                                                                            <TableHead>Date</TableHead>
                                                                            <TableHead>Category</TableHead>
                                                                            <TableHead className="text-right">Hours</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {entries.map((e, i) => (
                                                                            <TableRow key={i}>
                                                                                <TableCell>{e.date}</TableCell>
                                                                                <TableCell className="text-indigo-700 font-medium">{e.category || 'Training'}</TableCell>
                                                                                <TableCell className="text-right">{Number(e.hours).toFixed(1)}h</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

                <Tabs defaultValue="jobs" className="space-y-6">
                    <TabsList className="bg-slate-700/50 p-1 rounded-xl border border-slate-600">
                        <TabsTrigger 
                            value="jobs" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Briefcase className="w-4 h-4" />
                            Jobs
                        </TabsTrigger>
                        <TabsTrigger 
                            value="performance" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Performance
                        </TabsTrigger>
                        <TabsTrigger
                            value="activities"
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <ClipboardList className="w-4 h-4" />
                            Activities
                        </TabsTrigger>
                        <TabsTrigger
                            value="technicians"
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Users className="w-4 h-4" />
                            Technicians
                        </TabsTrigger>
                        <TabsTrigger 
                            value="timeLogs" 
                            className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                        >
                            <Clock className="w-4 h-4" />
                            Time Logs
                        </TabsTrigger>

                        {approvalEnabled && (
                            <TabsTrigger
                                value="approvals"
                                className="flex items-center gap-2 rounded-lg text-slate-300 data-[state=active]:bg-yellow-400 data-[state=active]:text-slate-800"
                            >
                                <Clock className="w-4 h-4" />
                                Approvals
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="jobs" className="mt-6">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-slate-800">Completed jobs report</div>
                                    <p className="text-sm text-slate-500">View every completed job with full logged work, technician hours, and notes.</p>
                                </div>
                                <Button
onClick={() => {
                                        console.log('View Completed Jobs Report clicked', {
                                            completedJobsReportOpen,
                                            supervisorKey,
                                            isFetchingCompletedJobsReport,
                                        });
                                        // Open the actual dialog (completedDialogOpen) so the button has visible effect
                                        setCompletedDialogOpen(true);
                                        // Also enable the report query (completedJobsReportOpen) if used elsewhere
                                        setCompletedJobsReportOpen(true);
                                    }}
                                    disabled={isFetchingReportJobs}
                                >
                                    {isFetchingReportJobs ? 'Loading report...' : 'View Jobs Report'}
                                </Button>
                            </div>
                            {isJobsError && (
                                <div className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <span>
                                        Couldn't load jobs: {jobsError?.message || 'Unknown error'}. The list below may be out of date.
                                    </span>
                                    <Button
                                        variant="outline"
                                        className="h-8 px-3 border-red-300 text-red-700 hover:bg-red-100"
                                        onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
                                        disabled={isFetchingJobs}
                                    >
                                        {isFetchingJobs ? 'Retrying...' : 'Retry'}
                                    </Button>
                                </div>
                            )}
                            <JobList
                                jobs={activeJobs}
                                technicians={technicians}
                                onDelete={deleteJobMutation.mutate}
                                onReassign={reassignJobMutation.mutate}
                                onAddTechnician={addTechnicianMutation.mutateAsync}
                                onSelectJob={openJobDetails}
                                onBlockTechnician={blockTechnicianMutation.mutate}
                                onUnblockTechnician={unblockTechnicianMutation.mutate}
                                isReassigning={reassignJobMutation.isPending}
                                isAddingTechnician={addTechnicianMutation.isPending}
                                isBlockingTechnician={blockTechnicianMutation.isPending || unblockTechnicianMutation.isPending}
                            />

                        </div>
                    </TabsContent>


                    <Dialog open={completedDialogOpen} onOpenChange={(open) => { setCompletedDialogOpen(open); if (!open) { setSelectedJobReport(null); setCompletedJobSearch(''); } }}>
                        <DialogContent className="sm:max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
                            <DialogHeader className="flex-shrink-0">
                                <DialogTitle className="text-slate-800 flex items-center gap-3">
                                    {selectedJobReport ? (
                                        <>
                                            <button
                                                onClick={() => setSelectedJobReport(null)}
                                                className="flex items-center gap-1 text-sm font-normal text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-1"
                                            >
                                                ← Jobs
                                            </button>
                                            <span className="font-mono text-slate-700">{selectedJobReport.job_number}</span>
                                            <span className="text-slate-500 font-normal text-base truncate max-w-sm">{selectedJobReport.description}</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="ml-auto text-xs h-8 gap-1.5"
                                                onClick={() => printJobReport(selectedJobReport)}
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                Print A4 Report
                                            </Button>
                                        </>
                                    ) : (
                                        <>Jobs Report {isFetchingReportJobs && <span className="text-sm font-normal text-slate-400 ml-2">Loading…</span>}</>
                                    )}
                                </DialogTitle>
                                <DialogDescription className="sr-only">Active and completed job reports</DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto min-h-0">
                            {/* ── LIST VIEW ── */}
                            {!selectedJobReport && (
                                <div className="space-y-2 py-2">
                                    <div className="sticky top-0 bg-white pb-2 z-10 flex flex-wrap items-center gap-3">
                                        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                            {[['active', 'Active Jobs'], ['completed', 'Completed Jobs']].map(([scope, label]) => (
                                                <button
                                                    key={scope}
                                                    type="button"
                                                    onClick={() => setJobReportScope(scope)}
                                                    className={`px-3 py-1.5 text-sm rounded-md ${jobReportScope === scope ? 'bg-white shadow-sm font-semibold text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <Input
                                            value={completedJobSearch}
                                            onChange={(e) => setCompletedJobSearch(e.target.value)}
                                            placeholder="Search by job number..."
                                            className="max-w-xs"
                                        />
                                    </div>
                                    {reportJobsData.length === 0 ? (
                                        <div className="py-16 text-center text-slate-400">
                                            {isFetchingReportJobs ? 'Fetching report…' : `No ${jobReportScope} jobs found.`}
                                        </div>
                                    ) : filteredCompletedJobsData.length === 0 ? (
                                        <div className="py-16 text-center text-slate-400">
                                            No {jobReportScope} jobs match "{completedJobSearch}".
                                        </div>
                                    ) : filteredCompletedJobsData.map(j => {
                                        const ts = j.time_summary || {};
                                        const total = Number(ts.total_hours ?? 0);
                                        const prod  = Number(ts.productive_hours ?? 0);
                                        const prodPct = total > 0 ? (prod / total * 100).toFixed(0) : '—';
                                        const endLabel = j.completed_at ? new Date(j.completed_at).toLocaleDateString() : (j.last_log_date ? new Date(j.last_log_date).toLocaleDateString() : '—');
                                        const remaining = Number(j.remaining_hours ?? 0);
                                        return (
                                            <div key={j.job_number} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="font-mono font-semibold text-slate-800">{j.job_number}</span>
                                                        <span className="text-slate-600 text-sm truncate">{j.description}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                                                        {jobReportScope === 'active' ? (
                                                            <>
                                                                <span className="capitalize font-medium text-slate-700">{String(j.status || 'in progress').replace(/_/g, ' ')}</span>
                                                                <span>{Number(j.progress_percentage || 0).toFixed(0)}% done</span>
                                                                <span>{remaining.toFixed(1)}h of {Number(j.allocated_hours || 0).toFixed(1)}h left</span>
                                                                <span>Last activity {j.last_log_date ? new Date(j.last_log_date).toLocaleDateString() : '—'}</span>
                                                            </>
                                                        ) : (
                                                            <span>Completed {endLabel}</span>
                                                        )}
                                                        <span>{total.toFixed(1)}h logged</span>
                                                        <span className={prod > 0 ? 'text-green-700 font-medium' : ''}>{prod.toFixed(1)}h productive ({prodPct}%)</span>
                                                        {(j.hours_by_technician || []).length > 0 && (
                                                            <span>{j.hours_by_technician.length} technician{j.hours_by_technician.length !== 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button size="sm" variant="outline" className="text-xs h-7 px-3" onClick={() => setSelectedJobReport(j)}>
                                                        Full Report
                                                    </Button>
                                                    {jobReportScope === 'completed' && (
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="text-xs h-7 px-2 border-green-400 text-green-700 hover:bg-green-50"
                                                        disabled={reopenJobMutation.isPending}
                                                        title="Move this job back to active so it can be edited and worked on again"
                                                        onClick={() => {
                                                            const msg = remaining > 0
                                                                ? `Make job ${j.job_number} active again? It has ${remaining.toFixed(1)}h remaining.`
                                                                : `Make job ${j.job_number} active again? Its hours are used up, so you'll need to add hours (Edit Job) before technicians can book on it.`;
                                                            if (window.confirm(msg)) {
                                                                reopenJobMutation.mutate({ jobNumber: j.job_number, remaining });
                                                            }
                                                        }}
                                                    >
                                                        {reopenJobMutation.isPending && reopenJobMutation.variables?.jobNumber === j.job_number ? 'Activating…' : 'Make Active'}
                                                    </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── DETAIL VIEW ── */}
                            {selectedJobReport && (() => {
                                const j  = selectedJobReport;
                                const ts = j.time_summary || {};
                                const prod   = Number(ts.productive_hours    ?? 0);
                                const np     = Number(ts.non_productive_hours ?? 0);
                                const idle   = Number(ts.idle_hours          ?? 0);
                                const total  = Number(ts.total_hours         ?? (prod + np + idle));
                                const prodPct  = total > 0 ? (prod  / total * 100) : 0;
                                const npPct    = total > 0 ? ((np + idle) / total * 100) : 0;
                                const startLabel = j.first_log_date ? new Date(j.first_log_date).toLocaleDateString() : (j.start_date ? new Date(j.start_date).toLocaleDateString() : '—');
                                const endLabel   = j.last_log_date  ? new Date(j.last_log_date).toLocaleDateString()  : (j.completed_at ? new Date(j.completed_at).toLocaleDateString() : '—');
                                // Training is excluded from job reports entirely: technicians can only log
                                // Training time against the non-job idle bucket (IDLE_JOB_ID), so it never
                                // carries a real job_number and has no place in a per-job breakdown.
                                const entries = (j.time_entries || []).filter(e => e.classification !== 'training');
                                const techRows = (j.hours_by_technician || []).sort((a, b) => (b.productive_hours ?? 0) - (a.productive_hours ?? 0));
                                // Every daily report filed on this job, not just ones flagged as a
                                // bottleneck - a plain "what I did today" note (work_completed with no
                                // bottleneck) used to be silently dropped here.
                                const notes = (j.job_reports || [])
                                    .filter(r => String(r.work_completed || '').trim() || r.bottleneck_description)
                                    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
                                const idleReasons = entries
                                    .filter(e => (e.classification === 'idle' || e.classification === 'non_productive') && (e.sub_reason || e.category))
                                    .reduce((acc, e) => {
                                        const key = e.sub_reason || e.category;
                                        acc[key] = (acc[key] || 0) + Number(e.hours ?? 0);
                                        return acc;
                                    }, {});

                                const classLabel  = { productive: 'Productive', non_productive: 'Non-Productive', idle: 'Idle', not_available: 'Leave/Sick' };
                                const classBadge  = { productive: 'bg-green-100 text-green-800', non_productive: 'bg-orange-100 text-orange-800', idle: 'bg-slate-100 text-slate-600', not_available: 'bg-red-100 text-red-700' };

                                return (
                                    <div className="space-y-5 py-2">
                                        {/* ── Header ── */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { label: 'Allocated', value: `${Number(j.allocated_hours ?? 0).toFixed(1)}h` },
                                                { label: 'Total Logged', value: `${total.toFixed(1)}h` },
                                                { label: 'Start', value: startLabel },
                                                j.status === 'completed'
                                                    ? { label: 'Completed', value: endLabel }
                                                    : { label: `Last Activity · ${Number(j.progress_percentage || 0).toFixed(0)}% done`, value: endLabel },
                                            ].map(s => (
                                                <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                                                    <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
                                                    <p className="text-base font-semibold text-slate-800">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* ── KPI Summary ── */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'Productivity', pct: prodPct, desc: `${prod.toFixed(1)}h productive / ${total.toFixed(1)}h total`, color: prodPct >= 70 ? 'text-green-700' : 'text-red-600' },
                                                { label: 'Non-Productive', pct: npPct, desc: `${(np + idle).toFixed(1)}h (non-productive + idle) / ${total.toFixed(1)}h`, color: npPct <= 30 ? 'text-green-700' : 'text-red-600' },
                                            ].map(k => (
                                                <div key={k.label} className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-center">
                                                    <p className="text-xs text-slate-500 mb-1">{k.label}</p>
                                                    <p className={`text-2xl font-bold ${k.color}`}>{k.pct.toFixed(1)}%</p>
                                                    <p className="text-xs text-slate-400 mt-1">{k.desc}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* ── Time Distribution ── */}
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Time Distribution</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: 'Productive',    hours: prod,  pct: prodPct,                       color: 'bg-green-100 text-green-800' },
                                                    { label: 'Non-Productive',hours: np,    pct: total > 0 ? np/total*100 : 0,    color: 'bg-orange-100 text-orange-800' },
                                                    { label: 'Idle',          hours: idle,  pct: total > 0 ? idle/total*100 : 0,  color: 'bg-slate-100 text-slate-700' },
                                                ].map(b => (
                                                    <div key={b.label} className={`rounded-lg px-3 py-2 text-center ${b.color}`}>
                                                        <p className="text-xs font-medium">{b.label}</p>
                                                        <p className="text-lg font-bold">{b.hours.toFixed(1)}h</p>
                                                        <p className="text-xs">{b.pct.toFixed(1)}%</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* ── Technician Contribution ── */}
                                        {techRows.length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Technician Contribution</p>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50">
                                                            <TableHead>Technician</TableHead>
                                                            <TableHead className="text-right text-green-700">Productive</TableHead>
                                                            <TableHead className="text-right text-orange-700">Non-Prod</TableHead>
                                                            <TableHead className="text-right text-slate-500">Idle</TableHead>
                                                            <TableHead className="text-right font-semibold">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {techRows.map(t => (
                                                            <TableRow key={t.technician_id}>
                                                                <TableCell className="font-medium">{t.technician_name || t.technician_id}</TableCell>
                                                                <TableCell className="text-right text-green-700">{Number(t.productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-orange-700">{Number(t.non_productive_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right text-slate-500">{Number(t.idle_hours ?? 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="text-right font-semibold">
                                                                    {(Number(t.productive_hours ?? 0) + Number(t.non_productive_hours ?? 0) + Number(t.idle_hours ?? 0)).toFixed(1)}h
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}

                                        {/* ── Full Log Timeline ── */}
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Full Log Timeline ({entries.length} entries)</p>
                                            {entries.length === 0 ? (
                                                <p className="text-sm text-slate-400 py-4 text-center">No time entries recorded for this job.</p>
                                            ) : (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50 sticky top-0 z-10">
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Technician</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Category / Reason</TableHead>
                                                            <TableHead className="text-right">Hours</TableHead>
                                                            <TableHead>Notes</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {entries.map((e, i) => {
                                                            const dateStr = e.date ? new Date(e.date).toLocaleDateString() : '—';
                                                            const catLabel = e.sub_reason ? `${e.category || ''} – ${e.sub_reason}` : (e.category || (e.classification === 'productive' ? 'Job Work' : '—'));
                                                            return (
                                                                <TableRow key={i} className={i % 2 === 0 ? '' : 'bg-slate-50/50'}>
                                                                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{dateStr}</TableCell>
                                                                    <TableCell className="text-sm font-medium">{e.technician_name || '—'}</TableCell>
                                                                    <TableCell>
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classBadge[e.classification] || 'bg-slate-100 text-slate-600'}`}>
                                                                            {classLabel[e.classification] || e.classification || '—'}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-sm text-slate-600">{catLabel}</TableCell>
                                                                    <TableCell className="text-right font-medium">{Number(e.hours ?? 0).toFixed(1)}h</TableCell>
                                                                    <TableCell className="text-xs text-slate-400 max-w-[160px] truncate">{e.notes || ''}</TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </div>

                                        {/* ── Issues & Notes ── */}
                                        {(Object.keys(idleReasons).length > 0 || notes.length > 0) && (
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Work Notes & Issues (What Was Done, and When)</p>
                                                <div className="space-y-3">
                                                    {Object.keys(idleReasons).length > 0 && (
                                                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                                                            <p className="text-xs font-semibold text-orange-700 mb-2">Delay / Idle Reasons</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(idleReasons).map(([reason, hrs]) => (
                                                                    <span key={reason} className="text-xs bg-white border border-orange-200 text-orange-800 rounded px-2 py-1">
                                                                        {reason}: {Number(hrs).toFixed(1)}h
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {notes.map((n, i) => (
                                                        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                                            {n.technician_name && <span className="font-semibold mr-2">{n.technician_name}</span>}
                                                            {n.date && <span className="text-xs text-slate-400 mr-2">{new Date(n.date).toLocaleDateString()}</span>}
                                                            {n.bottleneck_description && <span className="mr-2 text-red-600">[Bottleneck] {n.bottleneck_description}</span>}
                                                            {n.notes || n.work_completed || ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <TabsContent value="performance" className="mt-6">
                        <div className="space-y-6">
                            <TechnicianPerformance
                                technicians={technicians}
                                kpiData={techKpiData}
                                isLoading={operationalMetrics === null && lastOperationalMetrics === null}
                            />
                            
                            {/* Daily Productivity Chart */}
                            <Card className="border-0 shadow-lg bg-white/95">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                        Daily Productivity (%)
                                        <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        // Safety check to prevent undefined error
                                        const summaries = monthlySummaries || [];
                                        const dailyData = summaries.map(day => ({
                                            date: format(new Date(day.date), 'MMM dd'),
                                            fullDate: day.date,
                                            dailyProductivePercentage: day.productivity_percent ?? (day.totalHours > 0 ? (day.productiveHours / day.totalHours) * 100 : 0)
                                        }));
                                        
                                        return dailyData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <LineChart data={dailyData} margin={DAILY_CHART_MARGIN}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis domain={[0, 100]} />
                                                    <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullDate || l} />
                                                    <Line type="monotone" dataKey="dailyProductivePercentage" stroke="#facc15" strokeWidth={3} dot={{ fill: '#facc15' }}>
                                                        <LabelList dataKey="dailyProductivePercentage" content={renderPercentLabel} />
                                                    </Line>
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-[250px] flex items-center justify-center text-slate-400">No productivity data</div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            {/* Daily Utilization Chart */}
                            <Card className="border-0 shadow-lg bg-white/95">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                                        <TrendingUp className="w-5 h-5 text-blue-500" />
                                        Daily Utilization (%)
                                        <span className="text-sm text-slate-500 font-normal">(Overall Team)</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        // Safety check to prevent undefined error
                                        const summaries = monthlySummaries || [];
                                        const dailyData = summaries.map(day => ({
                                            date: format(new Date(day.date), 'MMM dd'),
                                            fullDate: day.date,
                                            dailyUtilizationPercentage: day.utilization_percent ?? (day.totalHours > 0 ? ((day.totalHours - day.notAvailableHours) > 0 ? (day.productiveHours / (day.totalHours - day.notAvailableHours)) * 100 : 0) : 0)
                                        }));
                                        
                                        return dailyData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <LineChart data={dailyData} margin={DAILY_CHART_MARGIN}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis domain={[0, 100]} />
                                                    <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullDate || l} />
                                                    <Line type="monotone" dataKey="dailyUtilizationPercentage" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6' }}>
                                                        <LabelList dataKey="dailyUtilizationPercentage" content={renderPercentLabel} />
                                                    </Line>
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-[250px] flex items-center justify-center text-slate-400">No utilization data</div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="activities" className="mt-6">
                        <TechnicianActivityLog
                            technicians={technicians}
                            timeLogs={activityLogsForPeriod}
                            jobs={jobs}
                            jobReports={activityReportsForPeriod}
                            kpiData={techKpiData}
                            periodLabel={periodLabel}
                            periodRange={{ start: periodStartStr, end: periodEndStr }}
                            workshop={dashboardLabel.replace(/ DASHBOARD$/, '')}
                        />
                    </TabsContent>

                    <TabsContent value="technicians" className="mt-6">
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <Button 
                                    onClick={() => setTechModalOpen(true)}
                                    className="bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold h-10 px-4"
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Add My Technician
                                </Button>
                                <Button 
                                    onClick={() => setGlobalTechSelectorOpen(true)}
                                    variant="outline"
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50 h-10 px-4"
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Search All Technicians
                                </Button>
                            </div>
                            <TechnicianList
                                technicians={technicians}
                                onDelete={deleteTechnicianMutation.mutate}
                                onUpdate={updateTechnicianMutation.mutate}
                                isUpdating={updateTechnicianMutation.isPending}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="timeLogs" className="mt-6">
                        <div className="bg-white/95 rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800">Time Logs</h3>
                                    <p className="text-xs text-slate-500">Edit or delete technician logs. This updates job hours and progress.</p>
                                </div>
                                <div className="text-xs text-slate-500">{timeLogsForMonth.length} logs</div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Technician</TableHead>
                                            <TableHead>Job</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Holiday</TableHead>
                                            <TableHead className="text-right">Multiplier</TableHead>
                                            <TableHead className="text-right">Hours</TableHead>
                                            <TableHead className="text-right">Normal</TableHead>
                                            <TableHead className="text-right">OT</TableHead>
                                            <TableHead className="text-right">Payable</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {timeLogsForMonth.map((log) => {
                                            const isEditing = editingLogId === log.id;
                                            const isIdle = !!log.is_idle;
                                            const showOtherDetail = isIdle && (editLogDraft.category === 'Other' || log.category === 'Other');
                                            const techName = log.technician_name
                                                || technicianNameById[String(log.technician_id)]
                                                || log.technician_id;
                                            const multiplier = appliedRateFor(log);
                                            const payable = payableHoursFor(log);
                                            return (
                                                <TableRow key={log.id}>
                                                    <TableCell>{log.log_date ? parseISO(log.log_date).toLocaleDateString() : '-'}</TableCell>
                                                    <TableCell>{techName}</TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {log.job_id}
                                                        {log.requested_overtime && (
                                                            <Badge className="ml-2 bg-yellow-100 text-yellow-800 align-middle">Overtime</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isIdle ? (
                                                            isEditing ? (
                                                                <div className="space-y-2 min-w-[180px]">
                                                                    <Select
                                                                        value={String(editLogDraft.category ?? '')}
                                                                        onValueChange={(value) => setEditLogDraft(prev => ({ ...prev, category: value }))}
                                                                    >
                                                                        <SelectTrigger className="h-8">
                                                                            <SelectValue placeholder="Category" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {(idleInfo?.categories || []).map(cat => (
                                                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {showOtherDetail && (
                                                                        <Input
                                                                            className="h-8"
                                                                            value={editLogDraft.category_detail}
                                                                            onChange={(e) => setEditLogDraft(prev => ({ ...prev, category_detail: e.target.value }))}
                                                                            placeholder="Other details"
                                                                        />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm">
                                                                    Idle: {log.category}{log.category_detail ? ` (${log.category_detail})` : ''}
                                                                    {log.category_note ? (
                                                                        <span className="block text-xs text-slate-500 italic">"{log.category_note}"</span>
                                                                    ) : null}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-sm">Job</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.is_public_holiday ? (
                                                            <span className="text-xs font-semibold text-amber-700">
                                                                {log.public_holiday_name || 'Public Holiday'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-slate-700">
                                                        {multiplier.toFixed(1)}×
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.25"
                                                                className="h-8 w-24 ml-auto text-right"
                                                                value={editLogDraft.hours_logged}
                                                                onChange={(e) => setEditLogDraft(prev => ({ ...prev, hours_logged: e.target.value }))}
                                                            />
                                                        ) : (
                                                            `${Number(log.hours_logged || 0).toFixed(1)}h`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600">
                                                        {`${Number(log.normal_hours || 0).toFixed(1)}h`}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-yellow-600">
                                                        {`${Number(log.overtime_hours || 0).toFixed(1)}h`}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-slate-800">
                                                        {payable.toFixed(1)}h
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.approval_status === 'approved' ? (
                                                            <div>
                                                                <Badge className="bg-green-100 text-green-800">Approved</Badge>
                                                                {Number(log.approved_hours) !== Number(log.hours_logged || 0) && (
                                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                                        {Number(log.approved_hours || 0).toFixed(1)}h of {Number(log.hours_logged || 0).toFixed(1)}h logged
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : log.approval_status === 'declined' ? (
                                                            <Badge className="bg-red-100 text-red-800">Declined</Badge>
                                                        ) : (
                                                            <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                                    onClick={() => {
                                                                        setEditingLogId(null);
                                                                        setEditLogDraft({ hours_logged: '', category: '', category_detail: '' });
                                                                    }}
                                                                    disabled={updateTimeLogMutation.isPending}
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-800"
                                                                    onClick={() => {
                                                                        const hours = Number(editLogDraft.hours_logged);
                                                                        if (!hours || hours <= 0) return;
                                                                        updateTimeLogMutation.mutate({
                                                                            id: log.id,
                                                                            timeLog: {
                                                                                hours_logged: hours,
                                                                                is_idle: log.is_idle,
                                                                                category: log.is_idle ? editLogDraft.category : log.category,
                                                                                category_detail: log.is_idle ? editLogDraft.category_detail : log.category_detail,
                                                                                subtask_id: log.subtask_id
                                                                            }
                                                                        });
                                                                    }}
                                                                    disabled={updateTimeLogMutation.isPending}
                                                                    title="Save"
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : log.system_generated ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs text-slate-500"
                                                                title="Added automatically for each day the technician books time"
                                                            >
                                                                Automatic
                                                            </Badge>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                                    onClick={() => {
                                                                        setEditingLogId(log.id);
                                                                        setEditLogDraft({
                                                                            hours_logged: String(log.hours_logged ?? ''),
                                                                            category: String(log.category ?? ''),
                                                                            category_detail: String(log.category_detail ?? '')
                                                                        });
                                                                    }}
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                                                                    onClick={() => {
                                                                        if (!window.confirm('Delete this time log? This will update job hours and progress.')) return;
                                                                        deleteTimeLogMutation.mutate(log.id);
                                                                    }}
                                                                    disabled={deleteTimeLogMutation.isPending}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    {approvalEnabled && (
                        <TabsContent value="approvals" className="space-y-6">
                            <Card className="border-0 shadow-lg bg-white/95">
                                <CardHeader className="pb-4 border-b border-slate-100">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <CardTitle className="text-slate-800">Pending Approvals ({pendingApprovals.length})</CardTitle>
                                        {(() => {
                                            const selectedCount = (Array.isArray(pendingApprovals) ? pendingApprovals : [])
                                                .filter((log) => selectedApprovalIds.has(log.id)).length;
                                            return (
                                                <Button
                                                    className="h-9 bg-green-600 hover:bg-green-700 text-white"
                                                    disabled={!selectedCount || !!bulkApprovalProgress || approveTimeLogMutation.isPending || declineTimeLogMutation.isPending}
                                                    onClick={approveSelectedTimeLogs}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    {bulkApprovalProgress
                                                        ? `Approving ${bulkApprovalProgress.done}/${bulkApprovalProgress.total}...`
                                                        : `Approve selected (${selectedCount})`}
                                                </Button>
                                            );
                                        })()}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead className="w-10">
                                                        {(() => {
                                                            const ids = (Array.isArray(pendingApprovals) ? pendingApprovals : []).map((log) => log.id);
                                                            const allSelected = ids.length > 0 && ids.every((id) => selectedApprovalIds.has(id));
                                                            return (
                                                                <Checkbox
                                                                    aria-label="Select all pending entries"
                                                                    checked={allSelected}
                                                                    disabled={!ids.length || !!bulkApprovalProgress}
                                                                    onCheckedChange={(checked) => setSelectedApprovalIds(checked ? new Set(ids) : new Set())}
                                                                />
                                                            );
                                                        })()}
                                                    </TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Job</TableHead>
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Submitted</TableHead>
                                                    <TableHead className="text-right">Approve</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {console.log('Pending approvals data:', pendingApprovals, 'Type:', typeof pendingApprovals, 'IsArray:', Array.isArray(pendingApprovals))}
                                                {approvalError?.response?.status === 401 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center text-slate-500">
                                                            Session expired. Please log in again.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : !Array.isArray(pendingApprovals) ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center text-slate-500">
                                                            Error loading pending approvals
                                                        </TableCell>
                                                    </TableRow>
                                                ) : pendingApprovals.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center text-slate-500">
                                                            No pending approvals
                                                        </TableCell>
                                                    </TableRow>
                                                ) : pendingApprovals.map((log) => {
                                                    const submitted = Number(log?.hours_logged || 0);
                                                    const draft = approvalHoursDraft[log.id] ?? String(submitted);
                                                    const isIdle = !!log?.is_idle;
                                                    const typeLabel = isIdle ? (log?.category || 'Idle') : 'Job';
                                                    return (
                                                        <TableRow key={log.id} className={selectedApprovalIds.has(log.id) ? 'bg-green-50/60' : undefined}>
                                                            <TableCell>
                                                                <Checkbox
                                                                    aria-label="Select entry"
                                                                    checked={selectedApprovalIds.has(log.id)}
                                                                    disabled={!!bulkApprovalProgress}
                                                                    onCheckedChange={(checked) => setSelectedApprovalIds((prev) => {
                                                                        const next = new Set(prev);
                                                                        if (checked) next.add(log.id); else next.delete(log.id);
                                                                        return next;
                                                                    })}
                                                                />
                                                            </TableCell>
                                                            <TableCell>{log?.log_date ? format(new Date(log.log_date), 'yyyy-MM-dd') : ''}</TableCell>
                                                            <TableCell>
                                                            {log?.technician_id?.name ||
                                                             log?.technician_name || 
                                                             (typeof log?.technician_id === 'string' ? log.technician_id : 
                                                              typeof log?.technician_id === 'object' ? log.technician_id?._id || log.technician_id?.id || 'Unknown' :
                                                              'Unknown')}
                                                        </TableCell>
                                                            <TableCell>
                                                                {typeLabel}
                                                                {/* Ticked "log as overtime" by the technician, or part of the
                                                                    hours fell beyond the day's normal hours. */}
                                                                {(log?.requested_overtime || Number(log?.overtime_hours || 0) > 0) && (
                                                                    <Badge
                                                                        className="ml-2 bg-yellow-100 text-yellow-800 border border-yellow-300 align-middle"
                                                                        title={Number(log?.overtime_hours || 0) > 0
                                                                            ? `${Number(log.overtime_hours).toFixed(1)}h of this entry is overtime`
                                                                            : 'Logged as overtime'}
                                                                    >
                                                                        Overtime{Number(log?.overtime_hours || 0) > 0 ? ` ${Number(log.overtime_hours).toFixed(1)}h` : ''}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-mono">{log?.job_id}</TableCell>
                                                            <TableCell>{log?.subtask_title || '-'}</TableCell>
                                                            <TableCell className="text-right">{submitted.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.5"
                                                                    value={draft}
                                                                    onChange={(e) => setApprovalHoursDraft((p) => ({ ...p, [log.id]: e.target.value }))}
                                                                    className="h-8 w-24 text-right"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-8"
                                                                        disabled={!!bulkApprovalProgress || approveTimeLogMutation.isPending || declineTimeLogMutation.isPending}
                                                                        onClick={() => {
                                                                            const val = Number(approvalHoursDraft[log.id] ?? submitted);
                                                                            approveTimeLogMutation.mutate({ id: log.id, approved_hours: Number.isNaN(val) ? 0 : val });
                                                                        }}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                                                                        disabled={!!bulkApprovalProgress || approveTimeLogMutation.isPending || declineTimeLogMutation.isPending}
                                                                        onClick={() => {
                                                                            if (!window.confirm('Decline this time entry?')) return;
                                                                            declineTimeLogMutation.mutate({ id: log.id });
                                                                        }}
                                                                    >
                                                                        Decline
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>

                <Dialog open={!!selectedJobDetails} onOpenChange={(open) => {
                    if (!open) {
                        setSelectedJobDetails(null);
                        setIsEditingJob(false);
                        setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '', hours_change_reason: '' });
                        setSelectedJobTechnicianId('');
                        setTechStageAllocDraft({});
                    }
                }}>
                    <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">
                                Job Details: {selectedJobDetails?.job_number}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                View job details and edit job information.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(85vh-6rem)]">
                            <div className="flex items-start justify-between gap-3">
                                <div className="text-sm text-slate-600">
                                    {isEditingJob ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-500">Job Number</div>
                                                    <Input
                                                        value={jobEditDraft.job_number}
                                                        onChange={(e) => setJobEditDraft((p) => ({ ...p, job_number: e.target.value }))}
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-500">
                                                        Allocated Hours — current: {Number(selectedJobDetails?.allocated_hours || 0).toFixed(1)}h
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        step="0.5"
                                                        value={jobEditDraft.allocated_hours}
                                                        onChange={(e) => setJobEditDraft((p) => ({ ...p, allocated_hours: e.target.value }))}
                                                        placeholder="+/- hours to add or remove"
                                                        className="h-8"
                                                    />
                                                    {(selectedJobDetails?.base_allocated_hours ?? null) !== null && (
                                                        <div className="text-xs text-slate-500">
                                                            Originally allocated: {Number(selectedJobDetails.base_allocated_hours).toFixed(1)}h
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {String(jobEditDraft.allocated_hours ?? '').trim() !== '' &&
                                                Number(jobEditDraft.allocated_hours) !== 0 &&
                                                !Number.isNaN(Number(jobEditDraft.allocated_hours)) && (
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-500">
                                                        New total: {(Number(selectedJobDetails?.allocated_hours || 0) + Number(jobEditDraft.allocated_hours)).toFixed(1)}h
                                                    </div>
                                                    <div className="text-xs text-slate-500">Reason for changing allocated hours *</div>
                                                    <Textarea
                                                        value={jobEditDraft.hours_change_reason}
                                                        onChange={(e) => setJobEditDraft((p) => ({ ...p, hours_change_reason: e.target.value }))}
                                                        placeholder="Why is the overall job allocation changing?"
                                                        className="h-16 text-sm"
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500">Status</div>
                                                <Select
                                                    value={jobEditDraft.status}
                                                    onValueChange={(value) => setJobEditDraft((p) => ({ ...p, status: value }))}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending_confirmation">pending confirmation</SelectItem>
                                                        <SelectItem value="active">active</SelectItem>
                                                        <SelectItem value="in_progress">in progress</SelectItem>
                                                        <SelectItem value="completed">completed</SelectItem>
                                                        <SelectItem value="at_risk">at risk</SelectItem>
                                                        <SelectItem value="overrun">overrun</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500">Description</div>
                                                <Input
                                                    value={jobEditDraft.description}
                                                    onChange={(e) => setJobEditDraft((p) => ({ ...p, description: e.target.value }))}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        selectedJobDetails?.description
                                    )}
                                </div>

                            <div className="flex items-center gap-2">
                                {isEditingJob ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingJob(false);
                                                setJobEditDraft({ job_number: '', description: '', allocated_hours: '', status: '', hours_change_reason: '' });
                                            }}
                                            disabled={updateJobByNumberMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                const nextNumber = String(jobEditDraft.job_number || '').trim();
                                                if (!nextNumber) return;
                                                const rawDelta = String(jobEditDraft.allocated_hours ?? '').trim();
                                                const delta = rawDelta === '' ? 0 : Number(rawDelta);
                                                const allocatedIsChanging = rawDelta !== '' && !Number.isNaN(delta) && delta !== 0;
                                                const nextAllocated = allocatedIsChanging
                                                    ? Number(selectedJobDetails?.allocated_hours || 0) + delta
                                                    : null;
                                                if (allocatedIsChanging && nextAllocated < 0) {
                                                    alert('Resulting allocated hours cannot be negative');
                                                    return;
                                                }
                                                const nextStatus = String(jobEditDraft.status || '').trim();
                                                const reason = String(jobEditDraft.hours_change_reason || '').trim();
                                                if (allocatedIsChanging && !reason) {
                                                    alert('Please give a reason for changing the allocated hours');
                                                    return;
                                                }
                                                const payload = {
                                                    job_number: nextNumber,
                                                    description: String(jobEditDraft.description || '').trim()
                                                };

                                                if (nextStatus) payload.status = nextStatus;
                                                if (allocatedIsChanging) {
                                                    payload.allocated_hours = nextAllocated;
                                                    payload.hours_change_reason = reason;
                                                }

                                                updateJobByNumberMutation.mutate({
                                                    jobNumber: selectedJobDetails?.job_number,
                                                    data: payload
                                                });
                                            }}
                                            disabled={updateJobByNumberMutation.isPending}
                                            className="bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                                        >
                                            {updateJobByNumberMutation.isPending ? 'Saving...' : 'Save'}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {currentUser?.type === 'supervisor' && String(selectedJobDetails?.status || '') !== 'completed' && (
                                            <Button
                                                variant="default"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                disabled={updateJobByNumberMutation.isPending}
                                                onClick={async () => {
                                                    try {
                                                        if (!selectedJobDetails?.id) {
                                                            alert('Job id missing');
                                                            return;
                                                        }
                                                        if (!window.confirm(`Mark job ${selectedJobDetails.job_number} as completed?`)) return;

                                                        await base44.entities.JobManagement.updateJobStatus(
                                                            supervisorKey,
                                                            selectedJobDetails.id,
                                                            { status: 'completed' }
                                                        );

                                                        queryClient.invalidateQueries({ queryKey: ['jobs'] });
                                                        const latest = await base44.entities.Job.getByJobNumber(selectedJobDetails.job_number);
                                                        setSelectedJobDetails(latest);
                                                    } catch (e) {
                                                        alert(e?.message || 'Failed to mark completed');
                                                    }
                                                }}
                                            >
                                                Mark Completed
                                            </Button>
                                        )}
                                        {currentUser?.type === 'supervisor' && String(selectedJobDetails?.status || '') === 'completed' && (
                                            <Button
                                                variant="default"
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                disabled={reopenJobMutation.isPending}
                                                onClick={() => {
                                                    const remaining = Number(selectedJobDetails?.remaining_hours ?? 0);
                                                    const msg = remaining > 0
                                                        ? `Make job ${selectedJobDetails.job_number} active again? It has ${remaining.toFixed(1)}h remaining.`
                                                        : `Make job ${selectedJobDetails.job_number} active again? Its hours are used up, so you'll need to add hours (Edit Job) before technicians can book on it.`;
                                                    if (window.confirm(msg)) {
                                                        reopenJobMutation.mutate({ jobNumber: selectedJobDetails.job_number, remaining });
                                                    }
                                                }}
                                            >
                                                {reopenJobMutation.isPending ? 'Activating…' : 'Make Active'}
                                            </Button>
                                        )}

                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingJob(true);
                                                setJobEditDraft({
                                                    job_number: selectedJobDetails?.job_number || '',
                                                    description: selectedJobDetails?.description || '',
                                                    // Delta field (add/remove hours), not the absolute total — starts empty.
                                                    allocated_hours: '',
                                                    status: selectedJobDetails?.status || 'in_progress',
                                                    hours_change_reason: ''
                                                });
                                                // Per-technician stage inputs are +/- deltas (added to the current
                                                // allocation on Save), so they must start empty — pre-filling them
                                                // with the current allocation made Save add that whole amount again.
                                                setTechStageAllocDraft({});
                                            }}
                                        >
                                            Edit Job
                                        </Button>
                                    </>
                                )}
                            </div>
                            </div>

                            {(selectedJobDetails?.technicians || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Assigned Technicians</div>
                                    <div className="space-y-2">
                                        {(selectedJobDetails.technicians || []).map((t) => (
                                            <div key={String(t?.technician_id)} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                                                <button
                                                    type="button"
                                                    className="text-sm text-slate-800 text-left hover:underline"
                                                    onClick={() => setSelectedJobTechnicianId(String(t?.technician_id || ''))}
                                                >
                                                    {t?.technician_name || t?.technician_id}
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                                                    title="Remove technician"
                                                    onClick={() => {
                                                        if (!window.confirm('Remove this technician from the job?')) return;
                                                        const nextTechs = (selectedJobDetails.technicians || []).filter(
                                                            (x) => String(x?.technician_id) !== String(t?.technician_id)
                                                        );
                                                        if (String(selectedJobTechnicianId) === String(t?.technician_id)) {
                                                            setSelectedJobTechnicianId('');
                                                            setTechStageAllocDraft({});
                                                        }
                                                        updateJobByNumberMutation.mutate({
                                                            jobNumber: selectedJobDetails?.job_number,
                                                            data: { technicians: nextTechs },
                                                            keepEditing: true
                                                        });
                                                    }}
                                                    disabled={updateJobByNumberMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!!selectedJobTechnicianId && (selectedJobDetails?.subtasks || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-slate-800">Technician Stages</div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedJobTechnicianId('')}
                                            className="h-8"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Allocated</TableHead>
                                                    <TableHead className="text-right">Progress</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(selectedJobDetails.subtasks || [])
                                                    .filter((st) => {
                                                        const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
                                                        return assigned.some((a) => String(a?.technician_id) === String(selectedJobTechnicianId));
                                                    })
                                                    .map((st) => {
                                                        const assigned = Array.isArray(st?.assigned_technicians) ? st.assigned_technicians : [];
                                                        const a = assigned.find((x) => String(x?.technician_id) === String(selectedJobTechnicianId));
                                                        const alloc = Number(a?.allocated_hours || 0);
                                                        const stId = String(st?._id || st?.id);
                                                        const draftKey = `${stId}:${String(selectedJobTechnicianId)}`;
                                                        const draftValRaw = techStageAllocDraft?.[draftKey];
                                                        const draftVal = typeof draftValRaw === 'string' ? draftValRaw : '';
                                                        const prog = Array.isArray(st?.progress_by_technician)
                                                            ? st.progress_by_technician.find((p) => String(p?.technician_id) === String(selectedJobTechnicianId))
                                                            : null;
                                                        const pct = Number(prog?.progress_percentage || 0);
                                                        return (
                                                            <TableRow key={String(st?._id || st?.id)}>
                                                                <TableCell>{st?.title || '-'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {isEditingJob ? (() => {
                                                                        const delta = draftVal !== '' ? Number(draftVal) : 0;
                                                                        const hasDelta = draftVal !== '' && !Number.isNaN(delta) && delta !== 0;
                                                                        const nextTotal = alloc + (Number.isNaN(delta) ? 0 : delta);
                                                                        return (
                                                                        <div className="space-y-1">
                                                                            <div className="text-xs text-slate-500">Current: {alloc.toFixed(1)}h</div>
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                <Input
                                                                                    type="number"
                                                                                    step="0.5"
                                                                                    value={draftVal}
                                                                                    onChange={(e) => {
                                                                                        const v = e.target.value;
                                                                                        setTechStageAllocDraft((p) => ({ ...p, [draftKey]: v }));
                                                                                    }}
                                                                                    placeholder="+/- hours"
                                                                                    className="h-8 w-24 text-right"
                                                                                />
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="h-8"
                                                                                    disabled={updateSubtaskMutation.isPending}
                                                                                    onClick={() => {
                                                                                        if (!hasDelta) return;
                                                                                        if (nextTotal < 0) {
                                                                                            alert('Resulting hours cannot be negative');
                                                                                            return;
                                                                                        }
                                                                                        const reason = String(techStageReasonDraft?.[draftKey] ?? '').trim();
                                                                                        if (!reason) {
                                                                                            alert('Please give a reason for changing this technician\'s allocated hours');
                                                                                            return;
                                                                                        }
                                                                                        const nextAssigned = assigned.map((x) =>
                                                                                            String(x?.technician_id) === String(selectedJobTechnicianId)
                                                                                                ? { ...x, allocated_hours: nextTotal }
                                                                                                : x
                                                                                        );
                                                                                        updateSubtaskMutation.mutate({
                                                                                            jobNumber: selectedJobDetails?.job_number,
                                                                                            subtaskId: stId,
                                                                                            data: { assigned_technicians: nextAssigned, hours_change_reason: reason }
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    Save
                                                                                </Button>
                                                                            </div>
                                                                            {hasDelta && (
                                                                                <>
                                                                                    <div className="text-xs text-slate-500">New total: {nextTotal.toFixed(1)}h</div>
                                                                                    <Input
                                                                                        value={techStageReasonDraft?.[draftKey] ?? ''}
                                                                                        onChange={(e) => setTechStageReasonDraft((p) => ({ ...p, [draftKey]: e.target.value }))}
                                                                                        placeholder="Reason for hours change *"
                                                                                        className="h-7 text-xs"
                                                                                    />
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        );
                                                                    })() : (
                                                                        `${alloc.toFixed(1)}h`
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">{pct.toFixed(0)}%</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {isEditingJob && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Add Technician</div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Select value={jobAddTechnicianId} onValueChange={setJobAddTechnicianId}>
                                            <SelectTrigger className="h-8 sm:w-[280px]">
                                                <SelectValue placeholder="Select technician" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(technicians || [])
                                                    .filter((t) => {
                                                        const id = String(t?.id || t?._id || '');
                                                        if (!id) return false;
                                                        const already = (selectedJobDetails?.technicians || []).some((x) => String(x?.technician_id) === id);
                                                        return !already;
                                                    })
                                                    .map((t) => (
                                                        <SelectItem key={String(t?.id || t?._id)} value={String(t?.id || t?._id)}>
                                                            {t?.name || t?.technician_name || 'Technician'}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            variant="outline"
                                            className="h-10 px-4"
                                            disabled={!jobAddTechnicianId || updateJobByNumberMutation.isPending}
                                            onClick={() => {
                                                const techId = String(jobAddTechnicianId || '');
                                                if (!techId) return;
                                                const tech = (technicians || []).find((t) => String(t?.id || t?._id) === techId);
                                                const nextTechs = [
                                                    ...(selectedJobDetails?.technicians || []),
                                                    {
                                                        technician_id: techId,
                                                        technician_name: tech?.name || tech?.technician_name || ''
                                                    }
                                                ];
                                                updateJobByNumberMutation.mutate({
                                                    jobNumber: selectedJobDetails?.job_number,
                                                    data: { technicians: nextTechs },
                                                    keepEditing: true
                                                });
                                                setJobAddTechnicianId('');
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Allocated</div>
                                    <div className="font-semibold">{Number(selectedJobDetails?.allocated_hours || 0).toFixed(1)}h</div>
                                    {(selectedJobDetails?.base_allocated_hours ?? null) !== null &&
                                        Number(selectedJobDetails.base_allocated_hours) !== Number(selectedJobDetails?.allocated_hours || 0) && (
                                        <div className="text-xs text-slate-500">
                                            originally {Number(selectedJobDetails.base_allocated_hours).toFixed(1)}h
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Consumed</div>
                                    <div className="font-semibold text-blue-700">{Number(selectedJobDetails?.consumed_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Remaining</div>
                                    <div className="font-semibold text-green-700">
                                        {Number(selectedJobDetails?.remaining_hours ?? (Number(selectedJobDetails?.allocated_hours || 0) - Number(selectedJobDetails?.consumed_hours || 0))).toFixed(1)}h
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const hoursHistory = (selectedJobDetails?.audit_history || [])
                                    .filter((h) => h?.type === 'hours_updated' || h?.type === 'subtask_hours_updated')
                                    .sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0));
                                if (!hoursHistory.length) return null;
                                return (
                                    <div className="space-y-2 mb-6">
                                        <div className="font-semibold text-slate-800">Hours Change History</div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {hoursHistory.map((h, idx) => (
                                                <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                                                    <div className="flex items-center justify-between text-slate-500">
                                                        <span>{h?.at ? format(new Date(h.at), 'yyyy-MM-dd HH:mm') : '-'}</span>
                                                        <span>{h?.actor_email || 'unknown'}</span>
                                                    </div>
                                                    {h.type === 'hours_updated' ? (
                                                        <div>
                                                            Job hours: {Number(h?.details?.previous_allocated_hours ?? 0).toFixed(1)}h → {Number(h?.details?.next_allocated_hours ?? 0).toFixed(1)}h
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            {h?.details?.subtask_title || 'Stage'}: {(h?.details?.changes || []).map((c) => (
                                                                `${c.technician_name || 'Technician'} ${Number(c.previous_allocated_hours || 0).toFixed(1)}h → ${Number(c.next_allocated_hours || 0).toFixed(1)}h`
                                                            )).join(', ')}
                                                        </div>
                                                    )}
                                                    {h?.details?.reason && (
                                                        <div className="italic text-slate-600 mt-0.5">"{h.details.reason}"</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {selectedJobDetails?.actual_completion_date && (
                                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 mb-6">
                                    <div className="font-semibold text-slate-900">Completed At</div>
                                    <div>{format(new Date(selectedJobDetails.actual_completion_date), 'yyyy-MM-dd HH:mm')}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Technical Complexity</div>
                                    <div className="font-semibold text-amber-700">{Number(selectedJobDetails?.technical_complexity_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Recovered</div>
                                    <div className="font-semibold text-slate-700">{Number(selectedJobDetails?.recovered_technical_complexity_hours || 0).toFixed(1)}h</div>
                                </div>
                                <div className="bg-slate-50 rounded p-3">
                                    <div className="text-slate-500">Updated Total</div>
                                    <div className="font-semibold">
                                        {(
                                            Number(selectedJobDetails?.allocated_hours || 0) +
                                            Number(selectedJobDetails?.recovered_technical_complexity_hours || 0)
                                        ).toFixed(1)}h
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const allocated = Number(selectedJobDetails?.allocated_hours || 0);
                                const consumed = Number(selectedJobDetails?.consumed_hours || 0);
                                const remaining = Number(selectedJobDetails?.remaining_hours ?? Math.max(0, allocated - consumed));
                                const totalTC = Number(selectedJobDetails?.technical_complexity_hours || 0);
                                const recovered = Number(selectedJobDetails?.recovered_technical_complexity_hours || 0);
                                const unrecovered = Math.max(0, totalTC - recovered);
                                const canRecover = remaining <= 1e-9 && unrecovered > 1e-9;

                                if (!canRecover) return null;
                                return (
                                    <div className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-4">
                                        <div className="text-sm text-amber-900">
                                            <div className="font-semibold">Recover Technical Complexity Hours</div>
                                            <div className="text-amber-800">Adds {unrecovered.toFixed(1)}h back to allocated job hours.</div>
                                        </div>
                                        <Button
                                            onClick={() => recoverTechnicalComplexityMutation.mutate(selectedJobDetails?.job_number)}
                                            disabled={recoverTechnicalComplexityMutation.isPending}
                                            className="bg-amber-500 hover:bg-amber-600 text-white"
                                        >
                                            {recoverTechnicalComplexityMutation.isPending ? 'Recovering...' : 'Recover Hours'}
                                        </Button>
                                    </div>
                                );
                            })()}

                            {(selectedJobDetails?.subtasks || []).length > 0 && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-slate-800">Stages (Remaining Hours)</div>
                                    <div className="overflow-x-auto border rounded">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Stage</TableHead>
                                                    <TableHead className="text-right">Allocated</TableHead>
                                                    <TableHead className="text-right">Logged</TableHead>
                                                    <TableHead className="text-right">Remaining</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(selectedJobDetails.subtasks || []).map((st) => {
                                                    const allocatedHrs = Number(st?.allocated_hours || 0);
                                                    const consumedHrs = Number(st?.consumed_hours || 0);
                                                    const remainingHrs = Number(
                                                        typeof st?.remaining_hours !== 'undefined' && st?.remaining_hours !== null
                                                            ? st.remaining_hours
                                                            : Math.max(0, allocatedHrs - consumedHrs)
                                                    );
                                                    const label = `${st?.category ? `${st.category}: ` : ''}${st?.title || ''}`.trim() || '-';
                                                    return (
                                                        <TableRow key={String(st?._id || st?.id || label)}>
                                                            <TableCell className="min-w-[220px]">{label}</TableCell>
                                                            <TableCell className="text-right">{allocatedHrs.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right text-blue-700">{consumedHrs.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-right font-semibold text-green-700">{remainingHrs.toFixed(1)}h</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Remaining is calculated as stage allocated hours minus booked hours on that stage.
                                    </div>
                                </div>
                            )}

                            {(selectedJobWorkLogs.length > 0 || selectedJobUnmatchedReports.length > 0) && (
                                <Card className="border border-slate-200 bg-slate-50">
                                    <CardHeader>
                                        <CardTitle className="text-slate-800">Job Work Logs</CardTitle>
                                        <p className="text-xs text-slate-500">
                                            Every entry booked on this job, with the technician's report for that day. Bottlenecks are highlighted.
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-100">
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Technician</TableHead>
                                                        <TableHead>Stage</TableHead>
                                                        <TableHead className="text-right">Hours</TableHead>
                                                        <TableHead className="text-right">Normal</TableHead>
                                                        <TableHead className="text-right">Overtime</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="min-w-[280px]">Work Done &amp; Notes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedJobWorkLogs.map((log) => {
                                                        const logId = String(log.id || log._id);
                                                        const reports = selectedJobReportsByLogId.get(logId) || [];
                                                        const hasBottleneck = reports.some((r) => r?.has_bottleneck);
                                                        const entryNote = String(log?.category_detail || log?.approval_note || '').trim();
                                                        const status = log?.approval_status || 'approved';
                                                        return (
                                                            <TableRow
                                                                key={`${logId}-${log.log_date}-${log.subtask_id}`}
                                                                className={hasBottleneck ? 'bg-amber-50/70 border-l-4 border-l-amber-400' : undefined}
                                                            >
                                                                <TableCell className="align-top whitespace-nowrap">{log?.log_date ? format(new Date(log.log_date), 'yyyy-MM-dd') : '-'}</TableCell>
                                                                <TableCell className="align-top">
                                                                    {technicianNameById[String(log?.technician_id)]
                                                                        || log?.technician_name
                                                                        || (log?.technician_id?.name || log?.technician_id)
                                                                        || 'Unknown'}
                                                                    {(log?.requested_overtime || Number(log?.overtime_hours || 0) > 0) && (
                                                                        <Badge className="ml-2 bg-yellow-100 text-yellow-800 align-middle">Overtime</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="align-top">{log?.subtask_title || getSubtaskTitle(log?.subtask_id) || '-'}</TableCell>
                                                                <TableCell className="align-top text-right">{Number(log?.hours_logged || 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="align-top text-right text-blue-600">{Number(log?.normal_hours || 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="align-top text-right text-yellow-700">{Number(log?.overtime_hours || 0).toFixed(1)}h</TableCell>
                                                                <TableCell className="align-top">
                                                                    <Badge className={
                                                                        status === 'approved' ? 'bg-green-100 text-green-800'
                                                                            : status === 'declined' ? 'bg-red-100 text-red-800'
                                                                                : 'bg-slate-100 text-slate-700'
                                                                    }>
                                                                        {status === 'approved' ? 'Approved' : status === 'declined' ? 'Declined' : 'Pending'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="align-top">
                                                                    {reports.length === 0 && !entryNote ? (
                                                                        <span className="text-xs text-slate-400 italic">No report submitted</span>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            {reports.map((report) => (
                                                                                <div key={String(report._id || report.id)} className="space-y-1.5">
                                                                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                                                                        {String(report?.work_completed || '').trim() || <span className="text-xs text-slate-400 italic">No work-completed note</span>}
                                                                                    </div>
                                                                                    {report?.has_bottleneck && (
                                                                                        <div className="rounded border border-amber-300 bg-amber-100/70 px-2 py-1.5 text-xs text-amber-900">
                                                                                            <div className="flex items-center gap-1 font-semibold">
                                                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                                                                Bottleneck: {String(report?.bottleneck_category || 'Unknown').replace(/_/g, ' ')}
                                                                                                <span className="font-normal">· {Number(report?.bottleneck_time_lost_hours || 0).toFixed(1)}h lost</span>
                                                                                            </div>
                                                                                            {String(report?.bottleneck_description || '').trim() && (
                                                                                                <div className="mt-0.5 whitespace-pre-wrap">{report.bottleneck_description}</div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                            {entryNote && (
                                                                                <div className="text-xs text-slate-500"><span className="font-medium">Entry note:</span> {entryNote}</div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {selectedJobUnmatchedReports.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <div className="text-sm font-semibold text-slate-700">Reports without a matching time entry</div>
                                                <div className="text-xs text-slate-500">The hours these were filed with have since been deleted or moved.</div>
                                                {selectedJobUnmatchedReports.map((report) => (
                                                    <div key={`${report._id || report.id}-${report.date}`} className={`rounded border p-3 bg-white ${report?.has_bottleneck ? 'border-amber-300' : 'border-slate-200'}`}>
                                                        <div className="text-xs text-slate-500">
                                                            {report?.date ? format(new Date(report.date), 'yyyy-MM-dd') : 'No date'} · {report?.technician_name || technicianNameById[String(report?.technician_id)] || 'Technician'}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                                                            {String(report?.work_completed || '').trim() || 'No work completed note provided.'}
                                                        </div>
                                                        {report?.has_bottleneck && (
                                                            <div className="mt-2 rounded border border-amber-300 bg-amber-100/70 px-2 py-1.5 text-xs text-amber-900">
                                                                <span className="font-semibold">Bottleneck: {String(report?.bottleneck_category || 'Unknown').replace(/_/g, ' ')}</span>
                                                                {' '}· {Number(report?.bottleneck_time_lost_hours || 0).toFixed(1)}h lost
                                                                {String(report?.bottleneck_description || '').trim() && <div className="mt-0.5">{report.bottleneck_description}</div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {selectedJobDetails?.status === 'at_risk' && (
                                <div className="rounded border border-amber-200 bg-amber-50 p-4">
                                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                                        <AlertTriangle className="w-4 h-4" />
                                        At Risk Reason
                                    </div>
                                    <div className="mt-2 text-sm text-amber-900">
                                        {selectedJobDetails?.risk_reason
                                            ? String(selectedJobDetails.risk_reason).replace(/_/g, ' ')
                                            : 'at risk'}
                                    </div>
                                    {!!String(selectedJobDetails?.risk_reason_details || '').trim() && (
                                        <div className="mt-1 text-sm text-amber-800">
                                            {selectedJobDetails.risk_reason_details}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="font-semibold text-slate-800">Issues</div>
                                {selectedJobIssues.length === 0 ? (
                                    <div className="text-sm text-slate-500">No issues reported for this job.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedJobIssues.map((r) => (
                                            <div key={r.id || r._id} className="rounded border border-red-200 bg-red-50 p-3">
                                                <div className="text-sm font-semibold text-red-800">
                                                    {String(r.bottleneck_category || 'issue').replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-sm text-red-700">{r.bottleneck_description || ''}</div>
                                                <div className="text-xs text-red-600 mt-1">
                                                    {r.date ? parseISO(r.date).toLocaleDateString() : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </DialogContent>
                </Dialog>



            </main>

        </div>
    );
}







