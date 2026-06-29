/*
  ⚠️ DUPLICATE COMPONENT - Commented Out
  This component duplicates at-risk job logic already in AtRiskJobs.jsx
  Location: src/components/jobs/AtRiskJobs.jsx
  
  To restore: uncomment below
*/

/*
import React, { useState, useEffect } from 'react';
import '../styles/JobsAtRiskTable.css';

const JobsAtRiskTable = ({ supervisorKey }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, green, orange, red
  const [sortBy, setSortBy] = useState('risk_score');

  useEffect(() => {
    fetchJobsAtRisk();
  }, [supervisorKey]);

  const fetchJobsAtRisk = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/at-risk?supervisor_key=${supervisorKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs at risk:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (status) => {
    switch(status) {
      case 'green': return 'risk-green';
      case 'orange': return 'risk-orange';
      case 'red': return 'risk-red';
      default: return 'risk-gray';
    }
  };

  const getRiskIcon = (status) => {
    switch(status) {
      case 'green': return '✅';
      case 'orange': return '⚠️';
      case 'red': return '🔴';
      default: return '•';
    }
  };

  const getComplexityIcon = (complexity) => {
    switch(complexity) {
      case 'Low': return '🟢';
      case 'Medium': return '🟡';
      case 'High': return '🟠';
      case 'Critical': return '🔴';
      default: return '•';
    }
  };

  let filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.risk_status === filter;
  });

  filteredJobs.sort((a, b) => {
    if (sortBy === 'risk_score') {
      return b.risk_score - a.risk_score;
    } else if (sortBy === 'days_remaining') {
      return a.days_remaining - b.days_remaining;
    } else if (sortBy === 'efficiency') {
      return a.efficiency_percentage - b.efficiency_percentage;
    }
    return 0;
  });

  if (loading) {
    return <div className="loading">Loading jobs at risk...</div>;
  }

  return (
    <div className="jobs-at-risk-container">
      <div className="jobs-header">
        <h2>⚠️ Jobs at Risk</h2>
        <p className="job-count">Total: {filteredJobs.length} jobs</p>
      </div>

      <div className="controls">
        <div className="filter-group">
          <label>Filter by Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Jobs</option>
            <option value="green">✅ Green (On Track)</option>
            <option value="orange">⚠️ Orange (At Risk)</option>
            <option value="red">🔴 Red (Critical)</option>
          </select>
        </div>

        <div className="sort-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="risk_score">Risk Score</option>
            <option value="days_remaining">Days Remaining</option>
            <option value="efficiency">Efficiency %</option>
          </select>
        </div>

        <button onClick={fetchJobsAtRisk} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      <div className="jobs-table-wrapper">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Job #</th>
              <th>Description</th>
              <th>Complexity</th>
              <th>Allocated Hours</th>
              <th>Consumed Hours</th>
              <th>Efficiency %</th>
              <th>Days Remaining</th>
              <th>Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <tr key={job._id} className={`job-row ${getRiskColor(job.risk_status)}`}>
                  <td className="status-cell">
                    <span className="status-badge">{getRiskIcon(job.risk_status)}</span>
                  </td>
                  <td className="job-number">{job.job_number}</td>
                  <td className="job-description">{job.description}</td>
                  <td className="complexity">
                    {getComplexityIcon(job.complexity_category)} {job.complexity_category}
                  </td>
                  <td className="allocated-hours">{job.allocated_hours}h</td>
                  <td className="consumed-hours">{job.consumed_hours}h</td>
                  <td className="efficiency">
                    <div className="efficiency-bar">
                      <div className="efficiency-fill" 
                        style={{width: `${Math.min(job.efficiency_percentage, 100)}%`}}>
                      </div>
                    </div>
                    {job.efficiency_percentage.toFixed(1)}%
                  </td>
                  <td className="days-remaining">
                    {job.days_remaining > 0 ? (
                      <span className="positive">{job.days_remaining} days</span>
                    ) : (
                      <span className="negative">Overdue</span>
                    )}
                  </td>
                  <td className="risk-score">
                    <span className={`score ${job.risk_status}`}>
                      {job.risk_score.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">No jobs found for selected filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="risk-legend">
        <p><span className="legend-green">✅</span> Green: On track, no concerns</p>
        <p><span className="legend-orange">⚠️</span> Orange: Approaching deadline or high consumption</p>
        <p><span className="legend-red">🔴</span> Red: Critical - likely overdue or at capacity</p>
      </div>
    </div>
  );
};

export default JobsAtRiskTable;
*/

// ⚠️ DUPLICATE FILE - DO NOT USE
// Use src/components/jobs/AtRiskJobs.jsx instead
