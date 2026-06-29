import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';

export default function LeaveBooking({ technicians = [], onSuccess }) {
  const [formData, setFormData] = useState({
    technician_id: '',
    date: '',
    type: 'leave',
    notes: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = formData.type === 'leave' ? '/api/attendance/leave' : '/api/attendance/sick';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: formData.technician_id,
          date: new Date(formData.date).toISOString(),
          notes: formData.notes
        })
      });

      if (response.ok) {
        setStatus({ type: 'success', message: 'Record created successfully' });
        setFormData({ technician_id: '', date: '', type: 'leave', notes: '' });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          setStatus(null);
        }, 2000);
      } else {
        const error = await response.json();
        setStatus({ type: 'error', message: error.error || 'Failed to create record' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return format(tomorrow, 'yyyy-MM-dd');
  };

  return (
    <Card className="border-0 shadow-lg bg-white/95">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
          <Calendar className="w-5 h-5 text-blue-500" />
          Book Leave / Sick Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Technician</label>
              <Select
                value={formData.technician_id}
                onValueChange={(v) => setFormData({ ...formData, technician_id: v })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech._id} value={tech._id}>
                      {tech.name} ({tech.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={getMinDate()}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="sick">Sick Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional: Reason or additional details"
              disabled={loading}
              rows={3}
            />
          </div>

          {status && (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${
              status.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${status.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {status.message}
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !formData.technician_id || !formData.date}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Booking...
              </>
            ) : (
              'Book Record'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
