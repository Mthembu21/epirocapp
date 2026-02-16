import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from 'lucide-react';

export default function TechnicianModal({ onAdd, isOpen, setIsOpen }) {
    const [formData, setFormData] = useState({
        name: '',
        employee_id: '',
        department: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({
            ...formData,
            name: formData.name.trim(),
            employee_id: formData.employee_id.trim(),
            department: formData.department.trim(),
            status: 'active'
        });
        setFormData({ name: '', employee_id: '', department: '' });
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Technician
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-slate-800">Add New Technician</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                            id="name"
                            placeholder="Enter technician name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className="border-slate-300"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="employee_id">Employee ID *</Label>
                        <Input
                            id="employee_id"
                            placeholder="e.g., EMP001"
                            value={formData.employee_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                            required
                            className="border-slate-300"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                            id="department"
                            placeholder="e.g., Mechanical, Electrical"
                            value={formData.department}
                            onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                            className="border-slate-300"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold">
                            Add Technician
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}