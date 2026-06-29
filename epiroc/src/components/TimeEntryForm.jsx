/*
  ⚠️ DUPLICATE COMPONENT - Commented Out
  This component duplicates functionality already in TimesheetForm.jsx
  Location: src/components/timesheet/TimesheetForm.jsx
  
  To restore: uncomment below
*/

/*
import React, { useState } from 'react';
import '../styles/TimeEntryForm.css';

const TimeEntryForm = ({ onSubmit, jobId }) => {
  const [formData, setFormData] = useState({
    job_id: jobId || '',
    entry_type: 'productive', // productive, non_productive, idle
    hours: 0.5,
    description: '',
    date: new Date().toISOString().split('T')[0],
    pauseReason: '',
    isPaused: false
  });

  const [recentEntries, setRecentEntries] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/time-entry/log-productive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Add to recent entries
        setRecentEntries(prev => [
          { ...formData, timestamp: new Date().toLocaleTimeString() },
          ...prev
        ].slice(0, 5));

        // Reset form
        setFormData({
          ...formData,
          hours: 0.5,
          description: '',
          pauseReason: ''
        });

        alert('Time entry logged successfully!');
        if (onSubmit) onSubmit(result);
      } else {
        alert('Failed to log time entry');
      }
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="time-entry-container">
      <div className="time-entry-form">
        <h2>📝 Log Time Entry</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="job_id">Job ID *</label>
            <input
              type="text"
              id="job_id"
              name="job_id"
              value={formData.job_id}
              onChange={handleChange}
              placeholder="Enter job ID"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="entry_type">Entry Type *</label>
            <select
              id="entry_type"
              name="entry_type"
              value={formData.entry_type}
              onChange={handleChange}
            >
              <option value="productive">✅ Productive Work</option>
              <option value="non_productive">⏸️ Non-Productive (Training, Admin)</option>
              <option value="idle">😴 Idle Time</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="hours">Hours *</label>
            <input
              type="number"
              id="hours"
              name="hours"
              value={formData.hours}
              onChange={handleChange}
              min="0.25"
              step="0.25"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add notes about this work"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="isPaused"
              name="isPaused"
              checked={formData.isPaused}
              onChange={handleChange}
            />
            <label htmlFor="isPaused">Mark as Paused Job?</label>
          </div>

          {formData.isPaused && (
            <div className="form-group">
              <label htmlFor="pauseReason">Pause Reason *</label>
              <select
                id="pauseReason"
                name="pauseReason"
                value={formData.pauseReason}
                onChange={handleChange}
                required
              >
                <option value="">Select reason...</option>
                <option value="waiting_parts">Waiting for Parts</option>
                <option value="customer_delay">Customer Delay</option>
                <option value="equipment_issue">Equipment Issue</option>
                <option value="weather">Weather</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-submit">
            ✓ Log Time Entry
          </button>
        </form>
      </div>

      {recentEntries.length > 0 && (
        <div className="recent-entries">
          <h3>📋 Recent Entries</h3>
          <div className="entries-list">
            {recentEntries.map((entry, idx) => (
              <div key={idx} className="entry-item">
                <span className="entry-type">{entry.entry_type}</span>
                <span className="entry-hours">{entry.hours}h</span>
                <span className="entry-time">{entry.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeEntryForm;
*/

// ⚠️ DUPLICATE FILE - DO NOT USE
// Use src/components/timesheet/TimesheetForm.jsx instead
