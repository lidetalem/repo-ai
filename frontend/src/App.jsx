/**
 * App.jsx — AMECO root router
 *
 * Simple, predictable routing rules:
 *
 *   /login   → ALWAYS shows the login page, no exceptions.
 *              After successful login, LoginPage redirects by role.
 *
 *   /        → not logged in → /login
 *              logged in     → /admin or /guard by role
 *
 *   /admin/* → requires role=admin; else AccessDenied page
 *   /guard/* → requires role=guard; else AccessDenied page
 *
 *   *        → /
 *
 * Auth state is NEVER trusted until the server has verified the token.
 * `loading=true` until that verify resolves — splash shown the whole time.
 */

import React from 'react'
import {
  BrowserRouter, Routes, Route, Navigate,
  useLocation, useNavigate,
} from 'react-router-dom'
import { Toaster }    from 'react-hot-toast'
import { ShieldOff, LogIn } from 'lucide-react'

import { AuthProvider, useAuth }  from './context/AuthContext'
import VisitorNotificationPopup   from './components/VisitorNotificationPopup'
import { ThemeProvider }          from './context/ThemeContext'
import { LanguageProvider }       from './context/LanguageContext'

import LoginPage      from './pages/Login/LoginPage'
import AdminDashboard from './pages/AdminDashboard/AdminDashboard'
import GuardDashboard from './pages/GuardDashboard/GuardDashboard'

// ── Splash ────────────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-bg-main)' }}
    >
      <div
        className="w-12 h-12 rounded-full border-4 animate-spin"
        style={{ borderColor: 'var(--color-ameco-red)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Loading AMECO…
      </p>
    </div>
  )
}

// ── AccessDenied ──────────────────────────────────────────────────────────────

function AccessDeniedPage() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      style={{ background: 'var(--color-bg-main)' }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(204,0,0,0.1)', border: '2px solid rgba(204,0,0,0.25)' }}
      >
        <ShieldOff size={36} color="#cc0000" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>
          Access Denied
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          You must be logged in to view this page.
        </p>
        <p
          className="text-xs font-mono px-3 py-1 rounded-lg inline-block mt-1"
          style={{
            background: 'var(--color-card-main)',
            color:      'var(--color-text-muted)',
            border:     '1px solid var(--color-border-main)',
          }}
        >
          {location.pathname}
        </p>
      </div>

      <button
        onClick={() => navigate('/login', { state: { from: location.pathname } })}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, #cc0000, #aa0000)',
          boxShadow:  '0 4px 20px rgba(204,0,0,0.35)',
        }}
      >
        <LogIn size={18} />
        Login to continue
      </button>
    </div>
  )
}

// ── ProtectedRoute ────────────────────────────────────────────────────────────

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading)                    return <SplashScreen />
  if (!user)                      return <AccessDeniedPage />
  if (role && user.role !== role) return <AccessDeniedPage />
  return children
}

// ── RoleRouter ────────────────────────────────────────────────────────────────
// Only used for the bare "/" path.

function RoleRouter() {
  const { user, loading } = useAuth()

  if (loading)                         return <SplashScreen />
  if (!user)                           return <Navigate to="/login" replace />
  if (user.role === 'admin')           return <Navigate to="/admin" replace />
  if (user.role === 'guard')           return <Navigate to="/guard" replace />
  return <Navigate to="/login" replace />
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
            <BrowserRouter>
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: 'var(--color-card-main)',
                    color:      'var(--color-text-main)',
                    border:     '1px solid var(--color-border-main)',
                    fontFamily: 'var(--font-sans)',
                    fontSize:   '0.875rem',
                  },
                }}
              />
              <Routes>
                {/* Root — redirect by role or to login */}
                <Route path="/" element={<RoleRouter />} />

                {/* Login — ALWAYS shows the login page, no redirect-away logic */}
                <Route path="/login" element={<LoginPage />} />

                {/* Admin dashboard */}
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Guard dashboard */}
                <Route
                  path="/guard/*"
                  element={
                    <ProtectedRoute role="guard">
                      <GuardDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <VisitorNotificationPopup />
            </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}