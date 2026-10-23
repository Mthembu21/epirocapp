// Printable A4 activity report for one technician over the dashboard's selected period
// (Save as PDF from the browser's print dialog). Same look as the job report.
//
// Contents: KPI figures for the period, a day-by-day log of every entry (job or other
// activity, hours, what was done, issues), then hours per job and non-job time by type.

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const h = (n) => `${Number(n || 0).toFixed(1)}h`;
const pct = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `${Number(n).toFixed(1)}%`);
const fmtDate = (d, opts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) => {
    const dt = d ? new Date(d) : null;
    return dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString(undefined, opts) : '—';
};
const dayKey = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// Hours that count: nothing for a declined entry, the approved figure once approved,
// what was logged while still pending.
export const effectiveHours = (e) => {
    if (e?.approval_status === 'declined') return 0;
    if (e?.approval_status === 'approved' && Number(e.approved_hours) > 0) return Number(e.approved_hours);
    return Number(e?.hours_logged || 0);
};

const ABSENCE = ['Leave', 'Sick', 'Team Building'];

// What the technician wrote for a non-job entry: Idle keeps its reason in
// category_detail and the explanation in category_note; Training, Site Work and Other
// keep the note itself in category_detail.
export const nonJobNote = (e) => (e?.category === 'Idle'
    ? String(e?.category_note || '')
    : String(e?.category_detail || e?.category_note || '')).trim();

export const nonJobLabel = (e) => {
    if (e?.category === 'Idle') return `Idle${e.category_detail ? ` – ${e.category_detail}` : ''}`;
    return e?.category || 'Idle';
};

