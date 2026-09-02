import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Ban, ShieldCheck, User } from 'lucide-react';

// Lets a supervisor put a hold on one technician's ability to book hours on this
// job (with a required reason), or lift a hold already in place. This is scoped
// to a single technician on a single job - it does not pause the job for anyone
// else assigned to it.
export default function JobBlockTechnicianModal({ job, isOpen, onClose, onBlock, onUnblock, isLoading }) {
    const [reasonDraftByTech, setReasonDraftByTech] = useState({});
    const [composingTechId, setComposingTechId] = useState(null);

    const handleClose = () => {
        setReasonDraftByTech({});
        setComposingTechId(null);
        onClose();
    };

    const assignedTechnicians = job?.technicians || [];

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ban className="w-5 h-5 text-red-500" />
                        Block Booking Access
                    </DialogTitle>
                    <DialogDescription>
                        Prevent a technician from logging further hours on {job?.job_number} - {job?.description}. They'll still see the job; they just can't book time to it until you lift the hold.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {assignedTechnicians.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">No technicians assigned to this job.</p>
                    ) : (
                        assignedTechnicians.map((t) => {
                            const techId = String(t.technician_id);
                            const isComposing = composingTechId === techId;
                            const reasonDraft = reasonDraftByTech[techId] || '';

                            return (
                                <div key={techId} className="rounded-lg border border-slate-200 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <span className="font-medium text-slate-800 truncate">{t.technician_name}</span>
                                        </div>
                                        {t.booking_blocked ? (
                                            <Badge className="bg-red-100 text-red-700 flex-shrink-0">Blocked</Badge>
                                        ) : (
                                            <Badge className="bg-green-100 text-green-700 flex-shrink-0">Can book</Badge>
                                        )}
                                    </div>

                                    {t.booking_blocked && (
                                        <p className="text-xs text-slate-500 mt-1.5 pl-6">"{t.block_reason}"</p>
                                    )}

                                    <div className="mt-2 pl-6">
                                        {t.booking_blocked ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-green-300 text-green-700 hover:bg-green-50"
                                                disabled={isLoading}
                                                onClick={() => onUnblock({ jobNumber: job.job_number, technicianId: techId })}
                                            >
                                                <ShieldCheck className="w-4 h-4 mr-1.5" />
                                                Lift block
                                            </Button>
                                        ) : isComposing ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    autoFocus
                                                    className="min-h-16 text-sm"
                                                    placeholder="Why is this technician being blocked from booking? (required)"
                                                    value={reasonDraft}
                                                    onChange={(e) => setReasonDraftByTech((prev) => ({ ...prev, [techId]: e.target.value }))}
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setComposingTechId(null)}
                                                        disabled={isLoading}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="bg-red-500 hover:bg-red-600 text-white"
                                                        disabled={isLoading || !reasonDraft.trim()}
                                                        onClick={() => {
                                                            onBlock({ jobNumber: job.job_number, technicianId: techId, reason: reasonDraft.trim() });
                                                            setComposingTechId(null);
                                                        }}
                                                    >
                                                        Confirm block
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                disabled={isLoading}
                                                onClick={() => setComposingTechId(techId)}
                                            >
                                                <Ban className="w-4 h-4 mr-1.5" />
                                                Block from booking
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
