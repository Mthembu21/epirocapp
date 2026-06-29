/*
  ⚠️ DUPLICATE COMPONENT - Commented Out
  This component duplicates pause/resume logic in DowntimeControls.jsx
  Location: src/components/downtime/DowntimeControls.jsx
  
  To restore: uncomment below
*/

/*
import React, { useState } from 'react';
import '../styles/PauseResumeWidget.css';

const PauseResumeWidget = ({ jobId, onPauseResume }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [pauseData, setPauseData] = useState({
    reason: '',
    description: '',
    pauseTime: null
  });
  const [downtime, setDowntime] = useState(0);

  const handlePause = async () => {
    try {
      const response = await fetch(`/api/job/${jobId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reason: pauseData.reason,
          description: pauseData.description
        })
      });

      if (response.ok) {
        setIsPaused(true);
        setPauseData({
          ...pauseData,
          pauseTime: new Date()
        });
        alert('Job paused successfully');
        if (onPauseResume) onPauseResume({ action: 'pause', jobId });
      }
    } catch (error) {
      console.error('Error pausing job:', error);
    }
  };

  const handleResume = async () => {
    try {
      const response = await fetch(`/api/job/${jobId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const downtimeMins = Math.round(
          (new Date() - pauseData.pauseTime) / (1000 * 60)
        );
        setDowntime(downtimeMins);
        setIsPaused(false);
        alert(`Job resumed. Downtime: ${downtimeMins} minutes`);
        if (onPauseResume) onPauseResume({ 
          action: 'resume', 
          jobId, 
          downtimeMinutes: downtimeMins 
        });
      }
    } catch (error) {
      console.error('Error resuming job:', error);
    }
  };

  return (
    <div className="pause-resume-widget">
      <h3>⏸️ Pause / Resume Job</h3>

      {!isPaused ? (
        <div className="pause-controls">
          <select
            value={pauseData.reason}
            onChange={(e) => setPauseData({ ...pauseData, reason: e.target.value })}
            className="pause-reason-select"
          >
            <option value="">Select pause reason...</option>
            <option value="waiting_parts">Waiting for Parts</option>
            <option value="customer_delay">Customer Delay</option>
            <option value="equipment_issue">Equipment Issue</option>
            <option value="weather">Weather</option>
            <option value="break">Break</option>
            <option value="other">Other</option>
          </select>

          <textarea
            value={pauseData.description}
            onChange={(e) => setPauseData({ ...pauseData, description: e.target.value })}
            placeholder="Add description..."
            rows="2"
          />

          <button 
            onClick={handlePause}
            className="btn-pause"
            disabled={!pauseData.reason}
          >
            ⏸️ Pause Job
          </button>
        </div>
      ) : (
        <div className="resume-controls">
          <div className="pause-info">
            <p className="pause-reason">Reason: {pauseData.reason}</p>
            <p className="pause-time">
              Paused: {pauseData.pauseTime?.toLocaleTimeString()}
            </p>
          </div>
          <button 
            onClick={handleResume}
            className="btn-resume"
          >
            ▶️ Resume Job
          </button>
        </div>
      )}

      {downtime > 0 && (
        <div className="downtime-info">
          <p>✓ Job resumed</p>
          <p className="downtime-hours">Downtime: {(downtime / 60).toFixed(2)} hours</p>
          <p className="downtime-note">Note: This does NOT reduce allocated hours</p>
        </div>
      )}
    </div>
  );
};

export default PauseResumeWidget;
*/

// ⚠️ DUPLICATE FILE - DO NOT USE
// Use src/components/downtime/DowntimeControls.jsx instead
