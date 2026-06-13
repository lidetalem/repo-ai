import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

export default function TopBar({ title }) {
  const { theme, toggle }    = useTheme()
  const { lang, switchLang } = useLang()
  const { user }             = useAuth()
  const navigate             = useNavigate()

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

        {/* notifications removed */}
      </div>
    </header>
  )
}