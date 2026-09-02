import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Search } from 'lucide-react';

// Per-technician daily activity feed: what each technician booked (job or idle
// category), for how long, what note/bottleneck they logged, and how that stacks
// up against their available hours for the currently selected time view.
export default function TechnicianActivityLog({
    technicians = [],
    timeLogs = [],
    jobs = [],
    jobReports = [],
    kpiData = {},
    periodLabel = ''
}) {
    const [search, setSearch] = React.useState('');

    const jobByNumber = React.useMemo(() => {
        const map = {};
        for (const j of jobs) {
            if (j?.job_number) map[String(j.job_number)] = j;
        }
        return map;
    }, [jobs]);

    // Job work entries don't carry their own note - the note comes from the
    // JobReport a technician optionally submits alongside that day's log for
    // that job. Index reports by technician+job+date so we can join them.
    const reportIndex = React.useMemo(() => {
        const map = new Map();
        for (const r of jobReports) {
            const dateKey = r?.date ? new Date(r.date).toISOString().slice(0, 10) : '';
            const jobKey = String(r?.job_number || r?.job_id || '');
            const techKey = String(r?.technician_id ?? '');
            const key = `${techKey}|${jobKey}|${dateKey}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(r);
        }
        return map;
    }, [jobReports]);

    const entriesByTechnician = React.useMemo(() => {
        const map = new Map();
        for (const log of timeLogs) {
            const id = String(log?.technician_id?._id || log?.technician_id || '');
            if (!id) continue;
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(log);
        }
        return map;
    }, [timeLogs]);

    const rows = React.useMemo(() => {
        const q = search.trim().toLowerCase();

        return technicians
            .filter((t) => !q || String(t?.name || '').toLowerCase().includes(q))
            .map((tech) => {
                const id = String(tech.id);
                const entries = (entriesByTechnician.get(id) || [])
                    .slice()
                    .sort((a, b) => String(b.log_date || '').localeCompare(String(a.log_date || '')))
                    .map((e) => {
                        const dateKey = e.log_date ? new Date(e.log_date).toISOString().slice(0, 10) : '';
                        let note = '';
                        let bottleneck = null;

                        if (e.is_idle) {
                            note = e.category_note || '';
                        } else {
                            const key = `${id}|${String(e.job_id || '')}|${dateKey}`;
                            const report = (reportIndex.get(key) || [])[0];
                            note = report?.work_completed || '';
                            bottleneck = report?.has_bottleneck ? (report.bottleneck_description || 'Bottleneck reported') : null;
                        }

                        const job = !e.is_idle ? jobByNumber[String(e.job_id || '')] : null;
                        return { ...e, dateKey, note, bottleneck, jobDescription: job?.description || '' };
                    });

                // "Booked" means hours booked on jobs specifically - idle time is a
                // separate figure, not a subset hidden inside it, so the two never
                // silently double up on screen.
                const idleHours = entries.filter((e) => e.is_idle).reduce((s, e) => s + Number(e.hours_logged || 0), 0);
                const bookedHours = entries.filter((e) => !e.is_idle).reduce((s, e) => s + Number(e.hours_logged || 0), 0);
                const totalLoggedHours = bookedHours + idleHours;
                const availableHours = Number(kpiData[id]?.total_hours || 0);
                // Signed, not clamped - a negative remaining means they logged more than
                // their available hours (overtime, a Sick/Leave day, etc.), and hiding
                // that behind a floor of 0 was the confusing part.
                const remainingHours = availableHours - totalLoggedHours;

                // One row per day: a technician who booked a job and idle time (or
                // several jobs) the same day gets a single grouped row instead of the
                // date repeating once per entry.
                const dayMap = new Map();
                for (const e of entries) {
                    const key = e.dateKey || 'unknown';
                    if (!dayMap.has(key)) {
                        dayMap.set(key, { dateKey: key, log_date: e.log_date, entries: [], totalHours: 0 });
                    }
                    const day = dayMap.get(key);
                    day.entries.push(e);
                    day.totalHours += Number(e.hours_logged || 0);
                }
                const dayGroups = Array.from(dayMap.values());

                return { tech, id, entries, dayGroups, bookedHours, idleHours, totalLoggedHours, availableHours, remainingHours };
            })
            .sort((a, b) => b.bookedHours - a.bookedHours || String(a.tech.name || '').localeCompare(String(b.tech.name || '')));
    }, [technicians, entriesByTechnician, reportIndex, jobByNumber, kpiData, search]);

    return (
        <Card className="border-0 shadow-lg bg-white/95">
            <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                        <ClipboardList className="w-5 h-5 text-yellow-500" />
                        Technician Activity
                        <span className="text-sm text-slate-500 font-normal">({periodLabel})</span>
                    </CardTitle>
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search technician..."
                            className="pl-8 h-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        {search ? `No technicians match "${search}".` : 'No technicians found.'}
                    </div>
                ) : (
                    <Accordion type="multiple" className="divide-y divide-slate-100">
                        {rows.map((r) => (
                            <AccordionItem key={r.id} value={r.id} className="border-0 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2">
                                        <div className="text-left">
                                            <p className="font-medium text-slate-800">{r.tech.name}</p>
                                            <p className="text-xs text-slate-500">{r.tech.employee_id}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">Available</p>
                                                <p className="font-semibold text-slate-700">{r.availableHours.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">On Jobs</p>
                                                <p className="font-semibold text-blue-600">{r.bookedHours.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">Idle</p>
                                                <p className="font-semibold text-amber-600">{r.idleHours.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">Total Logged</p>
                                                <p className="font-semibold text-slate-700">{r.totalLoggedHours.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">Remaining</p>
                                                {r.remainingHours < 0 ? (
                                                    <p className="font-semibold text-red-600">{Math.abs(r.remainingHours).toFixed(1)}h over</p>
                                                ) : (
                                                    <p className={`font-semibold ${r.remainingHours > 0 ? 'text-slate-500' : 'text-green-600'}`}>
                                                        {r.remainingHours.toFixed(1)}h
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {r.entries.length} {r.entries.length === 1 ? 'entry' : 'entries'}
                                            </Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    {r.entries.length === 0 ? (
                                        <p className="text-sm text-slate-400 py-4">No activity logged for this period.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50">
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Booked On</TableHead>
                                                        <TableHead className="text-right">Hours</TableHead>
                                                        <TableHead>Note</TableHead>
                                                        <TableHead>Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {r.dayGroups.map((day) => (
                                                        <TableRow key={day.dateKey}>
                                                            <TableCell className="text-xs text-slate-600 whitespace-nowrap align-top pt-3">
                                                                {day.log_date ? new Date(day.log_date).toLocaleDateString() : '-'}
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="space-y-2">
                                                                    {day.entries.map((e, idx) => (
                                                                        <div key={e.id || e._id || idx} className={`text-sm min-h-5 ${idx > 0 ? 'border-t border-slate-100 pt-2' : ''}`}>
                                                                            {e.is_idle ? (
                                                                                <span className="text-amber-700">
                                                                                    Idle — {e.category}{e.category_detail ? ` (${e.category_detail})` : ''}
                                                                                </span>
                                                                            ) : (
                                                                                <span>
                                                                                    <span className="font-mono text-slate-700">{e.job_id}</span>
                                                                                    {e.jobDescription && <span className="text-slate-500"> — {e.jobDescription}</span>}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right align-top">
                                                                <div className="space-y-2">
                                                                    {day.entries.map((e, idx) => (
                                                                        <div key={e.id || e._id || idx} className={`text-sm font-medium min-h-5 ${idx > 0 ? 'border-t border-slate-100 pt-2' : ''}`}>
                                                                            {Number(e.hours_logged || 0).toFixed(1)}h
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {day.entries.length > 1 && (
                                                                    <div className="text-xs font-semibold text-slate-700 border-t border-slate-200 mt-2 pt-1.5">
                                                                        {day.totalHours.toFixed(1)}h total
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-slate-600 max-w-[280px] align-top">
                                                                <div className="space-y-2">
                                                                    {day.entries.map((e, idx) => (
                                                                        <div key={e.id || e._id || idx} className={`min-h-5 ${idx > 0 ? 'border-t border-slate-100 pt-2' : ''}`}>
                                                                            {e.bottleneck && (
                                                                                <div className="text-red-600 text-xs font-medium mb-0.5">⚠ {e.bottleneck}</div>
                                                                            )}
                                                                            {e.note || <span className="text-slate-300">—</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="space-y-2">
                                                                    {day.entries.map((e, idx) => (
                                                                        <div key={e.id || e._id || idx} className={`min-h-5 ${idx > 0 ? 'border-t border-slate-100 pt-2' : ''}`}>
                                                                            {e.approval_status === 'approved' ? (
                                                                                <Badge className="bg-green-100 text-green-800">Approved</Badge>
                                                                            ) : e.approval_status === 'declined' ? (
                                                                                <Badge className="bg-red-100 text-red-800">Declined</Badge>
                                                                            ) : (
                                                                                <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    );
}
