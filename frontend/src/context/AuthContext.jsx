/**
 * AuthContext.jsx
 * AMECO — Authentication state management.
 *
 * Critical rule: `user` is NEVER set from localStorage directly.
 * It is only set after the server confirms the token is valid via /api/auth/me/.
 * This means `loading` stays true until the server responds, guaranteeing
 * no protected page ever renders with unverified credentials.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'
import wsManager from '../services/websocket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // never set from localStorage directly
  const [loading, setLoading] = useState(true)   // true until server verify done

  // ── On mount: verify token with server before setting any user state ───────
  useEffect(() => {
    const access = localStorage.getItem('access_token')

    if (!access) {
      // No token — nothing to verify, user stays null
      setLoading(false)
      return
    }

    // Token exists — verify it with the server before trusting it
    authAPI.me()
      .then(({ data }) => {
        const verified = {
          id:                data.user_id,
          username:          data.username,
          role:              data.role,
          full_name:         data.full_name         || '',
          profile_image_url: data.profile_image_url || null,
          privileges:        Array.isArray(data.privileges) ? data.privileges : [],
          is_super_admin:    Boolean(data.is_super_admin),
        }
        // Update localStorage with fresh server data
        localStorage.setItem('user_data', JSON.stringify(verified))
        setUser(verified)
        wsManager.connect(verified.username)
      })
      .catch(() => {
        // Token invalid / expired — wipe everything, force fresh login
        localStorage.clear()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const { data } = await authAPI.login({ username, password })

    localStorage.setItem('access_token',  data.access)
    localStorage.setItem('refresh_token', data.refresh)

    const userData = {
      id:                data.user_id,
      username:          data.username,
      role:              data.role,
      full_name:         data.full_name         || '',
      profile_image_url: data.profile_image_url || null,
      privileges:        Array.isArray(data.privileges) ? data.privileges : [],
      is_super_admin:    Boolean(data.is_super_admin),
    }

    localStorage.setItem('user_data', JSON.stringify(userData))
    setUser(userData)
    wsManager.connect(data.username)
    return userData
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    try { await authAPI.logout(refresh) } catch (_) {}
    wsManager.disconnect()
    localStorage.clear()
    setUser(null)
  }, [])

  // ── Refresh privileges ────────────────────────────────────────────────────
  const refreshPrivileges = useCallback(async () => {
    try {
      const { data } = await authAPI.me()
      const updated = {
        ...user,
        privileges:        Array.isArray(data.privileges) ? data.privileges : [],
        is_super_admin:    Boolean(data.is_super_admin),
        full_name:         data.full_name         || user?.full_name,
        profile_image_url: data.profile_image_url || user?.profile_image_url,
      }
      localStorage.setItem('user_data', JSON.stringify(updated))
      setUser(updated)
    } catch (_) {}
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshPrivileges }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
