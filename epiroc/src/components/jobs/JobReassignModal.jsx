import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, ArrowRightLeft } from 'lucide-react';

export default function JobReassignModal({ job, technicians, isOpen, onClose, onReassign, isLoading }) {
    const [selectedTechnician, setSelectedTechnician] = useState('');
    const [reason, setReason] = useState('');
    const [selectedSubtasks, setSelectedSubtasks] = useState({});

    const assignedIds = new Set((job?.technicians || []).map((t) => String(t?.technician_id)));
    if (job?.assigned_technician_id) assignedIds.add(String(job.assigned_technician_id));

    const availableTechnicians = technicians.filter(
        t => !assignedIds.has(String(t.id)) && t.status === 'active'
    );

    const handleSubmit = () => {
        if (!selectedTechnician) return;
        
        const newTech = technicians.find(t => t.id === selectedTechnician);
        
        const selected = Object.entries(selectedSubtasks)
            .filter(([, v]) => v && v.enabled)
            .map(([subtaskId, v]) => ({
                subtaskId,
                allocated_hours: Number(v.allocated_hours || 0)
            }));

        onReassign({
            jobId: job.id,
            newTechnicianId: selectedTechnician,
            newTechnicianName: newTech?.name || '',
            previousTechnicianId: job.assigned_technician_id,
            previousTechnicianName: job.assigned_technician_name,
            reason,
            subtask_allocations: selected
        });
        
        setSelectedTechnician('');
        setReason('');
        setSelectedSubtasks({});
    };

    const handleClose = () => {
        setSelectedTechnician('');
        setReason('');
        setSelectedSubtasks({});
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-yellow-500" />
                        Assign Additional Technician
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-500">Job Number</p>
                        <p className="font-semibold">{job?.job_number}</p>
                        <p className="text-sm text-slate-600 mt-1">{job?.description}</p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-sm text-blue-600">Currently Assigned To</p>
                        <p className="font-semibold text-blue-800">{job?.assigned_technician_name}</p>
                        <p className="text-xs text-blue-600 mt-1">
                            Progress: {(job?.aggregated_progress_percentage ?? job?.progress_percentage ?? 0).toFixed(0)}% | 
                            Consumed: {(job?.consumed_hours || 0).toFixed(1)}h
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTechnicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        <div className="flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-green-500" />
                                            {tech.name} {tech.employee_id && `(${tech.employee_id})`}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Reason for Reassignment (Optional)</Label>
                        <Textarea
                            placeholder="Enter reason..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="h-20"
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
                        {isLoading ? 'Assigning...' : 'Assign Technician'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}