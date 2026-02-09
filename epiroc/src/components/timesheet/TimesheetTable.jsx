import React from 'react';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Clock } from 'lucide-react';

export default function TimesheetTable({ entries, onDelete }) {
    const getDayBadgeColor = (day) => {
        switch (day) {
            case 'Sunday':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'Saturday':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (!entries || entries.length === 0) {
        return (
            <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
                <CardContent className="py-12">
                    <div className="text-center text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No timesheet entries yet</p>
                        <p className="text-sm">Start logging work hours above</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    All Timesheet Entries ({entries.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-800 hover:bg-slate-800">
                                <TableHead className="text-white font-semibold">Technician</TableHead>
                                <TableHead className="text-white font-semibold">Date</TableHead>
                                <TableHead className="text-white font-semibold">Day</TableHead>
                                <TableHead className="text-white font-semibold">Time</TableHead>
                                <TableHead className="text-white font-semibold text-right">Total</TableHead>
                                <TableHead className="text-white font-semibold text-right">Normal</TableHead>
                                <TableHead className="text-white font-semibold text-right">OT</TableHead>
                                <TableHead className="text-white font-semibold text-right">Rate</TableHead>
                                <TableHead className="text-white font-semibold text-right">Weighted OT</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry) => (
                                <TableRow key={entry.id} className="hover:bg-yellow-50/50 transition-colors">
                                    <TableCell className="font-medium">{entry.technician_name}</TableCell>
                                    <TableCell>{format(parseISO(entry.date), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getDayBadgeColor(entry.day_of_week)}>
                                            {entry.day_of_week?.slice(0, 3)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                        {entry.start_time} - {entry.end_time}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{entry.total_hours}h</TableCell>
                                    <TableCell className="text-right text-green-600">{entry.normal_hours}h</TableCell>
                                    <TableCell className="text-right text-amber-600">{entry.overtime_hours}h</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                            {entry.overtime_rate}x
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-yellow-600">
                                        {entry.weighted_overtime}h
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(entry.id)}
                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}