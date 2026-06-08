import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Shield, UserCheck, Camera,
  FileText, Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  UserCog, User2,
} from 'lucide-react'
import logo from '../assets/logo.png'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useNotifications } from '../context/NotificationContext'

const BASE_URL = 'http://127.0.0.1:8000'
const getImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

const ADMIN_NAV = [
  { key: 'dashboard',    label: 'dashboard',    icon: LayoutDashboard, path: '/admin' },
  { key: 'admins',       label: 'admins',       icon: UserCog,         path: '/admin/admins' },
  { key: 'guards',       label: 'guards',       icon: Shield,          path: '/admin/guards' },
  { key: 'staff',        label: 'staff',        icon: Users,           path: '/admin/staff' },
  { key: 'visitors',     label: 'visitors',     icon: UserCheck,       path: '/admin/visitors' },
  { key: 'cameras',      label: 'cameras',      icon: Camera,          path: '/admin/cameras' },
  { key: 'logs',         label: 'logs',         icon: FileText,        path: '/admin/logs' },
  { key: 'notifications',label: 'notifications',icon: Bell,            path: '/admin/notifications' },
  { key: 'settings',     label: 'settings',     icon: Settings,        path: '/admin/settings' },
]

const GUARD_NAV = [
  { key: 'dashboard',    label: 'dashboard',    icon: LayoutDashboard, path: '/guard' },
  { key: 'visitors',     label: 'visitors',     icon: UserCheck,       path: '/guard/visitors' },
  { key: 'requests',     label: 'request',      icon: User2,           path: '/guard/requests' },
  { key: 'notifications',label: 'notifications',icon: Bell,            path: '/guard/notifications' },
  { key: 'settings',     label: 'settings',     icon: Settings,        path: '/guard/settings' },
]

export default function Sidebar({ role }) {
  const { user, logout }     = useAuth()
  const { t }                = useLang()
  const { unreadCount }      = useNotifications()
  const navigate             = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const nav = role === 'admin' ? ADMIN_NAV : GUARD_NAV

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0"
      style={{
        width: collapsed ? '72px' : '220px',
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-main)',
        zIndex: 40,
      }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b"
           style={{ borderColor: 'var(--color-border-main)', minHeight: '72px' }}>
        <img src={logo} alt="AMECO" className="w-9 h-9 rounded-none object-cover shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--color-text-main)' }}>AMECO</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Access Control</p>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {nav.map(({ key, label, icon: Icon, path }) => (
          <NavLink
            key={key}
            to={path}
            end={path === '/admin' || path === '/guard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative
              ${isActive ? 'text-white' : ''}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg,#cc0000,#aa0000)' : 'transparent',
              color: isActive ? 'white' : 'var(--color-text-muted)',
              boxShadow: isActive ? '0 4px 12px rgba(204,0,0,0.3)' : 'none',
            })}>
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{t(label)}</span>}
            {key === 'notifications' && unreadCount > 0 && (
              <span
                className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#cc0000', color: 'white', minWidth: '20px', textAlign: 'center' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile + logout */}
      <div className="border-t p-3 space-y-2" style={{ borderColor: 'var(--color-border-main)' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
             style={{ background: 'var(--color-card-main)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{ background: 'var(--color-ameco-red)' }}>
            {user?.profile_image_url
              ? <img src={getImageUrl(user.profile_image_url)} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
            }
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                {user?.role}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ color: '#ff6b6b' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(204,0,0,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <LogOut size={16} />
          {!collapsed && t('logout')}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center"
        style={{
          background: 'var(--color-ameco-red)',
          border: '2px solid var(--color-bg-main)',
          color: 'white',
        }}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}