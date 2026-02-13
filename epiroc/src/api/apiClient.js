// src/api/apiClient.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class APIClient {
    // Normalize MongoDB _id to id for frontend compatibility
    normalizeIds(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.normalizeIds(item));
        }
        if (data && typeof data === 'object' && data._id && !data.id) {
            return { ...data, id: data._id };
        }
        return data;
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        const json = await response.json();
        return this.normalizeIds(json);
    }

    // Auth
    auth = {
        technicianLogin: (name, employee_id) => 
            this.request('/auth/technician/login', {
                method: 'POST',
                body: JSON.stringify({ name, employee_id })
            }),
        
        supervisorLogin: (code) => 
            this.request('/auth/supervisor/login', {
                method: 'POST',
                body: JSON.stringify({ code })
            }),
        
        me: () => this.request('/auth/me'),
        
        logout: () => this.request('/auth/logout', { method: 'POST' }),
        
        isAuthenticated: async () => {
            try {
                await this.request('/auth/me');
                return true;
            } catch {
                return false;
            }
        }
    };

    // Entities
    entities = {
        Technician: {
            list: () => this.request('/technicians'),
            create: (data) => this.request('/technicians', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            delete: (id) => this.request(`/technicians/${id}`, { method: 'DELETE' })
        },

        Job: {
            list: () => this.request('/jobs'),
            filter: (filter) => {
                if (filter.assigned_technician_id) {
                    return this.request(`/jobs/technician/${filter.assigned_technician_id}`);
                }
                return this.request('/jobs');
            },
            getByJobNumber: (jobNumber) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}`),
            confirmByJobNumber: (jobNumber, technician_id) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/confirm`, {
                method: 'PUT',
                body: JSON.stringify({ technician_id })
            }),
            subtasks: {
                add: (jobNumber, data) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/subtasks`, {
                    method: 'POST',
                    body: JSON.stringify(data)
                }),
                update: (jobNumber, subtaskId, data) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/subtasks/${subtaskId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                }),
                delete: (jobNumber, subtaskId) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/subtasks/${subtaskId}`, {
                    method: 'DELETE'
                }),
                setProgress: (jobNumber, subtaskId, data) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/subtasks/${subtaskId}/progress`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                })
            },
            create: (data) => this.request('/jobs', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            update: (id, data) => this.request(`/jobs/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            }),
            delete: (id) => this.request(`/jobs/${id}`, { method: 'DELETE' })
        },

        DailyTimeEntry: {
            list: () => this.request('/time-entries'),
            filter: (filter) => {
                if (filter.technician_id) {
                    return this.request(`/time-entries/technician/${filter.technician_id}`);
                }
                return this.request('/time-entries');
            },
            create: (data) => this.request('/time-entries', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            delete: (id) => this.request(`/time-entries/${id}`, { method: 'DELETE' })
        },

        JobReport: {
            list: () => this.request('/job-reports'),
            create: (data) => this.request('/job-reports', {
                method: 'POST',
                body: JSON.stringify(data)
            })
        },

        MonthlyArchive: {
            list: () => this.request('/archives'),
            create: (data) => this.request('/archives', {
                method: 'POST',
                body: JSON.stringify(data)
            })
        }
    };
}

export const apiClient = new APIClient();
export { apiClient as base44 };
