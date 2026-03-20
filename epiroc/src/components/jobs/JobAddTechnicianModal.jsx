import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from 'lucide-react';

export default function JobAddTechnicianModal({ job, technicians, isOpen, onClose, onSubmit, isLoading }) {
    const [selectedTechnician, setSelectedTechnician] = useState('');
    const [allocatedHours, setAllocatedHours] = useState(String(job?.allocated_hours ?? ''));
    const [selectedSubtasks, setSelectedSubtasks] = useState({});

    const availableTechnicians = useMemo(() => {
        return (technicians || []).filter((t) => t.status === 'active');
    }, [technicians]);

    const handleClose = () => {
        setSelectedTechnician('');
        setAllocatedHours(String(job?.allocated_hours ?? ''));
        setSelectedSubtasks({});
        onClose();
    };

    const handleSubmit = () => {
        if (!selectedTechnician) return;
        const tech = (technicians || []).find((t) => t.id === selectedTechnician);

        const selected = Object.entries(selectedSubtasks)
            .filter(([, v]) => v && v.enabled)
            .map(([subtaskId, v]) => ({
                subtaskId,
                allocated_hours: Number(v.allocated_hours || 0)
            }));

        onSubmit({
            jobId: job?.id,
            jobNumber: job?.job_number,
            technicianId: selectedTechnician,
            technicianName: tech?.name || '',
            allocated_hours: allocatedHours,
            subtask_allocations: selected
        });

        setSelectedTechnician('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-yellow-500" />
                        Add Technician
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Job Number</p>
                        <p className="font-semibold">{job?.job_number}</p>
                        <p className="text-sm text-slate-600 mt-1">{job?.description}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Technician</Label>
                        <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTechnicians.map((tech) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        {tech.name} {tech.employee_id && `(${tech.employee_id})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Allocated Hours (Total for Job)</Label>
                        <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={allocatedHours}
                            onChange={(e) => setAllocatedHours(e.target.value)}
                        />
                    </div>

                    {(job?.subtasks || []).length > 0 && (
                        <div className="space-y-2">
                            <Label>Assign Stages (Subtasks)</Label>
                            <div className="space-y-2 max-h-56 overflow-auto rounded-md border border-slate-200 p-2">
                                {(job.subtasks || []).map((st) => {
                                    const subtaskId = String(st?._id || st?.id);
                                    const current = selectedSubtasks[subtaskId] || { enabled: false, allocated_hours: '' };
                                    return (
                                        <div key={subtaskId} className="flex items-center gap-2 bg-slate-50 rounded p-2">
                                            <Checkbox
                                                checked={!!current.enabled}
                                                onCheckedChange={(checked) => {
                                                    setSelectedSubtasks((prev) => ({
                                                        ...prev,
                                                        [subtaskId]: {
                                                            enabled: !!checked,
                                                            allocated_hours: prev?.[subtaskId]?.allocated_hours ?? ''
                                                        }
                                                    }));
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{st?.title}</p>
                                                {st?.category && <p className="text-xs text-slate-500 truncate">{st.category}</p>}
                                            </div>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                disabled={!current.enabled}
                                                value={current.allocated_hours}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setSelectedSubtasks((prev) => ({
                                                        ...prev,
                                                        [subtaskId]: {
                                                            enabled: true,
                                                            allocated_hours: v
                                                        }
                                                    }));
                                                }}
                                                className="w-24"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedTechnician || isLoading}
                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                    >
                        {isLoading ? 'Saving...' : 'Add'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
