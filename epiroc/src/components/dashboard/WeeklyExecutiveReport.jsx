import React, { useMemo, useState } from 'react';
import { format, startOfWeek, addDays, subWeeks } from 'date-fns';
import { FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/apiClient';

const WORKSHOP_LABELS = { component: 'Component', rebuild: 'Rebuild', pdis: 'PDIS', kathu: 'Kathu' };

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const h = (n) => `${Number(n || 0).toFixed(1)}h`;
const pct = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `${Number(n).toFixed(1)}%`);
const dayLabel = (d) => {
    try { return format(new Date(`${d}T00:00:00`), 'EEE dd MMM'); } catch { return String(d || ''); }
};

// Mon-Sun weeks, most recent first: this week, last week, and six before that.
function buildWeekOptions() {
    const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 8 }, (_, i) => {
        const start = subWeeks(thisMonday, i);
        const end = addDays(start, 6);
        const range = `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`;
        return {
            value: format(start, 'yyyy-MM-dd'),
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd'),
            label: i === 0 ? `This week (${range})` : i === 1 ? `Last week (${range})` : range
        };
    });
}

// The completed report also returns jobs with no recorded completion date for any
// range, so keep only jobs whose completion (or last booking) fell in the week.
function completedJobsInWeek(completed, week) {
    return (Array.isArray(completed) ? completed : [])
        .map((j) => {
            const when = j.actual_completion_date || j.completed_at || j.last_log_date;
            const key = when ? format(new Date(when), 'yyyy-MM-dd') : '';
            return { ...j, _completedKey: key, _completedLabel: key ? format(new Date(when), 'EEE dd MMM') : '' };
        })
        .filter((j) => j._completedKey && j._completedKey >= week.start && j._completedKey <= week.end)
        .sort((a, b) => a._completedKey.localeCompare(b._completedKey));
}

