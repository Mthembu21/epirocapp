import React, { useState } from 'react';
import { base44 } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, User, Shield, AlertCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function WorkshopLogin() {
    const [techForm, setTechForm] = useState({ name: '', employee_id: '' });
    const [supervisorCode, setSupervisorCode] = useState('');
    const [error, setError] = useState('');

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => base44.entities.Technician.list()
    });

    const handleTechnicianLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const result = await base44.auth.technicianLogin(techForm.name, techForm.employee_id);
            localStorage.setItem('epiroc_user', JSON.stringify(result.user));
            window.location.href = createPageUrl('TechnicianPortal');
        } catch (err) {
            setError('Invalid name or employee ID. Please try again.');
        }
    };

    const handleSupervisorLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const result = await base44.auth.supervisorLogin(supervisorCode);
            localStorage.setItem('epiroc_user', JSON.stringify({ ...result.user, code: supervisorCode }));
            window.location.href = createPageUrl('Dashboard');
        } catch (err) {
            setError('Invalid supervisor code.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="bg-yellow-400 p-3 rounded-xl">
                            <Wrench className="w-10 h-10 text-slate-800" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-yellow-400 tracking-tight">EPIROC</h1>
                    <p className="text-slate-400 text-sm tracking-widest mt-1">WORKSHOP LABOUR MANAGEMENT</p>
                </div>

                <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-center text-slate-800">Sign In</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="technician" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="technician" className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Technician
                                </TabsTrigger>
                                <TabsTrigger value="supervisor" className="flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Supervisor
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="technician">
                                <form onSubmit={handleTechnicianLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tech-name">Full Name</Label>
                                        <Input
                                            id="tech-name"
                                            placeholder="Enter your name"
                                            value={techForm.name}
                                            onChange={(e) => setTechForm(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                            className="border-slate-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tech-id">Employee ID (Password)</Label>
                                        <Input
                                            id="tech-id"
                                            type="password"
                                            placeholder="Enter your employee ID"
                                            value={techForm.employee_id}
                                            onChange={(e) => setTechForm(prev => ({ ...prev, employee_id: e.target.value }))}
                                            required
                                            className="border-slate-300"
                                        />
                                    </div>
                                    
                                    {error && (
                                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                            <AlertCircle className="w-4 h-4" />
                                            {error}
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800 font-semibold">
                                        Sign In as Technician
                                    </Button>
                                </form>
                            </TabsContent>

                            <TabsContent value="supervisor">
                                <form onSubmit={handleSupervisorLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="supervisor-code">Supervisor Access Code</Label>
                                        <Input
                                            id="supervisor-code"
                                            type="password"
                                            placeholder="Enter supervisor code"
                                            value={supervisorCode}
                                            onChange={(e) => setSupervisorCode(e.target.value)}
                                            required
                                            className="border-slate-300"
                                        />
                                    </div>

                                    {error && (
                                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                            <AlertCircle className="w-4 h-4" />
                                            {error}
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold">
                                        Sign In as Supervisor
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <p className="text-center text-slate-500 text-sm mt-6">
                    © {new Date().getFullYear()} Epiroc Workshop Management
                </p>
            </div>
        </div>
    );
}