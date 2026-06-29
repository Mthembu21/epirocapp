import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';
import '../styles/TrainingForm.css';

const TrainingForm = ({ onSubmit, supervisorKey }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    // Technician note (requested): specific details about what training they did
    note: '',
    hours: 1,
    category: 'technical',
    date: new Date().toISOString().split('T')[0],
    instructor: '',
    competency_level: 'intermediate'
  });


  const [trainingLog, setTrainingLog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const user = JSON.parse(localStorage.getItem('epiroc_user') || '{}');
      const technicianId = user.id || user.employee_id;

      if (!supervisorKey) {
        throw new Error('Supervisor key is required');
      }

      if (!technicianId) {
        throw new Error('Technician ID is required');
      }

      const result = await apiClient.entities.Training.log(supervisorKey, {
        ...formData,
        technician_id: technicianId,
        technician_name: user.name
      });

      setTrainingLog(prev => [
        { ...formData, timestamp: new Date().toLocaleDateString() },
        ...prev
      ].slice(0, 10));

      setFormData({
        title: '',
        description: '',
        hours: 1,
        category: 'technical',
        date: new Date().toISOString().split('T')[0],
        instructor: '',
        competency_level: 'intermediate'
      });

      alert('Training logged successfully!');
      if (onSubmit) onSubmit(result);
    } catch (err) {
      console.error('Error logging training:', err);
      setError('Error: ' + err.message);
      alert('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="training-container">
      <div className="training-form">
        <h2>🎓 Log Training Session</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Training Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Machine Operation Training"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="technical">🔧 Technical</option>
              <option value="safety">🛡️ Safety</option>
              <option value="soft_skills">👥 Soft Skills</option>
              <option value="compliance">📋 Compliance</option>
              <option value="other">📚 Other</option>
            </select>
          </div>

          {/* When technician chooses training category, show a dedicated note section */}
          {formData.category && (
            <div className="form-group">
              <label htmlFor="note">Training Note (specific details) *</label>
              <textarea
                id="note"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Add a short note about what training you completed and which topics you practiced"
                rows="3"
                required
                disabled={isLoading}
              />
            </div>
          )}




          <div className="form-group">
            <label htmlFor="hours">Hours *</label>
            <input
              type="number"
              id="hours"
              name="hours"
              value={formData.hours}
              onChange={handleChange}
              min="0.5"
              step="0.5"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">What did you learn? (Skill set acquired) *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Explain the skill set you acquired from this training"
              rows="3"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="competency_level">Competency Level</label>
            <select
              id="competency_level"
              name="competency_level"
              value={formData.competency_level}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="instructor">Instructor/Provider</label>
            <input
              type="text"
              id="instructor"
              name="instructor"
              value={formData.instructor}
              onChange={handleChange}
              placeholder="Name of instructor or training provider"
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? '⏳ Logging...' : '✓ Log Training'}
          </button>
        </form>
      </div>

      {trainingLog.length > 0 && (
        <div className="training-log">
          <h3>📚 Recent Training</h3>
          <div className="log-items">
            {trainingLog.map((item, idx) => (
              <div key={idx} className="log-item">
                <div className="log-header">
                  <span className="log-title">{item.title}</span>
                  <span className="log-hours">{item.hours}h</span>
                </div>
                <div className="log-details">
                  <span className="log-category">{item.category}</span>
                  <span className="log-date">{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingForm;
