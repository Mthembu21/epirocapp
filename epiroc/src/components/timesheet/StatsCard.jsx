import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "yellow" }) {
    const colorClasses = {
        yellow: "from-yellow-400 to-yellow-500",
        green: "from-green-500 to-green-600",
        amber: "from-amber-500 to-amber-600",
        slate: "from-slate-700 to-slate-800",
        blue: "from-blue-500 to-blue-600",
        red: "from-red-500 to-red-600"
    };

    return (
        <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${colorClasses[color]} p-5 text-white`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-white/80">{title}</p>
                            <p className="text-3xl font-bold mt-1">{value}</p>
                            {subtitle && (
                                <p className="text-sm text-white/70 mt-1">{subtitle}</p>
                            )}
                        </div>
                        {Icon && (
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Icon className="w-6 h-6" />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}