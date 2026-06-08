import React, { useState } from 'react'
import { Sun, Moon, Globe, RefreshCw, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../../context/ThemeContext'
import { useLang } from '../../context/LanguageContext'
import { recognitionAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const BASE_URL = 'http://127.0.0.1:8000'
const getImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export default function SettingsPage() {
  const { theme, toggle }       = useTheme()
  const { lang, switchLang, t } = useLang()
  const { user }                = useAuth()
  const [reloading, setReloading] = useState(false)

  const reloadCache = async () => {
    setReloading(true)
    try {
      const { data } = await recognitionAPI.reloadCache()
      toast.success(data.detail || 'Cache reloaded!')
    } catch {
      toast.error('Failed to reload cache')
    } finally {
      setReloading(false)
    }
  }

  const Section = ({ title, children }) => (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border-main)' }}>
        <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-ameco-red)' }}>
          {title}
        </h4>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )

  const Row = ({ icon: Icon, label, children }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--color-text-main)' }}>{label}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div className="space-y-5 max-w-lg">

      {/* Profile */}
      <Section title="Account">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
               style={{ background: 'var(--color-ameco-red)' }}>
            {user?.profile_image_url
              ? <img src={getImageUrl(user.profile_image_url)} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-xl font-black">
                  {user?.full_name?.[0]?.toUpperCase() || 'A'}
                </span>
            }
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--color-text-main)' }}>{user?.full_name || user?.username}</p>
            <p className="text-sm capitalize" style={{ color: 'var(--color-text-muted)' }}>{user?.role}</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{user?.username}</p>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Row icon={theme === 'dark' ? Moon : Sun} label="Theme">
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-main)',
            }}>
            {theme === 'dark' ? <><Moon size={14} /> Dark</> : <><Sun size={14} /> Light</>}
          </button>
        </Row>

        <Row icon={Globe} label="Language">
          <div className="flex gap-2">
            {['en', 'am'].map((l) => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: lang === l ? 'linear-gradient(135deg,#cc0000,#aa0000)' : 'var(--color-card-hover)',
                  color: lang === l ? 'white' : 'var(--color-text-muted)',
                  border: lang === l ? 'none' : '1px solid var(--color-border-main)',
                }}>
                {l === 'en' ? 'English' : 'አማርኛ'}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* System */}
      <Section title="System">
        <Row icon={Database} label="Face Recognition Cache">
          <button
            onClick={reloadCache}
            disabled={reloading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg,#cc0000,#aa0000)',
              opacity: reloading ? 0.6 : 1,
            }}>
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
            {reloading ? 'Reloading…' : 'Reload Cache'}
          </button>
        </Row>
      </Section>

      {/* About */}
      <Section title="About">
        <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <p><span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>System:</span> AMECO Face Recognition Access Control</p>
          <p><span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>Organization:</span> Amhara Media Corporation</p>
          <p><span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>Version:</span> 1.0.0</p>
          <p><span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>Backend:</span> Django REST Framework + Django Channels</p>
          <p><span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>AI:</span> face-recognition + DeepFace</p>
        </div>
      </Section>
    </div>
  )
}