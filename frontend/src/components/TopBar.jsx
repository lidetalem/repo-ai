import React from 'react'
import { Bell, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LanguageContext'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'

export default function TopBar({ title }) {
  const { theme, toggle }    = useTheme()
  const { lang, switchLang } = useLang()
  const { unreadCount }      = useNotifications()
  const { user }             = useAuth()
  const navigate             = useNavigate()

  const notifPath = user?.role === 'admin' ? '/admin/notifications' : '/guard/notifications'

  return (
    <header
      className="flex items-center justify-between px-6 py-4 sticky top-0 z-30"
      style={{
        background: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border-main)',
        backdropFilter: 'blur(12px)',
      }}>

      {/* Page title */}
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
        {title}
      </h2>

      {/* Actions */}
      <div className="flex items-center gap-2">

        {/* Language toggle */}
        <button
          onClick={() => switchLang(lang === 'en' ? 'am' : 'en')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-muted)',
          }}>
          {lang === 'en' ? 'አማ' : 'EN'}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-muted)',
          }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications bell */}
        <button
          onClick={() => navigate(notifPath)}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-muted)',
          }}>
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 text-xs font-bold flex items-center justify-center rounded-full"
              style={{ background: '#cc0000', color: 'white' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}