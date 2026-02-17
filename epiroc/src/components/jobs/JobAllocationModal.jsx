import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Briefcase } from 'lucide-react';

export default function JobAllocationModal({ technicians, existingJobs, onSubmit, isOpen, setIsOpen }) {
    const [formData, setFormData] = useState({
        job_number: '',
        description: '',
        assigned_technician_id: '',
        allocated_hours: '',
        start_date: '',
        target_completion_date: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const tech = technicians.find(t => t.id === formData.assigned_technician_id);
        
        onSubmit({
            ...formData,
            assigned_technician_name: tech?.name || '',
            allocated_hours: parseFloat(formData.allocated_hours),
            remaining_hours: parseFloat(formData.allocated_hours),
            consumed_hours: 0,
            progress_percentage: 0,
            status: 'pending_confirmation',
            bottleneck_count: 0,
            confirmed_by_technician: false
        });

        setFormData({
            job_number: '',
            description: '',
            assigned_technician_id: '',
            allocated_hours: '',
            start_date: '',
            target_completion_date: ''
        });
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-800">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Job
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-yellow-500" />
                        Create New Job
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label>Job Number</Label>
                        <Input
                            placeholder="e.g., JOB-001"
                            value={formData.job_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, job_number: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Job Description</Label>
                        <Textarea
                            placeholder="Describe the job..."
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Assign Technician</Label>
                        <Select
                            value={formData.assigned_technician_id}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_technician_id: value }))}
                        >
                            <SelectTrigger>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Target Completion</Label>
                            <Input
                                type="date"
                                value={formData.target_completion_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_completion_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Allocated Hours (Total for Job)</Label>
                        <Input
                            type="number"
                            step="0.5"
                            min="0.5"
                            placeholder="e.g., 40 hours"
                            value={formData.allocated_hours}
                            onChange={(e) => setFormData(prev => ({ ...prev, allocated_hours: e.target.value }))}
                            required
                        />
                        <p className="text-xs text-slate-500">
                            Total hours allocated for this job (no limit - can span multiple days)
                        </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                        <p className="font-medium">Note:</p>
                        <p>Job becomes active only after technician confirms/accepts it.</p>
                        <p>If the Job Number already exists, the selected technician will be added to the same job.</p>
                    </div>

                    <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800">
                        Create Job
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}