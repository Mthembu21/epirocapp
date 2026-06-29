/*
  ⚠️ DUPLICATE COMPONENT - Commented Out
  This component duplicates KPI display logic already in existing dashboards
  
  To restore: uncomment below
*/

/*
import React from 'react';
import '../styles/KPICard.css';

const KPICard = ({
  title, 
  value, 
  unit = '%', 
  target = 85, 
  status = 'green',
  icon = '📊',
  trend = null 
}) => {
  // Determine status color based on value vs target
  let statusClass = 'status-green';
  if (value < target - 15) {
    statusClass = 'status-red';
  } else if (value < target) {
    statusClass = 'status-orange';
  }

  return (
    <div className={`kpi-card ${statusClass}`}>
      <div className="kpi-header">
        <span className="kpi-icon">{icon}</span>
        <h3 className="kpi-title">{title}</h3>
      </div>
      
      <div className="kpi-value">
        <span className="value">{value.toFixed(1)}</span>
        <span className="unit">{unit}</span>
      </div>

      <div className="kpi-details">
        <p className="target">Target: {target}{unit}</p>
        {trend && <p className="trend">{trend}</p>}
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

export default KPICard;
*/

// ⚠️ DUPLICATE FILE - DO NOT USE
