import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Briefcase } from 'lucide-react';

export default function JobAllocationModal({ technicians, existingJobs, onSubmit, isOpen, setIsOpen }) {
    const getSupervisorKey = () => {
        try {
            const stored = localStorage.getItem('epiroc_user');
            const parsed = stored ? JSON.parse(stored) : null;
            return parsed?.supervisor_key || 'component';
        } catch {
            return 'component';
        }
    };

    const supervisorKey = getSupervisorKey();

    const templates = {
        component: [
            { category: 'Disassemble', titles: ['Stripping', 'Washing'] },
            { category: 'Assemble', titles: ['Assembling', 'Paint'] },
            { category: 'Testing', titles: ['Test'] }
        ],
        rebuild: [
            { category: 'Disassemble', titles: ['Washing', 'Electrical Stripping', 'Mechanical Stripping', 'Boiler-Marking'] },
            { category: 'Assemble', titles: ['Boiler Making', 'Paint', 'Assemble', 'Mechanical/Fitter', 'Electrical', 'Washing'] },
            { category: 'Testing', titles: ['Testing'] }
        ],
        pdis: [
            { category: 'Assemble', titles: ['Assemble/PDI', 'Washing', 'Painting'] },
            { category: 'Testing', titles: ['Testing'] }
        ]
    };

    const selectedTemplate = templates[supervisorKey] || templates.component;
    const defaultSubtasks = selectedTemplate.flatMap((group) =>
        (group.titles || []).map((t) => ({
            category: group.category,
            title: t,
            allocated_hours: '',
            technician_id: ''
        }))
    );

    const [formData, setFormData] = useState({
        job_number: '',
        description: '',
        assigned_technician_id: '',
        allocated_hours: '',
        start_date: '',
        target_completion_date: '',
        subtasks: defaultSubtasks
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const tech = technicians.find(t => t.id === formData.assigned_technician_id);

        const allocatedTotal = parseFloat(formData.allocated_hours);
        const normalizedSubtasks = (formData.subtasks || []).map((st) => {
            const subAlloc = st.allocated_hours === '' ? 0 : Number(st.allocated_hours);
            const selected = technicians.find((t) => t.id === st.technician_id);
            return {
                category: st.category || null,
                title: st.title,
                weight: 1,
                allocated_hours: Number.isFinite(subAlloc) ? Math.max(0, subAlloc) : 0,
                assigned_technicians: selected ? [{
                    technician_id: selected.id,
                    technician_name: selected.name,
                    allocated_hours: Number.isFinite(subAlloc) ? Math.max(0, subAlloc) : 0
                }] : []
            };
        });

        const totalSubtaskAllocated = normalizedSubtasks.reduce((sum, st) => sum + (st.allocated_hours || 0), 0);
        if (Number.isFinite(allocatedTotal) && allocatedTotal > 0 && totalSubtaskAllocated > allocatedTotal) {
            alert('Sum of subtask allocated hours cannot exceed job allocated hours');
            return;
        }

        const techIds = new Set();
        if (formData.assigned_technician_id) techIds.add(formData.assigned_technician_id);
        for (const st of normalizedSubtasks) {
            for (const a of (st.assigned_technicians || [])) {
                if (a.technician_id) techIds.add(a.technician_id);
            }
        }

        const techniciansPayload = Array.from(techIds).map((id) => {
            const t = technicians.find((x) => x.id === id);
            return t ? { technician_id: t.id, technician_name: t.name } : null;
        }).filter(Boolean);

        onSubmit({
            ...formData,
            assigned_technician_name: tech?.name || '',
            allocated_hours: allocatedTotal,
            remaining_hours: parseFloat(formData.allocated_hours),
            consumed_hours: 0,
            progress_percentage: 0,
            status: 'pending_confirmation',
            bottleneck_count: 0,
            confirmed_by_technician: false,
            technicians: techniciansPayload,
            subtasks: normalizedSubtasks
        });

        setFormData({
            job_number: '',
            description: '',
            assigned_technician_id: '',
            allocated_hours: '',
            start_date: '',
            target_completion_date: '',
            subtasks: defaultSubtasks
        });
        setIsOpen(false);
    };

    const groupedSubtasks = (formData.subtasks || []).reduce((acc, st) => {
        const key = st.category || 'Other';
        acc[key] = acc[key] || [];
        acc[key].push(st);
        return acc;
    }, {});

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-800">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Job
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-slate-900 text-slate-100 border border-slate-700">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-yellow-500" />
                        Create New Job
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="mt-4 max-h-[75vh] overflow-y-auto pr-1 space-y-6">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Job Number</Label>
                                <Input
                                    placeholder="e.g., JOB-001"
                                    value={formData.job_number}
                                    onChange={(e) => setFormData(prev => ({ ...prev, job_number: e.target.value }))}
                                    required
                                    className="bg-slate-900/40 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Allocated Hours (Total)</Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    placeholder="e.g., 40"
                                    value={formData.allocated_hours}
                                    onChange={(e) => setFormData(prev => ({ ...prev, allocated_hours: e.target.value }))}
                                    required
                                    className="bg-slate-900/40 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                                <p className="text-xs text-slate-400">
                                    Total hours allocated for this job.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Job Description</Label>
                            <Textarea
                                placeholder="Describe the job..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                required
                                className="min-h-20 bg-slate-900/40 border-slate-700 text-slate-100 placeholder:text-slate-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 md:col-span-1">
                                <Label>Assign Technician</Label>
                                <Select
                                    value={formData.assigned_technician_id}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_technician_id: value }))}
                                >
                                    <SelectTrigger className="bg-slate-900/40 border-slate-700 text-slate-100">
                                        <SelectValue placeholder="Select technician" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {technicians.filter(t => t.status === 'active').map(tech => (
                                            <SelectItem key={tech.id} value={tech.id}>
                                                {tech.name} ({tech.employee_id})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                    required
                                    className="bg-slate-900/40 border-slate-700 text-slate-100"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Target Completion</Label>
                                <Input
                                    type="date"
                                    value={formData.target_completion_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, target_completion_date: e.target.value }))}
                                    className="bg-slate-900/40 border-slate-700 text-slate-100"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-baseline justify-between gap-3">
                            <div className="space-y-1">
                                <Label>Stages (Category → Task → Technician + Hours)</Label>
                                <div className="text-xs text-slate-400">
                                    You can assign different technicians per stage.
                                </div>
                            </div>
                            <span className="text-xs text-slate-400 text-right">
                                Total subtask hours must be ≤ job allocated hours
                            </span>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(groupedSubtasks).map(([category, tasks]) => (
                                <div key={category} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                                    <div className="text-sm font-bold text-yellow-400">{category}</div>
                                    <div className="mt-3 space-y-3">
                                        {tasks.map((st) => {
                                            const idx = (formData.subtasks || []).findIndex(
                                                (x) => x.title === st.title && x.category === st.category
                                            );
                                            return (
                                                <div key={`${st.category}-${st.title}`} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm font-semibold text-slate-100">{st.title}</div>
                                                        <div className="text-xs text-slate-400">Optional</div>
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3">
                                                        <div className="md:col-span-7 space-y-1">
                                                            <div className="text-xs font-medium text-slate-300">Technician</div>
                                                            <Select
                                                                value={st.technician_id}
                                                                onValueChange={(value) => {
                                                                    setFormData((prev) => {
                                                                        const next = [...(prev.subtasks || [])];
                                                                        next[idx] = { ...next[idx], technician_id: value };
                                                                        return { ...prev, subtasks: next };
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger className="bg-slate-900/40 border-slate-700 text-slate-100">
                                                                    <SelectValue placeholder="Select technician" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {technicians.filter(t => t.status === 'active').map(tech => (
                                                                        <SelectItem key={tech.id} value={tech.id}>
                                                                            {tech.name} ({tech.employee_id})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="md:col-span-5 space-y-1">
                                                            <div className="text-xs font-medium text-slate-300">Allocated Hours</div>
                                                            <Input
                                                                type="number"
                                                                step="0.5"
                                                                min="0"
                                                                placeholder="0"
                                                                value={st.allocated_hours}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setFormData((prev) => {
                                                                        const next = [...(prev.subtasks || [])];
                                                                        next[idx] = { ...next[idx], allocated_hours: value };
                                                                        return { ...prev, subtasks: next };
                                                                    });
                                                                }}
                                                                className="bg-slate-900/40 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">
                            Tip: You can leave a subtask unassigned for now. The sum of subtask hours cannot exceed the job’s total allocated hours.
                        </p>
                    </div>

                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-slate-200">
                        <div className="font-medium text-yellow-300">Note</div>
                        <div className="mt-1 text-slate-300">
                            Job becomes active only after technician confirms/accepts it.
                        </div>
                        <div className="mt-1 text-slate-300">
                            If the Job Number already exists, the selected technician will be added to the same job.
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-200 hover:bg-slate-800">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-slate-900">
                            Create Job
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}