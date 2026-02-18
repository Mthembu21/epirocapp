import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from 'lucide-react';

export default function JobAddTechnicianModal({ job, technicians, isOpen, onClose, onSubmit, isLoading }) {
    const [selectedTechnician, setSelectedTechnician] = useState('');
    const [allocatedHours, setAllocatedHours] = useState(String(job?.allocated_hours ?? ''));

    const assignedIds = useMemo(() => {
        const ids = new Set((job?.technicians || []).map((t) => String(t?.technician_id)));
        if (job?.assigned_technician_id) ids.add(String(job.assigned_technician_id));
        return ids;
    }, [job]);

    const availableTechnicians = useMemo(() => {
        return (technicians || []).filter((t) => !assignedIds.has(String(t.id)) && t.status === 'active');
    }, [technicians, assignedIds]);

    const handleClose = () => {
        setSelectedTechnician('');
        setAllocatedHours(String(job?.allocated_hours ?? ''));
        onClose();
    };

    const handleSubmit = () => {
        if (!selectedTechnician) return;
        const tech = (technicians || []).find((t) => t.id === selectedTechnician);

        onSubmit({
            jobId: job?.id,
            jobNumber: job?.job_number,
            technicianId: selectedTechnician,
            technicianName: tech?.name || '',
            allocated_hours: allocatedHours
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
