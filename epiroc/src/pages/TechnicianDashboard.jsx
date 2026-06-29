/*
  ⚠️ DEPRECATED - Use TechnicianPortal.jsx instead
  This file was created as a duplicate and is now commented out.
  All functionality exists in: src/pages/TechnicianPortal.jsx
  
  To restore: uncomment the code below and import in App.jsx
*/

/*
import React, { useState, useEffect } from 'react';
import KPICard from '../components/KPICard';
import TimeEntryForm from '../components/TimeEntryForm';
import PauseResumeWidget from '../components/PauseResumeWidget';
import TrainingForm from '../components/TrainingForm';
import JobsAtRiskTable from '../components/JobsAtRiskTable';
import '../styles/TechnicianDashboard.css';

const TechnicianDashboard = () => {
  const [kpis, setKpis] = useState({
    utilization: 0,
    productivity: 0,
    efficiency: 0,
    non_productive: 0,
    idle: 0,
    training_hours: 0,
    leave_days: 0,
    sick_days: 0
  });

  const [assignedJobs, setAssignedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [alerts, setAlerts] = useState([]);

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
      const technicianId = localStorage.getItem('technician_id');

      // Fetch KPIs
      const kpiResponse = await fetch(`/api/kpi/technician/${technicianId}/day/${new Date().toISOString().split('T')[0]}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (kpiResponse.ok) {
        const kpiData = await kpiResponse.json();
        setKpis(kpiData.kpis || kpis);
      }

      // Fetch assigned jobs
      const jobsResponse = await fetch(`/api/jobs/active?technician_id=${technicianId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setAssignedJobs(jobsData.jobs || []);
        if (jobsData.jobs?.length > 0 && !selectedJobId) {
          setSelectedJobId(jobsData.jobs[0]._id);
        }
      }

      // Fetch alerts
      const alertsResponse = await fetch(`/api/alerts/technician/${technicianId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading your dashboard...</div>;
  }

  return (
    <div className="technician-dashboard">
      <header className="dashboard-header">
        <h1>👨‍🔧 Technician Dashboard</h1>
        <p>Welcome! Here's your daily overview</p>
      </header>

      {/* Alerts Widget */}
      {alerts.length > 0 && (
        <div className="alerts-widget">
          <h3>🚨 Important Alerts</h3>
          <div className="alerts-list">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`alert alert-${alert.severity}`}>
                <span className="alert-icon">
                  {alert.severity === 'critical' ? '🔴' : '⚠️'}
                </span>
                <span className="alert-message">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <section className="kpi-section">
        <h2>📊 Your KPIs (Today)</h2>
        <div className="kpi-grid">
          <KPICard 
            title="Utilization" 
            value={kpis.utilization} 
            target={85}
            icon="⚙️"
          />
          <KPICard 
            title="Productivity" 
            value={kpis.productivity} 
            target={70}
            icon="🎯"
          />
          <KPICard 
            title="Efficiency" 
            value={kpis.efficiency} 
            target={85}
            icon="⚡"
          />
          <KPICard 
            title="Non-Productive" 
            value={kpis.non_productive} 
            unit="hours"
            target={2}
            icon="⏸️"
          />
          <KPICard 
            title="Idle Time" 
            value={kpis.idle} 
            unit="hours"
            target={1}
            icon="😴"
          />
          <KPICard 
            title="Training Hours" 
            value={kpis.training_hours} 
            unit="hours"
            target={5}
            icon="🎓"
          />
          <KPICard 
            title="Leave Days" 
            value={kpis.leave_days} 
            unit="days"
            target={0}
            icon="🏖️"
          />
          <KPICard 
            title="Sick Days" 
            value={kpis.sick_days} 
            unit="days"
            target={0}
            icon="🏥"
          />
        </div>
      </section>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📋 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'time-entry' ? 'active' : ''}`}
          onClick={() => setActiveTab('time-entry')}
        >
          ⏱️ Log Time
        </button>
        <button 
          className={`tab-button ${activeTab === 'pause-resume' ? 'active' : ''}`}
          onClick={() => setActiveTab('pause-resume')}
        >
          ⏸️ Pause/Resume
        </button>
        <button 
          className={`tab-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          🎓 Training
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <section className="overview-section">
            <h2>📌 Your Assigned Jobs</h2>
            {assignedJobs.length > 0 ? (
              <div className="jobs-list">
                {assignedJobs.map((job) => (
                  <div key={job._id} className="job-card">
                    <div className="job-header">
                      <h3>{job.job_number}</h3>
                      <span className={`job-status ${job.status}`}>
                        {job.status === 'active' ? '🟢 Active' : '⏸️ Paused'}
                      </span>
                    </div>
                    <p className="job-description">{job.description}</p>
                    <div className="job-details">
                      <span>
                        Allocated: {job.allocated_hours}h | 
                        Consumed: {job.consumed_hours}h
                      </span>
                      <span>
                        Target: {new Date(job.target_completion_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="job-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{width: `${(job.consumed_hours / job.allocated_hours) * 100}%`}}
                        ></div>
                      </div>
                      <span className="progress-text">
                        {((job.consumed_hours / job.allocated_hours) * 100).toFixed(0)}% Complete
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-jobs">No assigned jobs at this time</div>
            )}
          </section>
        )}

        {activeTab === 'time-entry' && (
          <section className="time-entry-section">
            <TimeEntryForm jobId={selectedJobId} onSubmit={fetchDashboardData} />
          </section>
        )}

        {activeTab === 'pause-resume' && (
          <section className="pause-resume-section">
            {assignedJobs.length > 0 ? (
              <>
                <div className="job-selector">
                  <label htmlFor="job-select">Select Job to Pause/Resume:</label>
                  <select 
                    id="job-select"
                    value={selectedJobId} 
                    onChange={(e) => setSelectedJobId(e.target.value)}
                  >
                    <option value="">-- Select Job --</option>
                    {assignedJobs.map(job => (
                      <option key={job._id} value={job._id}>
                        {job.job_number} - {job.description}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedJobId && (
                  <PauseResumeWidget 
                    jobId={selectedJobId} 
                    onPauseResume={fetchDashboardData}
                  />
                )}
              </>
            ) : (
              <div className="no-jobs">No assigned jobs to pause/resume</div>
            )}
          </section>
        )}

        {activeTab === 'training' && (
          <section className="training-section">
            <TrainingForm onSubmit={fetchDashboardData} />
          </section>
        )}
      </div>

      {/* Jobs at Risk Widget */}
      <section className="at-risk-section">
        <JobsAtRiskTable supervisorKey={localStorage.getItem('supervisor_key')} />
      </section>
    </div>
  );
};

export default TechnicianDashboard;
*/

// ⚠️ DEPRECATED FILE - DO NOT USE
// Use TechnicianPortal.jsx instead
