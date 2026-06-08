/**
 * src/services/api.js
 * AMECO Security Systems — Centralised Axios API Service
 *
 * Changes vs previous version:
 *  • _clearAuthAndRedirect now clears ALL localStorage keys (including user_data)
 *  • adminsAPI.retrieve alias added (used by PrivilegesModal)
 *  • recognitionAPI.cacheStats added (used by improved SettingsPage)
 *  • Throttle 429 response handled: surfaces a user-friendly message instead of
 *    silently failing — callers can catch err.response.status === 429
 */

import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// ── Request: attach JWT ───────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response: queue-based auto-refresh on 401 ─────────────────────────────────
let isRefreshing = false
let failedQueue  = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // Surface throttle errors clearly
    if (error.response?.status === 429) {
      const err429 = new Error('Too many requests. Please wait a moment and try again.')
      err429.isThrottle = true
      err429.response   = error.response
      return Promise.reject(err429)
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
        .catch((err) => Promise.reject(err))
    }

    original._retry = true
    isRefreshing    = true

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      isRefreshing = false
      _clearAuthAndRedirect()
      return Promise.reject(error)
    }

    let newAccessToken = null
    try {
      const { data } = await axios.post(`${BASE_URL}/api/token/refresh/`, { refresh: refreshToken })
      newAccessToken = data.access
    } catch (_) {
      // refresh failed
    }

    if (newAccessToken) {
      localStorage.setItem('access_token', newAccessToken)
      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`
      processQueue(null, newAccessToken)
      isRefreshing = false
      original.headers.Authorization = `Bearer ${newAccessToken}`
      return api(original)
    }

    processQueue(error, null)
    isRefreshing = false
    _clearAuthAndRedirect()
    return Promise.reject(error)
  },
)

/**
 * Clear ALL auth state and redirect to login.
 * Previously missed 'user_data' — fixed here.
 */
function _clearAuthAndRedirect() {
  localStorage.clear()          // wipe everything: tokens, user_data, theme, etc.
  window.location.href = '/login'
}

// ═════════════════════════════════════════════════════════════════════════════
//  Auth
// ═════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  login:  (data)    => api.post('/api/auth/login/', data),
  logout: (refresh) => api.post('/api/auth/logout/', { refresh }),
  me:     ()        => api.get('/api/auth/me/'),
  // Legacy aliases
  loginAdmin: (creds) => api.post('/api/auth/login/', creds),
  loginGuard: (creds) => api.post('/api/auth/login/', creds),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Admins
// ═════════════════════════════════════════════════════════════════════════════
export const adminsAPI = {
  list:     ()         => api.get('/api/admins/management/'),
  get:      (id)       => api.get(`/api/admins/management/${id}/`),
  retrieve: (id)       => api.get(`/api/admins/management/${id}/`),   // alias
  create:   (data)     => api.post('/api/admins/management/', data),
  update:   (id, data) => api.patch(`/api/admins/management/${id}/`, data),
  delete:   (id)       => api.delete(`/api/admins/management/${id}/`),
}
export const adminAPI = adminsAPI  // legacy alias

// ═════════════════════════════════════════════════════════════════════════════
//  Guards
// ═════════════════════════════════════════════════════════════════════════════
export const guardsAPI = {
  list:     ()         => api.get('/api/guard/'),
  get:      (id)       => api.get(`/api/guard/${id}/`),
  retrieve: (id)       => api.get(`/api/guard/${id}/`),
  create:   (data)     => api.post('/api/guard/', data),
  update:   (id, data) => api.patch(`/api/guard/${id}/`, data),
  delete:   (id)       => api.delete(`/api/guard/${id}/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Staff
// ═════════════════════════════════════════════════════════════════════════════
export const staffAPI = {
  list:     ()         => api.get('/api/staff/'),
  get:      (id)       => api.get(`/api/staff/${id}/`),
  retrieve: (id)       => api.get(`/api/staff/${id}/`),
  create:   (data)     => api.post('/api/staff/', data),
  update:   (id, data) => api.patch(`/api/staff/${id}/`, data),
  delete:   (id)       => api.delete(`/api/staff/${id}/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Visitors
// ═════════════════════════════════════════════════════════════════════════════
export const visitorsAPI = {
  list:     ()         => api.get('/api/temporary-users/profiles/'),
  get:      (id)       => api.get(`/api/temporary-users/profiles/${id}/`),
  create:   (data)     => api.post('/api/temporary-users/profiles/', data),
  update:   (id, data) => api.patch(`/api/temporary-users/profiles/${id}/`, data),
  delete:   (id)       => api.delete(`/api/temporary-users/profiles/${id}/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Visitor Requests
// ═════════════════════════════════════════════════════════════════════════════
export const requestsAPI = {
  list:         ()            => api.get('/api/temporary-requests/requests/'),
  create:       (data)        => api.post('/api/temporary-requests/requests/', data),
  updateStatus: (id, payload) =>
    api.patch(
      `/api/temporary-requests/requests/${id}/update_status/`,
      typeof payload === 'string' ? { status: payload } : payload,
    ),
  delete: (id) => api.delete(`/api/temporary-requests/requests/${id}/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Cameras
// ═════════════════════════════════════════════════════════════════════════════
export const camerasAPI = {
  list:         ()         => api.get('/api/camera/terminals/'),
  get:          (id)       => api.get(`/api/camera/terminals/${id}/`),
  create:       (data)     => api.post('/api/camera/terminals/', data),
  update:       (id, data) => api.patch(`/api/camera/terminals/${id}/`, data),
  delete:       (id)       => api.delete(`/api/camera/terminals/${id}/`),
  togglePower:  (id)       => api.patch(`/api/camera/terminals/${id}/toggle_power/`),
  toggleStatus: (id)       => api.patch(`/api/camera/terminals/${id}/toggle_status/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Logs
// ═════════════════════════════════════════════════════════════════════════════
export const logsAPI = {
  list:      (params) => api.get('/api/logs/',            { params }),
  history:   (params) => api.get('/api/logs/history/',    { params }),
  exportCsv: (params) => api.get('/api/logs/export_csv/', { params, responseType: 'blob' }),
}

export const accessLogsAPI = {
  list:      () => api.get('/api/face-engine/logs/history/'),
  today:     () => api.get('/api/face-engine/logs/today/'),
  clearAll:  () => api.delete('/api/face-engine/logs/clear_all/'),
  clearDate: (date) => api.delete(`/api/face-engine/logs/clear_date/${date}/`),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Notifications
// ═════════════════════════════════════════════════════════════════════════════
export const notificationsAPI = {
  list:        ()   => api.get('/api/notifications/'),
  markRead:    (id) => api.patch(`/api/notifications/${id}/mark_read/`),
  dismiss:     (id) => api.patch(`/api/notifications/${id}/dismiss/`),
  markAllRead: ()   => api.patch('/api/notifications/mark_all_read/'),
}

// ═════════════════════════════════════════════════════════════════════════════
//  Recognition / Face Engine
// ═════════════════════════════════════════════════════════════════════════════
export const faceEngineAPI = {
  recognize:      (data) => api.post('/api/face-engine/recognize/', data),
  enrollStaff:    (id)   => api.post(`/api/face-engine/enroll/staff/${id}/`),
  enrollTempUser: (id)   => api.post(`/api/face-engine/enroll/temp-user/${id}/`),
  reloadCache:    ()     => api.post('/api/recognition/reload/'),
  cacheStats:     ()     => api.get('/api/recognition/stats/'),
  logs:           ()     => api.get('/api/face-engine/logs/'),
  enrollmentLogs: ()     => api.get('/api/face-engine/enrolment-logs/'),
}

export const recognitionAPI = {
  scan:      (data) => api.post('/api/recognition/scan/', data),
  scanMulti: (data) => api.post('/api/recognition/scan/multi/', data),
  reloadCache: ()     => faceEngineAPI.reloadCache(),
  cacheStats:  ()     => faceEngineAPI.cacheStats(),
}

export default api