export function buildTechnicianReportHtml({ technician, workshop, periodLabel, periodRange, entries, reportsFor, jobByNumber, kpi }) {
    const rows = (entries || [])
        .filter((e) => e.approval_status !== 'declined')
        .slice()
        .sort((a, b) => String(a.log_date || '').localeCompare(String(b.log_date || '')));
    const declinedCount = (entries || []).length - rows.length;

    const jobRows = rows.filter((e) => !e.is_idle);
    const otherRows = rows.filter((e) => e.is_idle);
    const absenceRows = otherRows.filter((e) => ABSENCE.includes(e.category));
    const jobHours = jobRows.reduce((s, e) => s + effectiveHours(e), 0);
    const absenceHours = absenceRows.reduce((s, e) => s + effectiveHours(e), 0);
    const otherHours = otherRows.reduce((s, e) => s + effectiveHours(e), 0) - absenceHours;
    const totalHours = jobHours + otherHours + absenceHours;
    const overtime = rows.reduce((s, e) => s + Number(e.overtime_hours || 0), 0);
    const pendingCount = rows.filter((e) => e.approval_status === 'pending').length;
    const daysBooked = new Set(rows.map((e) => dayKey(e.log_date)).filter(Boolean)).size;
    const allReports = jobRows.flatMap((e) => reportsFor(e));
    const issueCount = allReports.filter((r) => r.has_bottleneck).length;

    const available = Number(kpi?.total_hours || 0);
    const remaining = available - totalHours;

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

    const logRows = rows.map((e) => {
        const hoursCell = `${h(effectiveHours(e))}${Number(e.overtime_hours || 0) > 0 ? `<div class="tag ot">${h(e.overtime_hours)} OT</div>` : ''}${
            e.approval_status === 'pending' ? '<div class="tag">pending</div>' : ''}`;
        if (e.is_idle) {
            const note = nonJobNote(e);
            const isAbsence = ABSENCE.includes(e.category);
            return `<tr>
              <td class="nowrap">${escapeHtml(fmtDate(e.log_date))}</td>
              <td><span class="pill ${isAbsence ? 'absence' : 'nonjob'}">${escapeHtml(nonJobLabel(e))}</span></td>
              <td class="num">${hoursCell}</td>
              <td>${note ? `<div class="work">${escapeHtml(note)}</div>` : `<div class="muted">${isAbsence ? '—' : 'No note'}</div>`}</td>
              <td>${isAbsence ? '<span class="muted">—</span>' : '<span class="ok">No issues</span>'}</td>
            </tr>`;
        }
        const reports = reportsFor(e);
        const notes = reports.map((r) => String(r.work_completed || '').trim()).filter(Boolean);
        const description = jobByNumber[String(e.job_id || '')]?.description || e.job_description || '';
        // Hours booked on another workshop's job are tagged with that workshop.
        const otherWorkshop = e.job_workshop && String(e.job_workshop).toLowerCase() !== String(workshop || '').toLowerCase()
            ? String(e.job_workshop) : '';
        return `<tr${reports.some((r) => r.has_bottleneck) ? ' class="has-issue"' : ''}>
          <td class="nowrap">${escapeHtml(fmtDate(e.log_date))}</td>
          <td><div class="job">${escapeHtml(e.job_id)}${otherWorkshop ? ` <span class="xw">${escapeHtml(otherWorkshop)} job</span>` : ''}</div>${description ? `<div class="sub">${escapeHtml(description)}</div>` : ''}${
              e.subtask_title ? `<div class="stage">${escapeHtml(e.subtask_title)}</div>` : ''}</td>
          <td class="num">${hoursCell}</td>
          <td>${notes.length ? notes.map((n) => `<div class="work">${escapeHtml(n)}</div>`).join('') : '<div class="muted">No report submitted</div>'}</td>
          <td>${issuesHtml(reports)}</td>
        </tr>`;
    }).join('');

    // Hours per job
    const byJob = new Map();
    for (const e of jobRows) {
        const key = String(e.job_id || '');
        if (!byJob.has(key)) byJob.set(key, { job: key, description: jobByNumber[key]?.description || e.job_description || '', hours: 0, days: new Set() });
        const j = byJob.get(key);
        j.hours += effectiveHours(e);
        j.days.add(dayKey(e.log_date));
    }
    const jobSummary = Array.from(byJob.values()).sort((a, b) => b.hours - a.hours);

    // Non-job time by type
    const byType = new Map();
    for (const e of otherRows) {
        const key = nonJobLabel(e);
        byType.set(key, (byType.get(key) || 0) + effectiveHours(e));
    }
    const typeSummary = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

    const rangeLabel = periodRange?.start && periodRange?.end
        ? (periodRange.start === periodRange.end
            ? fmtDate(`${periodRange.start}T00:00:00`, { day: '2-digit', month: 'short', year: 'numeric' })
            : `${fmtDate(`${periodRange.start}T00:00:00`, { day: '2-digit', month: 'short' })} – ${fmtDate(`${periodRange.end}T00:00:00`, { day: '2-digit', month: 'short', year: 'numeric' })}`)
        : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Technician Report - ${escapeHtml(technician?.name || '')} - ${escapeHtml(periodLabel || '')}</title>
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
  .period { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #dbeafe; color: #1e40af; }
  .meta { text-align: right; font-size: 9px; color: #64748b; line-height: 1.7; }

  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
  .cards > div { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 11px; page-break-inside: avoid; }
  .cards > div.accent { background: #fffbeb; border-color: #fde68a; }
  .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 600; }
  .v { font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .accent .v { color: #b45309; }
  .v.over { color: #b91c1c; }
  .s { font-size: 8.5px; color: #64748b; }

  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; page-break-after: avoid; }
  h2 .count { font-weight: 400; color: #64748b; text-transform: none; letter-spacing: normal; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; background: #f1f5f9; padding: 6px 7px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  .job { font-weight: 700; font-family: Consolas, 'Courier New', monospace; font-size: 10px; }
  .sub { color: #475569; }
  .xw { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600; font-size: 8px; text-transform: capitalize; color: #1e40af; background: #dbeafe; border-radius: 8px; padding: 0 6px; }
  .stage { font-size: 8.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; margin-top: 1px; }
  .work { white-space: pre-wrap; }
  .work + .work { margin-top: 3px; }
  .muted { color: #94a3b8; font-style: italic; }
  .ok { color: #15803d; }
  .issue { color: #92400e; }
  .issue strong { text-transform: capitalize; }
  .issue + .issue { margin-top: 4px; }
  tr.has-issue td { background: #fffbeb; }
  .tag { font-size: 8px; color: #64748b; }
  .tag.ot { color: #a16207; font-weight: 600; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .pill.nonjob { background: #ffedd5; color: #9a3412; }
  .pill.absence { background: #fee2e2; color: #b91c1c; }
  tfoot td { font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1; border-bottom: none; }
  .two { display: grid; grid-template-columns: 3fr 2fr; gap: 14px; }
  .empty { color: #94a3b8; font-style: italic; padding: 8px 0; }
  .note { font-size: 8.5px; color: #64748b; margin-top: 10px; }
  .footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="print-toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>

  <div class="header">
    <div>
      <div class="brand">EPIROC · LABOUR UTILIZATION · TECHNICIAN ACTIVITY REPORT</div>
      <h1>${escapeHtml(technician?.name || 'Technician')}</h1>
      <div class="desc">${technician?.employee_id ? `Employee ${escapeHtml(technician.employee_id)} · ` : ''}${escapeHtml(workshop || '')} workshop</div>
    </div>
    <div class="meta">
      <span class="period">${escapeHtml(periodLabel || '')}</span><br/>
      ${escapeHtml(rangeLabel)}<br/>
      Generated ${escapeHtml(new Date().toLocaleString())}
    </div>
  </div>

  <div class="cards">
    <div class="accent"><div class="k">Utilization</div><div class="v">${pct(kpi?.utilization_percent)}</div></div>
    <div class="accent"><div class="k">Productivity</div><div class="v">${pct(kpi?.productivity_percent)}</div></div>
    <div><div class="k">Hours booked</div><div class="v">${h(totalHours)}</div><div class="s">${available > 0 ? `of ${h(available)} available` : `${daysBooked} day${daysBooked === 1 ? '' : 's'} booked`}</div></div>
    <div><div class="k">${remaining >= 0 ? 'Hours not booked' : 'Booked over available'}</div><div class="v${remaining < 0 ? ' over' : ''}">${available > 0 ? h(Math.abs(remaining)) : '—'}</div></div>
    <div><div class="k">On jobs</div><div class="v">${h(jobHours)}</div><div class="s">${byJob.size} job${byJob.size === 1 ? '' : 's'}</div></div>
    <div><div class="k">Non-productive</div><div class="v">${h(otherHours)}</div><div class="s">idle, training, admin, etc.</div></div>
    <div><div class="k">Leave / sick</div><div class="v">${h(absenceHours)}</div><div class="s">${Number(kpi?.leave_days || 0)} leave · ${Number(kpi?.sick_days || 0)} sick day(s)</div></div>
    <div><div class="k">Overtime · Issues</div><div class="v">${h(overtime)}</div><div class="s">${issueCount} issue${issueCount === 1 ? '' : 's'} reported</div></div>
  </div>

  <h2>Daily Activity <span class="count">(${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} over ${daysBooked} day${daysBooked === 1 ? '' : 's'})</span></h2>
  ${rows.length ? `
  <table>
    <thead><tr>
      <th style="width:14%">Date</th><th style="width:22%">Job / Activity</th><th class="num" style="width:9%">Hours</th>
      <th style="width:33%">What was done</th><th style="width:22%">Issues</th>
    </tr></thead>
    <tbody>${logRows}</tbody>
  </table>` : '<div class="empty">No hours were booked in this period.</div>'}

  <div class="two">
    <div>
      <h2>Hours by Job</h2>
      ${jobSummary.length ? `
      <table>
        <thead><tr><th>Job</th><th class="num">Days</th><th class="num">Hours</th></tr></thead>
        <tbody>${jobSummary.map((j) => `<tr>
          <td><div class="job">${escapeHtml(j.job)}</div>${j.description ? `<div class="sub">${escapeHtml(j.description)}</div>` : ''}</td>
          <td class="num">${j.days.size}</td><td class="num">${h(j.hours)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total on jobs</td><td></td><td class="num">${h(jobHours)}</td></tr></tfoot>
      </table>` : '<div class="empty">No job hours in this period.</div>'}
    </div>
    <div>
      <h2>Other Time</h2>
      ${typeSummary.length ? `
      <table>
        <thead><tr><th>Type</th><th class="num">Hours</th></tr></thead>
        <tbody>${typeSummary.map(([type, hours]) => `<tr><td>${escapeHtml(type)}</td><td class="num">${h(hours)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${h(otherHours + absenceHours)}</td></tr></tfoot>
      </table>` : '<div class="empty">No non-job time in this period.</div>'}
    </div>
  </div>

  <div class="note">
    Hours count approved hours, plus hours still awaiting approval${pendingCount ? ` (${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} marked pending)` : ''}${
        declinedCount ? `; ${declinedCount} declined ${declinedCount === 1 ? 'entry is' : 'entries are'} excluded` : ''}.
    Utilization and productivity use the same calculation as the supervisor dashboard for this period.
  </div>
  <div class="footer">EPIROC Labour Utilization — ${escapeHtml(technician?.name || '')} — ${escapeHtml(periodLabel || '')} — printed ${escapeHtml(new Date().toLocaleString())}</div>
</body>
</html>`;
}

export function openTechnicianReport(args) {
    const win = window.open('', '_blank');
    if (!win) {
        alert('Please allow pop-ups to open the technician report.');
        return;
    }
    win.document.open();
    win.document.write(buildTechnicianReportHtml(args));
    win.document.close();
    win.focus();
}
