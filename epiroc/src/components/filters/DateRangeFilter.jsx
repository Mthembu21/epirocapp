import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Building2 } from 'lucide-react';

/**
 * DateRangeFilter - Allows selection of Daily/Weekly/Monthly views
 * With optional workshop and technician selectors
 */
export default function DateRangeFilter({ 
  selectedView = 'daily',
  onViewChange = () => {},
  workshopId = null,
  onWorkshopChange = () => {},
  technicianId = null,
  onTechnicianChange = () => {},
  workshops = [],
  technicians = [],
  compact = false
}) {
  
  const views = [
    { value: 'daily', label: 'Daily View', icon: '📅' },
    { value: 'weekly', label: 'Weekly View', icon: '📊' },
    { value: 'monthly', label: 'Monthly View', icon: '📈' }
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {views.map(view => (
          <Button
            key={view.value}
            size="sm"
            variant={selectedView === view.value ? 'default' : 'outline'}
            onClick={() => onViewChange(view.value)}
            className="text-xs"
          >
            {view.icon} {view.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Card className="border shadow-sm bg-white/95 backdrop-blur">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* View Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Time View
            </label>
            <div className="flex gap-2">
              {views.map(view => (
                <Button
                  key={view.value}
                  size="sm"
                  variant={selectedView === view.value ? 'default' : 'outline'}
                  onClick={() => onViewChange(view.value)}
                  title={view.label}
                >
                  {view.icon}
                </Button>
              ))}
            </div>
          </div>

          {/* Workshop Selector */}
          {workshops && workshops.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Workshop
              </label>
              <Select value={workshopId || ''} onValueChange={onWorkshopChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Workshops" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Workshops</SelectItem>
                  {workshops.map(workshop => (
                    <SelectItem key={workshop.id || workshop._id} value={workshop.id || workshop._id}>
                      {workshop.name || workshop.workshop_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Technician Selector */}
          {technicians && technicians.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Technician
              </label>
              <Select value={technicianId || ''} onValueChange={onTechnicianChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Technicians</SelectItem>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id || tech._id} value={tech.id || tech._id}>
                      {tech.name || tech.first_name} {tech.last_name || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Info */}
          <div className="flex items-end justify-end">
            <div className="text-sm text-slate-600 text-center">
              <p className="font-semibold">
                {selectedView === 'daily' ? 'Today' : selectedView === 'weekly' ? 'This Week' : 'This Month'}
              </p>
              <p className="text-xs text-slate-500">
                {workshopId ? '(Filtered)' : '(All Data)'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
