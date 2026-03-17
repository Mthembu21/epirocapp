import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trash2, Pencil, Save, X } from 'lucide-react';

export default function TechnicianList({ technicians, onDelete, onUpdate, isUpdating = false }) {
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({ name: '', employee_id: '', department: '', status: 'active' });

    const technicianById = useMemo(() => {
        const map = {};
        for (const t of (technicians || [])) {
            if (t?.id) map[String(t.id)] = t;
        }
        return map;
    }, [technicians]);

    if (!technicians || technicians.length === 0) {
        return (
            <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
                <CardContent className="py-12">
                    <div className="text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No technicians added yet</p>
                        <p className="text-sm">Add a technician to start logging hours</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur">
            <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Users className="w-5 h-5 text-yellow-500" />
                    Manage Technicians ({technicians.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="space-y-3">
                    {technicians.map((tech) => {
                        const isEditing = String(editingId) === String(tech.id);
                        const current = technicianById[String(tech.id)] || tech;
                        return (
                        <div 
                            key={tech.id} 
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-yellow-50 transition-colors border border-slate-100"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-slate-800 font-bold">
                                    {tech.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Input
                                                value={draft.name}
                                                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                                                className="h-8"
                                                placeholder="Name"
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    value={draft.employee_id}
                                                    onChange={(e) => setDraft((p) => ({ ...p, employee_id: e.target.value }))}
                                                    className="h-8"
                                                    placeholder="Employee ID"
                                                />
                                                <Input
                                                    value={draft.department}
                                                    onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))}
                                                    className="h-8"
                                                    placeholder="Department"
                                                />
                                            </div>
                                            <Select
                                                value={draft.status}
                                                onValueChange={(value) => setDraft((p) => ({ ...p, status: value }))}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">active</SelectItem>
                                                    <SelectItem value="inactive">inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-medium text-slate-800">{tech.name}</p>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                {tech.employee_id && <span>{tech.employee_id}</span>}
                                                {tech.department && (
                                                    <>
                                                        {tech.employee_id && <span>•</span>}
                                                        <span>{tech.department}</span>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge 
                                    variant="outline" 
                                    className={tech.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500'}
                                >
                                    {tech.status || 'active'}
                                </Badge>
                                {isEditing ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditingId(null);
                                                setDraft({ name: '', employee_id: '', department: '', status: 'active' });
                                            }}
                                            className="h-8 w-8 text-slate-400 hover:text-slate-800"
                                            disabled={isUpdating}
                                            title="Cancel"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (!onUpdate) return;
                                                onUpdate({
                                                    id: tech.id,
                                                    data: {
                                                        name: String(draft.name || '').trim(),
                                                        employee_id: String(draft.employee_id || '').trim(),
                                                        department: String(draft.department || '').trim(),
                                                        status: draft.status
                                                    }
                                                });
                                            }}
                                            className="h-8 w-8 text-emerald-600 hover:text-emerald-800"
                                            disabled={isUpdating}
                                            title="Save"
                                        >
                                            <Save className="w-4 h-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setEditingId(tech.id);
                                            setDraft({
                                                name: current?.name || '',
                                                employee_id: current?.employee_id || '',
                                                department: current?.department || '',
                                                status: current?.status || 'active'
                                            });
                                        }}
                                        className="h-8 w-8 text-slate-400 hover:text-slate-800"
                                        title="Edit"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDelete(tech.id)}
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}