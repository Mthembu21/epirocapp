import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, Users, User, Clock, Building } from 'lucide-react';
import { base44 } from '@/api/apiClient';

export default function JobAddTechnicianModal({ job, technicians, isOpen, onClose, onSubmit, isLoading }) {
    const [selectedTechnician, setSelectedTechnician] = useState('');
    const [allocatedHours, setAllocatedHours] = useState(String(job?.allocated_hours ?? ''));
    const [selectedSubtasks, setSelectedSubtasks] = useState({});
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [temporaryAssignment, setTemporaryAssignment] = useState({
        technicianId: null,
        duration_hours: 8,
        reason: '',
        showForm: false
    });

    const availableTechnicians = useMemo(() => {
        return (technicians || []).filter((t) => t.status === 'active');
    }, [technicians]);

    // Combine regular technicians with temporarily assigned ones
    const allAvailableTechnicians = useMemo(() => {
        const tempTechs = globalSearchResults.filter(tech => 
            tech.isTemporary && (tech._id || tech.id) === selectedTechnician
        );
        return [...availableTechnicians, ...tempTechs];
    }, [availableTechnicians, globalSearchResults, selectedTechnician]);

    // Global search with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (globalSearchQuery.trim()) {
                searchGlobalTechnicians();
            } else {
                setGlobalSearchResults([]);
            }
        }, 300);
        
        return () => clearTimeout(timeoutId);
    }, [globalSearchQuery]);

    const searchGlobalTechnicians = useCallback(async () => {
        try {
            setLoading(true);
            const results = await base44.entities.Technician.search(globalSearchQuery);
            setGlobalSearchResults(results);
        } catch (error) {
            console.error('Error searching technicians:', error);
            setGlobalSearchResults([]);
        } finally {
            setLoading(false);
        }
    }, [globalSearchQuery]);

    const handleClose = () => {
        setSelectedTechnician('');
        setAllocatedHours(String(job?.allocated_hours ?? ''));
        setSelectedSubtasks({});
        setShowGlobalSearch(false);
        setGlobalSearchQuery('');
        setGlobalSearchResults([]);
        setTemporaryAssignment({
            technicianId: null,
            duration_hours: 8,
            reason: '',
            showForm: false
        });
        onClose();
    };

    const handleTemporaryAssignment = async (technician, reason = null) => {
        try {
            setLoading(true);
            // Use provided reason or default to job assignment
            const assignmentReason = reason || temporaryAssignment.reason || `Assigned to job ${job?.job_number}`;
            
            console.log('Creating temporary assignment with:', {
                technicianId: technician._id || technician.id,
                duration_hours: temporaryAssignment.duration_hours,
                reason: assignmentReason
            });
            
            const result = await base44.entities.Technician.temporaryAssignment(
                technician._id || technician.id,
                temporaryAssignment.duration_hours,
                assignmentReason
            );
            
            const assignedTechnician = {
                ...result.technician,
                isTemporary: true,
                temporaryAssignment: result.technician.temporaryAssignment
            };
            
            // Add to available technicians list and select it
            setSelectedTechnician(assignedTechnician._id || assignedTechnician.id);
            setShowGlobalSearch(false);
            setTemporaryAssignment({
                technicianId: null,
                duration_hours: 8,
                reason: '',
                showForm: false
            });
        } catch (error) {
            console.error('Error creating temporary assignment:', error);
            alert('Failed to create temporary assignment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-add technician from global search to temporary list
    const handleGlobalTechnicianSelect = async (technician) => {
        if (technician.isTemporary) {
            // Auto-create temporary assignment for global technicians with default reason
            await handleTemporaryAssignment(technician, `Assigned to job ${job?.job_number}`);
        } else {
            // Regular technician from same workshop
            setSelectedTechnician(technician._id || technician.id);
            setShowGlobalSearch(false);
        }
    };

    const showTemporaryAssignmentForm = (technician) => {
        setTemporaryAssignment({
            technicianId: technician._id || technician.id,
            duration_hours: 8,
            reason: '',
            showForm: true,
            technician
        });
    };

    const cancelTemporaryAssignment = () => {
        setTemporaryAssignment({
            technicianId: null,
            duration_hours: 8,
            reason: '',
            showForm: false
        });
    };

    const handleSubmit = () => {
        if (!selectedTechnician) return;
        
        // Find technician in either local technicians or global search results
        let tech = (technicians || []).find((t) => t.id === selectedTechnician);
        if (!tech) {
            tech = globalSearchResults.find((t) => (t._id || t.id) === selectedTechnician);
        }

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
            subtask_allocations: selected,
            isTemporaryAssignment: tech?.isTemporary || false,
            temporaryAssignmentId: tech?.temporaryAssignment?.id || null
        });

        handleClose();
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-yellow-500" />
                            Add Technician to Job
                        </DialogTitle>
                        <DialogDescription>
                            Assign a technician to {job?.job_number} - {job?.description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-500">Job Number</p>
                            <p className="font-semibold">{job?.job_number}</p>
                            <p className="text-sm text-slate-600 mt-1">{job?.description}</p>
                        </div>

                        {/* Technician Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Technician</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowGlobalSearch(!showGlobalSearch)}
                                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                    <Search className="w-4 h-4 mr-1" />
                                    {showGlobalSearch ? 'Show My Technicians' : 'Global Search'}
                                </Button>
                            </div>

                            {!showGlobalSearch ? (
                                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select from your technicians" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allAvailableTechnicians.map((tech) => (
                                            <SelectItem key={tech.id || tech._id} value={tech.id || tech._id}>
                                                <div className="flex items-center gap-2">
                                                    <Users className={`w-3 h-3 ${tech.isTemporary ? 'text-orange-600' : 'text-green-600'}`} />
                                                    <span>{tech.name} {tech.employee_id && `(${tech.employee_id})`}</span>
                                                    {tech.isTemporary && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                                            From: {tech.originalSupervisor || tech.supervisor_key}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <Input
                                            placeholder="Search all technicians by name or ID..."
                                            value={globalSearchQuery}
                                            onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                            className="pl-10 border-blue-200"
                                        />
                                    </div>
                                    
                                    {globalSearchResults.length > 0 && (
                                        <div className="grid gap-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                                            {globalSearchResults.map(tech => (
                                                <div
                                                    key={tech._id}
                                                    className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 transition-colors cursor-pointer ${
                                                        tech.isTemporary ? 'border-orange-300 bg-orange-50' : 'border-slate-200'
                                                    }`}
                                                    onClick={() => handleGlobalTechnicianSelect(tech)}
                                                >
                                                    <User className={`w-4 h-4 ${tech.isTemporary ? 'text-orange-600' : 'text-blue-600'}`} />
                                                    <div className="flex-1">
                                                        <div className="font-medium flex items-center gap-2">
                                                            {tech.name}
                                                            {tech.isTemporary && (
                                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                                                    Temporary
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            {tech.employee_id || tech.employeeNumber} {tech.department && `· ${tech.department}`}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                            <Building className="w-3 h-3" />
                                                            <span>From: {tech.originalSupervisor || tech.supervisor_key}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGlobalTechnicianSelect(tech);
                                                            }}
                                                            className={`${tech.isTemporary ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                                                            disabled={loading}
                                                        >
                                                            {tech.isTemporary ? 'Add to My List' : 'Select'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
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

        {/* Temporary Assignment Dialog */}
        {temporaryAssignment.showForm && (
            <Dialog open={temporaryAssignment.showForm} onOpenChange={cancelTemporaryAssignment}>
                <DialogHeader>
                    <DialogTitle className="text-slate-800">Temporary Assignment</DialogTitle>
                    <DialogDescription>
                        Assign {temporaryAssignment.technician?.name} temporarily to your workshop for job {job?.job_number}
                    </DialogDescription>
                </DialogHeader>
                <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="w-4 h-4 text-orange-600" />
                                <h4 className="font-semibold text-orange-800">Technician Details</h4>
                            </div>
                            <div className="text-sm text-orange-700">
                                <div><strong>Name:</strong> {temporaryAssignment.technician?.name}</div>
                                <div><strong>ID:</strong> {temporaryAssignment.technician?.employee_id || temporaryAssignment.technician?.employeeNumber}</div>
                                <div><strong>Original Supervisor:</strong> {temporaryAssignment.technician?.originalSupervisor || temporaryAssignment.technician?.supervisor_key}</div>
                                <div><strong>Job:</strong> {job?.job_number} - {job?.description}</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration_hours">Duration (hours)</Label>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <Input
                                    id="duration_hours"
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={temporaryAssignment.duration_hours}
                                    onChange={(e) => setTemporaryAssignment(prev => ({
                                        ...prev,
                                        duration_hours: parseInt(e.target.value) || 8
                                    }))}
                                    placeholder="8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason for Assignment</Label>
                            <Input
                                id="reason"
                                value={temporaryAssignment.reason}
                                onChange={(e) => setTemporaryAssignment(prev => ({
                                    ...prev,
                                    reason: e.target.value
                                }))}
                                placeholder="e.g., Specialized task, Coverage, etc."
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={cancelTemporaryAssignment}
                                className="flex-1"
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleTemporaryAssignment(temporaryAssignment.technician)}
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                                disabled={loading}
                            >
                                {loading ? 'Assigning...' : 'Assign Temporarily'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )}
    </>
    );
}
