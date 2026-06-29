/*
  ⚠️ DEPRECATED - Use Dashboard.jsx instead
  This file was created as a duplicate and is now commented out.
  All functionality exists in: src/pages/Dashboard.jsx
  
  To restore: uncomment the code below and import in App.jsx
*/

/*
import React, { useState, useEffect } from 'react';
import KPICard from '../components/KPICard';
import JobsAtRiskTable from '../components/JobsAtRiskTable';
import '../styles/SupervisorDashboard.css';

const SupervisorDashboard = () => {
  const [kpis, setKpis] = useState({
    productive_percent: 0,
    non_productive_percent: 0,
    idle_percent: 0,
    efficiency_percent: 0,
    availability_percent: 0,
    utilization_percent: 0,
    active_jobs: 0,
    completed_jobs: 0,
    jobs_at_risk: 0,
    overtime_hours: 0
  });

  const [alerts, setAlerts] = useState([]);
  const [complexityDistribution, setComplexityDistribution] = useState({
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  });

  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState('daily'); // daily, weekly, monthly
  const [supervisorKey] = useState(localStorage.getItem('supervisor_key'));

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch dashboard KPIs
      const kpiResponse = await fetch(`/api/kpi/dashboard/overview?supervisor_key=${supervisorKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (kpiResponse.ok) {
        const kpiData = await kpiResponse.json();
        setKpis(kpiData.kpis || kpis);
      }

      // Fetch alerts
      const alertsResponse = await fetch(`/api/alerts/supervisor/${supervisorKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);
      }

      // Fetch complexity distribution
      const complexityResponse = await fetch(`/api/jobs/complexity-distribution?supervisor_key=${supervisorKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (complexityResponse.ok) {
        const complexityData = await complexityResponse.json();
        setComplexityDistribution(complexityData.distribution || complexityDistribution);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading supervisor dashboard...</div>;
  }

  const totalComplexity = Object.values(complexityDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="supervisor-dashboard">
      <header className="dashboard-header">
        <h1>👨‍💼 Supervisor Dashboard</h1>
        <p>Team Overview & Performance Metrics</p>
      </header>

      {/* Filter View */}
      <div className="view-filter">
        <label>View Period:</label>
        <select value={filterView} onChange={(e) => setFilterView(e.target.value)}>
          <option value="daily">📅 Daily</option>
          <option value="weekly">📊 Weekly</option>
          <option value="monthly">📈 Monthly</option>
        </select>
      </div>

      {/* Alerts Widget */}
      {alerts.length > 0 && (
        <div className="alerts-widget">
          <h3>🚨 Team Alerts ({alerts.length})</h3>
          <div className="alerts-list">
            {alerts.slice(0, 5).map((alert, idx) => (
              <div key={idx} className={`alert alert-${alert.severity}`}>
                <span className="alert-icon">
                  {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div className="alert-details">
                  <span className="alert-title">{alert.title}</span>
                  <span className="alert-message">{alert.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="kpi-section">
        <h2>📊 Team KPIs</h2>
        <div className="kpi-grid-large">
          <KPICard 
            title="Productive %" 
            value={kpis.productive_percent} 
            target={70}
            icon="✅"
          />
          <KPICard 
            title="Non-Productive %" 
            value={kpis.non_productive_percent} 
            target={20}
            icon="⏸️"
          />
          <KPICard 
            title="Idle %" 
            value={kpis.idle_percent} 
            target={10}
            icon="😴"
          />
          <KPICard 
            title="Efficiency %" 
            value={kpis.efficiency_percent} 
            target={85}
            icon="⚡"
          />
          <KPICard 
            title="Availability %" 
            value={kpis.availability_percent} 
            target={90}
            icon="✓"
          />
          <KPICard 
            title="Utilization %" 
            value={kpis.utilization_percent} 
            target={85}
            icon="⚙️"
          />
          <KPICard 
            title="Active Jobs" 
            value={kpis.active_jobs} 
            unit="jobs"
            target={20}
            icon="🎯"
          />
          <KPICard 
            title="Completed Jobs" 
            value={kpis.completed_jobs} 
            unit="jobs"
            target={10}
            icon="✔️"
          />
          <KPICard 
            title="Jobs at Risk" 
            value={kpis.jobs_at_risk} 
            unit="jobs"
            target={0}
            icon="⚠️"
          />
          <KPICard 
            title="Overtime Hours" 
            value={kpis.overtime_hours} 
            unit="hours"
            target={10}
            icon="⏱️"
          />
        </div>
      </section>

      {/* Complexity Distribution Chart */}
      <section className="complexity-section">
        <h2>📈 Job Complexity Distribution</h2>
        <div className="complexity-chart">
          <div className="complexity-bars">
            <div className="complexity-bar-group">
              <div className="bar-container">
                <div className="bar low" style={{height: `${(complexityDistribution.low / totalComplexity) * 100 || 0}%`}}></div>
              </div>
              <label>Low ({complexityDistribution.low})</label>
            </div>
            <div className="complexity-bar-group">
              <div className="bar-container">
                <div className="bar medium" style={{height: `${(complexityDistribution.medium / totalComplexity) * 100 || 0}%`}}></div>
              </div>
              <label>Medium ({complexityDistribution.medium})</label>
            </div>
            <div className="complexity-bar-group">
              <div className="bar-container">
                <div className="bar high" style={{height: `${(complexityDistribution.high / totalComplexity) * 100 || 0}%`}}></div>
              </div>
              <label>High ({complexityDistribution.high})</label>
            </div>
            <div className="complexity-bar-group">
              <div className="bar-container">
                <div className="bar critical" style={{height: `${(complexityDistribution.critical / totalComplexity) * 100 || 0}%`}}></div>
              </div>
              <label>Critical ({complexityDistribution.critical})</label>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs at Risk Table */}
      <section className="jobs-at-risk-section">
        <JobsAtRiskTable supervisorKey={supervisorKey} />
      </section>

      {/* Quick Stats */}
      <section className="quick-stats">
        <h3>📋 Quick Stats</h3>
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Total Jobs</span>
            <span className="stat-value">{kpis.active_jobs + kpis.completed_jobs}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">
              {((kpis.completed_jobs / (kpis.active_jobs + kpis.completed_jobs)) * 100 || 0).toFixed(0)}%
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">At-Risk Ratio</span>
            <span className="stat-value">
              {((kpis.jobs_at_risk / (kpis.active_jobs + kpis.completed_jobs)) * 100 || 0).toFixed(0)}%
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Overtime This Month</span>
            <span className="stat-value">{kpis.overtime_hours}h</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SupervisorDashboard;
*/

// ⚠️ DEPRECATED FILE - DO NOT USE
// Use Dashboard.jsx instead
