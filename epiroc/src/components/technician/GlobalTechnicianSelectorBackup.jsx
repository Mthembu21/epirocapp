import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Users, User, Clock, Building } from 'lucide-react';
import { base44 } from '@/api/apiClient';

// Add error boundary to catch and display errors
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('GlobalTechnicianSelector Error:', error, errorInfo);
        this.setState({ error });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 border border-red-500 bg-red-50 text-red-700 rounded">
                    <h3 className="font-bold">Something went wrong</h3>
                    <details>
                        <summary>Error details</summary>
                        <pre className="text-xs mt-2 whitespace-pre-wrap">
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                    <Button onClick={() => this.setState({ hasError: false, error: null })}>
                        Try again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Remove this export - only export the wrapped version
function GlobalTechnicianSelector({ 
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
    const [temporaryAssignment, setTemporaryAssignment] = useState({
        technicianId: null,
        duration_hours: 8,
        reason: '',
        showForm: false
    });
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

    const searchGlobalTechnicians = useCallback(async () => {
        try {
            setLoading(true);
            console.log('Searching for technicians with query:', searchQuery);
            
            // Add timeout to prevent infinite waiting
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Search timeout')), 5000); // 5 second timeout
            });
            
            const results = await Promise.race([
                base44.entities.Technician.search(searchQuery),
                timeoutPromise
            ]);
            
            console.log('Search results:', results);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching technicians:', error);
            // Show user-friendly error message
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    // Search global technicians with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery.trim()) {
                searchGlobalTechnicians();
            } else {
                setSearchResults([]);
            }
        }, 300); // 300ms delay
        
        return () => clearTimeout(timeoutId);
    }, [searchQuery, searchGlobalTechnicians]);

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
        setTemporaryAssignment({
            technicianId: null,
            duration_hours: 8,
            reason: '',
            showForm: false
        });
    };

    const handleTechnicianSelect = (technician) => {
        onTechnicianSelect(technician);
        setIsOpen(false);
        resetForm();
    };

    const handleTemporaryAssignment = async (technician) => {
        try {
            setLoading(true);
            const result = await base44.entities.Technician.temporaryAssignment(
                technician._id || technician.id,
                temporaryAssignment.duration_hours,
                temporaryAssignment.reason
            );
            
            // Add temporary assignment info to technician object
            const assignedTechnician = {
                ...result.technician,
                isTemporary: true,
                temporaryAssignment: result.technician.temporaryAssignment
            };
            
            onTechnicianSelect(assignedTechnician);
            setIsOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error creating temporary assignment:', error);
            alert('Failed to create temporary assignment: ' + error.message);
        } finally {
            setLoading(false);
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

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogHeader>
                    <DialogTitle className="text-slate-800">Select Technician</DialogTitle>
                    <DialogDescription>
                        Search for existing technicians, select from your assigned technicians, or create a new technician.
                    </DialogDescription>
                </DialogHeader>
                    
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
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
                                placeholder="Search by name or employee ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 border-blue-200"
                            />
                        </div>
                        
                        {searchResults.length > 0 && (
                            <div className="grid gap-2 mt-3 max-h-60 overflow-y-auto">
                                {searchResults.map(tech => (
                                    <div
                                        key={tech._id}
                                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        <User className="w-4 h-4 text-blue-600" />
                                        <div className="flex-1">
                                            <div className="font-medium">{tech.name}</div>
                                            <div className="text-sm text-slate-500">
                                                {tech.employee_id || tech.employeeNumber} • {tech.department}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                <Building className="w-3 h-3" />
                                                <span>Supervisor: {tech.originalSupervisor || tech.supervisor_key}</span>
                                                {tech.isTemporary && (
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                                        Other Supervisor
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {tech.isTemporary ? (
                                                <Button
                                                    size="sm"
                                                    onClick={() => showTemporaryAssignmentForm(tech)}
                                                    className="bg-orange-500 hover:bg-orange-600 text-white"
                                                    disabled={loading}
                                                >
                                                    <UserPlus className="w-3 h-3 mr-1" />
                                                    Assign Temporarily
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleTechnicianSelect(tech)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                                    disabled={loading}
                                                >
                                                    Select
                                                </Button>
                                            )}
                                        </div>
                                    </div>
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

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogHeader>
                    <DialogTitle className="text-slate-800">Select Technician</DialogTitle>
                    <DialogDescription>
                        Search for existing technicians, select from your assigned technicians, or create a new technician.
                    </DialogDescription>
                </DialogHeader>
                
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <div className="space-y-6 mt-4">
                        {/* My Technicians Section */}
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
                                                {tech.employee_id || tech.employeeNumber} {tech.department && `· ${tech.department}`}
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
                                    placeholder="Search by name or employee ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 border-blue-200"
                                />
                            </div>
                            
                            {searchResults.length > 0 && (
                                <div className="grid gap-2 mt-3 max-h-60 overflow-y-auto">
                                    {searchResults.map(tech => (
                                        <div
                                            key={tech._id}
                                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            <User className="w-4 h-4 text-blue-600" />
                                            <div className="flex-1">
                                                <div className="font-medium">{tech.name}</div>
                                                <div className="text-sm text-slate-500">
                                                    {tech.employee_id || tech.employeeNumber} • {tech.department}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                    <Building className="w-3 h-3" />
                                                    <span>Supervisor: {tech.originalSupervisor || tech.supervisor_key}</span>
                                                    {tech.isTemporary && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                                            Other Supervisor
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {tech.isTemporary ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => showTemporaryAssignmentForm(tech)}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white"
                                                        disabled={loading}
                                                    >
                                                        <UserPlus className="w-3 h-3 mr-1" />
                                                        Assign Temporarily
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleTechnicianSelect(tech)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white"
                                                        disabled={loading}
                                                    >
                                                        Select
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
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
            <TemporaryAssignmentDialog />
        </>
    );
}

// Wrap the component with ErrorBoundary
const GlobalTechnicianSelectorWithErrorBoundary = (props) => (
    <ErrorBoundary>
        <GlobalTechnicianSelector {...props} />
    </ErrorBoundary>
);

export default GlobalTechnicianSelectorWithErrorBoundary;
