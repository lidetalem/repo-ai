/**
 * hooks/usePrivilege.js
 * AMECO — Privilege-based access control hook.
 *
 * Usage:
 *   const { hasPrivilege, isSuperAdmin, canAccess } = usePrivilege()
 *
 *   hasPrivilege('manage_staff')   → true/false
 *   isSuperAdmin()                 → true/false
 *   canAccess(['manage_staff', 'manage_guards'])  → true if ANY match
 */

import { useAuth } from '../context/AuthContext'

// Maps route segments to the required privilege key
export const ROUTE_PRIVILEGE_MAP = {
  staff:     'manage_staff',
  guards:    'manage_guards',
  visitors:  'manage_visitors',
  cameras:   'manage_cameras',
  logs:      'view_logs',
  admins:    'manage_admins',
  settings:  'manage_settings',
  // dashboard and notifications are always accessible
}

export function usePrivilege() {
  const { user } = useAuth()

  /**
   * Returns true if the current admin has the given privilege key,
   * or is a super admin (bypasses all checks).
   * Guards always return false (they have no admin privileges).
   */
  const hasPrivilege = (key) => {
    if (!user || user.role !== 'admin') return false
    if (user.is_super_admin) return true
    return Array.isArray(user.privileges) && user.privileges.includes(key)
  }

  /**
   * Returns true if the current user is a super admin.
   */
  const isSuperAdmin = () => Boolean(user?.is_super_admin)

  /**
   * Returns true if the current admin has ANY of the given privilege keys.
   * Useful for pages that accept multiple privilege paths.
   */
  const canAccess = (keys = []) => {
    if (!user || user.role !== 'admin') return false
    if (user.is_super_admin) return true
    return keys.some((k) => hasPrivilege(k))
  }

  /**
   * Returns all privilege keys the current user holds.
   */
  const myPrivileges = () => {
    if (!user || user.role !== 'admin') return []
    if (user.is_super_admin) return Object.keys(ROUTE_PRIVILEGE_MAP)
    return Array.isArray(user.privileges) ? user.privileges : []
  }

  return { hasPrivilege, isSuperAdmin, canAccess, myPrivileges }
}