function buildReportHtml({ week, workshop, kpiData, technicians, completedJobs }) {
    const kpis = kpiData?.kpis || {};
    const totals = kpiData?.details?.totals || {};
    const techRows = Array.isArray(kpiData?.details?.technicians) ? kpiData.details.technicians : [];

    const nameById = (technicians || []).reduce((acc, t) => {
        const id = String(t?.id || t?._id || '');
        if (id) acc[id] = t?.name || t?.technician_name || id;
        return acc;
    }, {});
    const nameOf = (id) => nameById[String(id)] || 'Unknown technician';

    const techs = techRows
        .map((t) => ({ ...t, name: nameOf(t.technician_id) }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Who was out / in training / idle, and when — flattened for the activities section.
    const activity = (field) => techs.flatMap((t) => (t[field] || []).map((e) => ({ ...e, name: t.name })))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.name.localeCompare(b.name));
    const notAvailable = activity('not_available_entries');
    const training = activity('training_entries');
    const idleAndNonProductive = [...activity('idle_entries'), ...activity('non_productive_entries')];

    // Idle / non-productive hours grouped by reason, for a compact summary line.
    const lossByReason = idleAndNonProductive.reduce((acc, e) => {
        const reason = e.sub_reason ? `${e.category} – ${e.sub_reason}` : (e.category || 'Other');
        acc[reason] = (acc[reason] || 0) + Number(e.hours || 0);
        return acc;
    }, {});
    const lossRows = Object.entries(lossByReason).sort((a, b) => b[1] - a[1]);

    const series = Array.isArray(kpiData?.series) ? kpiData.series : [];
    const rows = (arr, fn) => arr.map(fn).join('');
    const weekTitle = `${format(new Date(`${week.start}T00:00:00`), 'dd MMM')} – ${format(new Date(`${week.end}T00:00:00`), 'dd MMM yyyy')}`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Weekly Report - ${escapeHtml(workshop)} - ${escapeHtml(weekTitle)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1e293b; font-size: 11px; margin: 0; line-height: 1.45;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { font-size: 12px; margin: 18px 0 8px; padding: 5px 10px; background: #1e293b; color: #fff; border-radius: 3px;
       text-transform: uppercase; letter-spacing: 0.05em; page-break-after: avoid; }
  h2 .count { font-weight: 400; opacity: 0.7; text-transform: none; letter-spacing: normal; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; margin-bottom: 14px;
            border-radius: 6px; background: #1e293b; color: #fff; border-bottom: 4px solid #eab308; }
  .header h1 { font-size: 18px; margin: 0 0 2px; color: #fff; }
  .header .subtitle { color: #fbbf24; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .header .desc { color: #cbd5e1; font-size: 11px; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 9px; color: #cbd5e1; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 11px; background: #f8fafc; }
  .card .label { font-size: 8.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .card .value { font-size: 18px; font-weight: 700; margin-top: 3px; color: #0f172a; }
  .card .sub { font-size: 9px; color: #64748b; margin-top: 1px; }
  .card.primary { background: #fffbeb; border-color: #fde68a; }
  .card.primary .value { color: #b45309; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 7px; text-align: left; font-size: 9.5px; vertical-align: top; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.02em; color: #475569; }
  tbody tr:nth-child(even) { background: #fbfcfe; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; background: #f1f5f9; }
  .low { color: #b91c1c; font-weight: 700; }
  .good { color: #166534; font-weight: 700; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .empty { color: #94a3b8; font-style: italic; padding: 6px 0; }
  .defs { margin-top: 16px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 8.5px; color: #64748b; }
  .defs strong { color: #475569; }
  .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8.5px; color: #94a3b8; text-align: center; }
  .print-toolbar { text-align: right; margin-bottom: 10px; }
  .print-toolbar button { font-family: inherit; font-size: 12px; padding: 7px 16px; border-radius: 4px; border: none;
                          background: #eab308; color: #1e293b; font-weight: 700; cursor: pointer; }
  @media print { .print-toolbar { display: none; } }
</style>
</head>
<body>
  <div class="print-toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>

  <div class="header">
    <div>
      <div class="subtitle">EPIROC · LABOUR UTILIZATION</div>
      <h1>Weekly Executive Report</h1>
      <div class="desc">${escapeHtml(workshop)} workshop · Week of ${escapeHtml(weekTitle)}</div>
    </div>
    <div class="meta">Generated ${escapeHtml(new Date().toLocaleString())}<br/>Technicians: ${techs.length}</div>
  </div>

  <h2>Performance</h2>
  <div class="grid">
    <div class="card primary"><div class="label">Utilization</div><div class="value">${pct(kpis.utilization_percent)}</div></div>
    <div class="card primary"><div class="label">Productivity</div><div class="value">${pct(kpis.productivity_percent)}</div></div>
    <div class="card"><div class="label">Availability</div><div class="value">${pct(kpis.availability_percent)}</div></div>
    <div class="card"><div class="label">Efficiency</div><div class="value">${pct(kpis.efficiency_percent)}</div></div>
  </div>
  <div class="grid">
    <div class="card"><div class="label">Productive Hours</div><div class="value">${h(totals.productive_hours)}</div><div class="sub">of ${h(totals.scheduled_hours)} scheduled</div></div>
    <div class="card"><div class="label">Training</div><div class="value">${h(totals.training_hours)}</div><div class="sub">${pct(kpis.training_percent)}</div></div>
    <div class="card"><div class="label">Idle + Non-Productive</div><div class="value">${h(Number(totals.idle_hours || 0) + Number(totals.non_productive_hours || 0))}</div><div class="sub">idle ${pct(kpis.idle_percent)}</div></div>
    <div class="card"><div class="label">Overtime</div><div class="value">${h(kpiData?.overtime_hours)}</div></div>
  </div>

  <h2>Activities <span class="count">— leave, sick, team building &amp; training</span></h2>
  <div class="grid">
    <div class="card"><div class="label">Leave Days</div><div class="value">${Number(totals.leave_days || 0)}</div></div>
    <div class="card"><div class="label">Sick Days</div><div class="value">${Number(totals.sick_days || 0)}</div></div>
    <div class="card"><div class="label">Team Building Days</div><div class="value">${Number(totals.team_building_days || 0)}</div></div>
    <div class="card"><div class="label">Not Available</div><div class="value">${h(totals.not_available_hours)}</div></div>
  </div>
  <div class="two-col">
    <div>
      <table>
        <thead><tr><th>Leave / Sick / Team Building</th><th>Date</th><th class="num">Hours</th></tr></thead>
        <tbody>${notAvailable.length ? rows(notAvailable, (e) => `<tr>
          <td>${escapeHtml(e.name)} — ${escapeHtml(e.category || 'Leave')}</td>
          <td>${escapeHtml(dayLabel(e.date))}</td>
          <td class="num">${h(e.hours)}</td></tr>`) : '<tr><td colspan="3" class="empty">Nobody was on leave, sick or at team building.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>Training</th><th>Date</th><th class="num">Hours</th></tr></thead>
        <tbody>${training.length ? rows(training, (e) => `<tr>
          <td>${escapeHtml(e.name)}</td>
          <td>${escapeHtml(dayLabel(e.date))}</td>
          <td class="num">${h(e.hours)}</td></tr>`) : '<tr><td colspan="3" class="empty">No training logged.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
  ${lossRows.length ? `
  <table>
    <thead><tr><th>Idle &amp; non-productive time by reason</th><th class="num">Hours</th></tr></thead>
    <tbody>${rows(lossRows, ([reason, hours]) => `<tr><td>${escapeHtml(reason)}</td><td class="num">${h(hours)}</td></tr>`)}</tbody>
  </table>` : ''}

  <h2>Technician Performance <span class="count">(${techs.length})</span></h2>
  ${techs.length ? `
  <table>
    <thead><tr>
      <th>Technician</th><th class="num">Scheduled</th><th class="num">Productive</th><th class="num">Training</th>
      <th class="num">Idle / NP</th><th class="num">Leave / Sick</th><th class="num">Utilization</th><th class="num">Productivity</th>
    </tr></thead>
    <tbody>${rows(techs, (t) => {
        const util = Number(t.utilization_percent);
        return `<tr>
        <td>${escapeHtml(t.name)}</td>
        <td class="num">${h(t.scheduled_hours)}</td>
        <td class="num">${h(t.productive_hours)}</td>
        <td class="num">${h(t.training_hours)}</td>
        <td class="num">${h(Number(t.idle_hours || 0) + Number(t.non_productive_hours || 0))}</td>
        <td class="num">${h(t.not_available_hours)}</td>
        <td class="num ${util < 50 ? 'low' : util >= 85 ? 'good' : ''}">${pct(t.utilization_percent)}</td>
        <td class="num">${pct(t.productivity_percent)}</td>
      </tr>`;
    })}</tbody>
    <tfoot><tr>
      <td>Total</td><td class="num">${h(totals.scheduled_hours)}</td><td class="num">${h(totals.productive_hours)}</td>
      <td class="num">${h(totals.training_hours)}</td><td class="num">${h(Number(totals.idle_hours || 0) + Number(totals.non_productive_hours || 0))}</td>
      <td class="num">${h(totals.not_available_hours)}</td><td class="num">${pct(kpis.utilization_percent)}</td><td class="num">${pct(kpis.productivity_percent)}</td>
    </tr></tfoot>
  </table>` : '<div class="empty">No technician data for this week.</div>'}

  ${series.length ? `
  <h2>Daily Trend</h2>
  <table>
    <thead><tr><th>Day</th><th class="num">Productive</th><th class="num">Training</th><th class="num">Scheduled</th><th class="num">Utilization</th><th class="num">Productivity</th></tr></thead>
    <tbody>${rows(series, (d) => `<tr>
      <td>${escapeHtml(dayLabel(d.date))}</td>
      <td class="num">${h(d.productiveHours)}</td>
      <td class="num">${h(d.trainingHours)}</td>
      <td class="num">${h(d.scheduledHours)}</td>
      <td class="num">${pct(d.utilization_percent)}</td>
      <td class="num">${pct(d.productivity_percent)}</td>
    </tr>`)}</tbody>
  </table>` : ''}

  <h2>Jobs Completed This Week <span class="count">(${completedJobs.length})</span></h2>
  ${completedJobs.length ? `
  <table>
    <thead><tr><th>Job</th><th>Description</th><th>Completed</th><th class="num">Allocated</th><th class="num">Logged</th></tr></thead>
    <tbody>${rows(completedJobs, (j) => `<tr>
      <td>${escapeHtml(j.job_number)}</td>
      <td>${escapeHtml(j.description || '')}</td>
      <td>${escapeHtml(j._completedLabel)}</td>
      <td class="num">${h(j.allocated_hours)}</td>
      <td class="num">${h(j.time_summary?.total_hours ?? j.consumed_hours)}</td>
    </tr>`)}</tbody>
  </table>` : '<div class="empty">No jobs were completed this week.</div>'}

  <div class="defs">
    <strong>Definitions</strong> — figures use the same calculation as the supervisor dashboard KPIs for this week.
    <strong>Utilization</strong>: (productive + training hours) ÷ available hours (scheduled less leave/sick).
    <strong>Productivity</strong>: productive hours ÷ available productive hours.
    <strong>Availability</strong>: available hours ÷ scheduled hours.
    <strong>Efficiency</strong>: productive hours ÷ all hours booked.
    <strong>Productive</strong>: hours booked on jobs and site work. <strong>Idle / NP</strong>: idle, housekeeping, admin, waiting for parts.
  </div>
  <div class="footer">EPIROC Labour Utilization — ${escapeHtml(workshop)} — Week of ${escapeHtml(weekTitle)}</div>
</body>
</html>`;
}

export default function WeeklyExecutiveReport({ supervisorKey, technicians }) {
    const weekOptions = useMemo(buildWeekOptions, []);
    const [open, setOpen] = useState(false);
    const [weekValue, setWeekValue] = useState(weekOptions[1].value); // default: last full week
    const [isGenerating, setIsGenerating] = useState(false);

    const generate = async () => {
        const week = weekOptions.find((w) => w.value === weekValue) || weekOptions[1];
        // Open the tab synchronously inside the click so pop-up blockers allow it,
        // then fill it once the data has loaded.
        const win = window.open('', '_blank');
        if (!win) {
            alert('Please allow pop-ups to open the weekly report.');
            return;
        }
        win.document.write('<p style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#475569">Generating weekly report…</p>');

        setIsGenerating(true);
        try {
            const [kpiResponse, completed] = await Promise.all([
                base44.entities.KPI.dashboardOverview(supervisorKey, { start_date: week.start, end_date: week.end }),
                base44.entities.Job.completedReport({ fromDate: week.start, toDate: week.end, limit: 500 }).catch(() => [])
            ]);
            const kpiData = kpiResponse?.data?.data || kpiResponse?.data || kpiResponse || {};
            const completedJobs = completedJobsInWeek(completed, week);

            const html = buildReportHtml({
                week,
                workshop: WORKSHOP_LABELS[supervisorKey] || supervisorKey || '',
                kpiData,
                technicians,
                completedJobs
            });
            win.document.open();
            win.document.write(html);
            win.document.close();
            win.focus();
            setOpen(false);
        } catch (e) {
            win.document.body.innerHTML = `<p style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#b91c1c">Could not generate the report: ${escapeHtml(e?.message || 'Unknown error')}</p>`;
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                className="border-slate-400 text-slate-700 hover:bg-slate-50 h-10 px-4"
                disabled={!supervisorKey}
                onClick={() => setOpen(true)}
            >
                <FileText className="w-4 h-4 mr-2" />
                Weekly Report
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Weekly Executive Report</DialogTitle>
                        <DialogDescription>
                            Performance, leave, sick, training and jobs completed for one week, ready to print or save as PDF.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select value={weekValue} onValueChange={setWeekValue}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select week" />
                            </SelectTrigger>
                            <SelectContent>
                                {weekOptions.map((w) => (
                                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button
                                className="bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                                disabled={isGenerating}
                                onClick={generate}
                            >
                                {isGenerating ? 'Generating…' : 'Generate Report'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
