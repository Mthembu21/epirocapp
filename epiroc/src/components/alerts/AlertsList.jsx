import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Bell, X, CheckCircle } from 'lucide-react';

/**
 * AlertsList - Displays real-time alerts for supervisors/technicians
 * Types: Low utilization, Overloaded technician, Timeline exceeded
 */
export default function AlertsList({ 
  alerts = [], 
  onDismiss = () => {},
  isLoading = false,
  maxHeight = 'max-h-64'
}) {
  
  const [displayAlerts, setDisplayAlerts] = useState(alerts || []);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  useEffect(() => {
    setDisplayAlerts(alerts || []);
  }, [alerts]);

  const handleDismiss = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    onDismiss(alertId);
    setTimeout(() => {
      setDisplayAlerts(prev => prev.filter(a => a.id !== alertId));
    }, 300);
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Bell className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getAlertColor = (type) => {
    switch(type) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className={`${maxHeight} overflow-y-auto animate-pulse`}>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleAlerts = displayAlerts.filter(a => !dismissedAlerts.has(a.id));

  if (visibleAlerts.length === 0) {
    return (
      <Card className="border shadow-sm bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            All systems running smoothly - no active alerts
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Alerts & Notifications
          <Badge variant="secondary" className="ml-2">
            {visibleAlerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={`${maxHeight} overflow-y-auto`}>
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-3 flex items-start gap-3 ${getAlertColor(alert.type)} transition-opacity duration-300`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getAlertIcon(alert.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm line-clamp-1">
                    {alert.title}
                  </h4>
                  {alert.type === 'critical' && (
                    <Badge className="text-xs bg-red-600">Critical</Badge>
                  )}
                </div>
                
                <p className="text-sm mt-1 opacity-90 line-clamp-2">
                  {alert.message}
                </p>

                {alert.metadata && (
                  <div className="text-xs mt-2 space-y-1">
                    {Object.entries(alert.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between opacity-75">
                        <span className="font-semibold">{key}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {alert.timestamp && (
                  <p className="text-xs mt-2 opacity-75">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {alert.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => alert.action?.onClick?.()}
                  >
                    {alert.action.label}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDismiss(alert.id)}
                  title="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
