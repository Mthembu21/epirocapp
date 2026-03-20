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
        const doFetch = async () => {
            return fetch(`${API_URL}${endpoint}`, {
                ...options,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
        };

        const response = await doFetch();

        if (!response.ok) {
            if (response.status === 401 && !options.__retried) {
                try {
                    const storedUser = localStorage.getItem('epiroc_user');
                    const parsed = storedUser ? JSON.parse(storedUser) : null;
                    if (parsed?.type === 'technician' && parsed?.name && parsed?.employee_id) {
                        await fetch(`${API_URL}/auth/technician/login`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: parsed.name, employee_id: parsed.employee_id })
                        });

                        const retryResponse = await doFetch();
                        if (retryResponse.ok) {
                            const json = await retryResponse.json();
                            return this.normalizeIds(json);
                        }
                    }
                } catch {
                    // fall through to normal error handling
                }
            }

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
        
        supervisorLogin: (email, password) => 
            this.request('/auth/supervisor/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            }),

        switchTenant: (supervisor_key) =>
            this.request('/auth/switch-tenant', {
                method: 'POST',
                body: JSON.stringify({ supervisor_key })
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
            update: (id, data) => this.request(`/technicians/${id}`, {
                method: 'PUT',
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
            recoverTechnicalComplexity: (jobNumber) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/recover-technical-complexity`, {
                method: 'POST'
            }),
            assignTechnicianByJobNumber: (jobNumber, technician_id, technician_name) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/assign-technician`, {
                method: 'PUT',
                body: JSON.stringify({ technician_id, technician_name })
            }),
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
                complete: (jobNumber, subtaskId, { technician_id } = {}) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}/subtasks/${subtaskId}/complete`, {
                    method: 'PUT',
                    body: JSON.stringify({ technician_id })
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
            updateByJobNumber: (jobNumber, data) => this.request(`/jobs/by-job/${encodeURIComponent(jobNumber)}`, {
                method: 'PUT',
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
            idleCategories: () => this.request('/time-entries/idle-categories'),
            approvals: {
                pending: (params = {}) => {
                    const q = new URLSearchParams();
                    if (params.start_date) q.set('start_date', params.start_date);
                    if (params.end_date) q.set('end_date', params.end_date);
                    if (params.technician_id) q.set('technician_id', params.technician_id);
                    const qs = q.toString();
                    return this.request(`/time-entries/approvals/pending${qs ? `?${qs}` : ''}`);
                },
                approve: (id, { approved_hours, note } = {}) => this.request(`/time-entries/${id}/approve`, {
                    method: 'PUT',
                    body: JSON.stringify({ approved_hours, note })
                }),
                decline: (id, { note } = {}) => this.request(`/time-entries/${id}/decline`, {
                    method: 'PUT',
                    body: JSON.stringify({ note })
                })
            },
            create: (data) => this.request('/time-entries', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            update: (id, data) => this.request(`/time-entries/${id}`, {
                method: 'PUT',
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
        },

        Overview: {
            workshop: () => this.request('/overview/workshop')
        }
    };
}

export const apiClient = new APIClient();
export { apiClient as base44 };
