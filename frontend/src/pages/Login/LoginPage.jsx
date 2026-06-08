import React, { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'
import logo from '../../assets/logo.png'
import PasswordInput from '../../components/PasswordInput'

export default function LoginPage() {
  const { login }     = useAuth()
  const { t, lang, switchLang } = useLang()
  const { theme, toggle } = useTheme()
  const navigate      = useNavigate()
  const location      = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [shaking, setShaking]   = useState(false)
  const formRef = useRef(null)

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      triggerShake()
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(username.trim(), password)
      const from = location.state?.from
      if (from && from !== '/login') {
        navigate(from, { replace: true })
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (user.role === 'guard') {
        navigate('/guard', { replace: true })
      }
    } catch (err) {
      const msg = err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.detail
        || 'Invalid credentials. Please try again.'
      setError(msg)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'var(--color-bg-main)' }}>

      {/* Background grid pattern */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
             backgroundSize: '32px 32px',
           }} />

      {/* Red accent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
           style={{
             background: 'radial-gradient(circle, rgba(204,0,0,0.12) 0%, transparent 70%)',
           }} />

      {/* Language + Theme toggles */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={() => switchLang(lang === 'en' ? 'am' : 'en')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-main)',
          }}>
          {lang === 'en' ? 'አማ' : 'EN'}
        </button>
        <button
          onClick={toggle}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-main)',
          }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Card */}
      <div
        ref={formRef}
        className={`w-full max-w-md mx-4 rounded-2xl p-8 ${shaking ? 'animate-error-shake' : ''}`}
        style={{
          background: 'var(--color-card-main)',
          border: shaking
            ? '1.5px solid var(--color-ameco-red)'
            : '1.5px solid var(--color-border-main)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          transition: 'border-color 0.3s',
        }}>

        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-none overflow-hidden mb-4"
               style={{ background: 'linear-gradient(135deg, #cc0000, #880000)' }}>
            <img src={logo} alt="AMECO logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            AMECO
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('corpName')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {t('accessControlSystem')}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
               style={{
                 background: 'rgba(204,0,0,0.1)',
                 border: '1px solid rgba(204,0,0,0.3)',
                 color: '#ff6b6b',
               }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                   style={{ color: 'var(--color-text-muted)' }}>
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or Email"
              autoComplete="username"
              className="ameco-input"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                   style={{ color: 'var(--color-text-muted)' }}>
              {t('password')}
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('password')}
              autoComplete="current-password"
              className="ameco-input"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 mt-2"
            style={{
              background: loading
                ? 'rgba(204,0,0,0.5)'
                : 'linear-gradient(135deg, #cc0000, #aa0000)',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(204,0,0,0.4)',
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)' }}>
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                {t('login')}
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-muted)' }}>
          © {new Date().getFullYear()} AMECO · Face Recognition Access Control
        </p>
      </div>
    </div>
  )
}