import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Users, User } from 'lucide-react';
import { base44 } from '@/api/apiClient';

export default function GlobalTechnicianSelector({ 
    isOpen, 
    setIsOpen, 
    onTechnicianSelect, 
    currentSupervisorKey 
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [myTechnicians, setMyTechnicians] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTechnician, setNewTechnician] = useState({
        name: '',
        employee_id: '',
        employeeNumber: '',
        department: '',
        skill: ''
    });

    // Load my technicians on mount
    useEffect(() => {
        if (isOpen) {
            loadMyTechnicians();
        }
    }, [isOpen, currentSupervisorKey]);

    // Search global technicians
    useEffect(() => {
        if (searchQuery.trim()) {
            searchGlobalTechnicians();
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const loadMyTechnicians = async () => {
        try {
            setLoading(true);
            const technicians = await base44.entities.Technician.list();
            setMyTechnicians(technicians);
        } catch (error) {
            console.error('Error loading technicians:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchGlobalTechnicians = async () => {
        try {
            setLoading(true);
            const results = await base44.entities.Technician.search(searchQuery);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching technicians:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTechnician = async (e) => {
        e.preventDefault();
        try {
            const technicianData = {
                ...newTechnician,
                employeeNumber: newTechnician.employeeNumber || newTechnician.employee_id,
                employee_id: newTechnician.employee_id || newTechnician.employeeNumber,
                status: 'active'
            };
            
            const newTech = await base44.entities.Technician.create(technicianData);
            onTechnicianSelect(newTech);
            setIsOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error creating technician:', error);
            // Handle duplicate error message
            if (error.message?.includes('already exists')) {
                alert('Technician already exists. Please search and assign instead.');
            }
        }
    };

    const resetForm = () => {
        setNewTechnician({
            name: '',
            employee_id: '',
            employeeNumber: '',
            department: '',
            skill: ''
        });
        setShowCreateForm(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleTechnicianSelect = (technician) => {
        onTechnicianSelect(technician);
        setIsOpen(false);
        resetForm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-slate-800">Select Technician</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 mt-4">
                    {/* 🟢 Section 1: My Technicians */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-green-600" />
                            <h3 className="font-semibold text-green-700">My Technicians</h3>
                        </div>
                        <div className="grid gap-2 max-h-40 overflow-y-auto">
                            {myTechnicians.map(tech => (
                                <button
                                    key={tech._id}
                                    onClick={() => handleTechnicianSelect(tech)}
                                    className="flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-green-50 transition-colors"
                                >
                                    <User className="w-4 h-4 text-green-600" />
                                    <div>
                                        <div className="font-medium">{tech.name}</div>
                                        <div className="text-sm text-slate-500">
                                            {tech.employee_id || tech.employeeNumber} • {tech.department}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {myTechnicians.length === 0 && !loading && (
                                <div className="text-center py-4 text-slate-500">
                                    No technicians found. Create or search for technicians below.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🔵 Section 2: Search All Technicians */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Search className="w-4 h-4 text-blue-600" />
                            <h3 className="font-semibold text-blue-700">Search All Technicians</h3>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 border-blue-200"
                            />
                        </div>
                        
                        {searchResults.length > 0 && (
                            <div className="grid gap-2 mt-3 max-h-40 overflow-y-auto">
                                {searchResults.map(tech => (
                                    <button
                                        key={tech._id}
                                        onClick={() => handleTechnicianSelect(tech)}
                                        className="flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        <User className="w-4 h-4 text-blue-600" />
                                        <div>
                                            <div className="font-medium">{tech.name}</div>
                                            <div className="text-sm text-slate-500">
                                                {tech.employee_id || tech.employeeNumber} • {tech.department} • {tech.supervisor_key}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 🟡 Section 3: Create New Technician */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <UserPlus className="w-4 h-4 text-yellow-600" />
                            <h3 className="font-semibold text-yellow-700">Create New Technician</h3>
                        </div>
                        
                        {!showCreateForm ? (
                            <Button
                                onClick={() => setShowCreateForm(true)}
                                variant="outline"
                                className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Add New Technician
                            </Button>
                        ) : (
                            <form onSubmit={handleCreateTechnician} className="space-y-4 border rounded-lg p-4 bg-yellow-50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name *</Label>
                                        <Input
                                            id="name"
                                            placeholder="Enter technician name"
                                            value={newTechnician.name}
                                            onChange={(e) => setNewTechnician(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="employee_id">Employee ID *</Label>
                                        <Input
                                            id="employee_id"
                                            placeholder="e.g., EMP001"
                                            value={newTechnician.employee_id}
                                            onChange={(e) => setNewTechnician(prev => ({ ...prev, employee_id: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="department">Department</Label>
                                        <Input
                                            id="department"
                                            placeholder="e.g., Mechanical"
                                            value={newTechnician.department}
                                            onChange={(e) => setNewTechnician(prev => ({ ...prev, department: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="skill">Skill</Label>
                                        <Input
                                            id="skill"
                                            placeholder="e.g., Welding, Electrical"
                                            value={newTechnician.skill}
                                            onChange={(e) => setNewTechnician(prev => ({ ...prev, skill: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowCreateForm(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-800"
                                    >
                                        Create Technician
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
