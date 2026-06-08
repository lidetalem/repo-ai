/**
 * components/AccessDenied.jsx
 * AMECO — Full-page "Access Not Allowed" screen.
 * Shown when an admin tries to access a page their privileges don't cover.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { ShieldOff, ArrowLeft, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePrivilege, ROUTE_PRIVILEGE_MAP } from '../hooks/usePrivilege'

// Human-readable labels for privilege keys
const PRIVILEGE_LABELS = {
  manage_staff:    'Manage Staff',
  manage_guards:   'Manage Guards',
  manage_visitors: 'Manage Visitors',
  manage_cameras:  'Camera Control',
  view_logs:       'View Logs',
  review_requests: 'Review Requests',
  manage_settings: 'System Settings',
  manage_admins:   'Manage Admins',
  view_reports:    'View Reports',
}

export default function AccessDenied({ privilege, returnTo }) {
  const navigate           = useNavigate()
  const { myPrivileges }   = usePrivilege()
  const held               = myPrivileges()
  const requiredLabel      = privilege ? (PRIVILEGE_LABELS[privilege] || privilege) : null

  return (
    <div
      className="flex items-center justify-center min-h-full"
      style={{ minHeight: '60vh' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center text-center max-w-md w-full px-6 py-12 rounded-3xl"
        style={{
          background: 'var(--color-card-main)',
          border: '1px solid rgba(204,0,0,0.25)',
          boxShadow: '0 0 60px rgba(204,0,0,0.06)',
        }}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(204,0,0,0.18), rgba(204,0,0,0.06))',
            border: '1px solid rgba(204,0,0,0.3)',
          }}
        >
          <ShieldOff size={36} style={{ color: '#cc0000' }} />
        </motion.div>

        {/* Title */}
        <h2
          className="text-2xl font-black mb-2"
          style={{ color: 'var(--color-text-main)' }}
        >
          Access Not Allowed
        </h2>

        {/* Subtitle */}
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {requiredLabel
            ? <>You don't have the <span className="font-bold" style={{ color: '#cc0000' }}>"{requiredLabel}"</span> privilege to view this section.</>
            : "You don't have the required privileges to access this section."
          }
          {' '}Contact your Super Admin to request access.
        </p>

        {/* Required privilege badge */}
        {privilege && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-6"
            style={{
              background: 'rgba(204,0,0,0.08)',
              border: '1px solid rgba(204,0,0,0.2)',
            }}
          >
            <Lock size={13} style={{ color: '#cc0000' }} />
            <span className="text-xs font-bold" style={{ color: '#cc0000' }}>
              Required: {requiredLabel}
            </span>
          </div>
        )}

        {/* Your active privileges */}
        {held.length > 0 && (
          <div className="w-full mb-6">
            <p
              className="text-[10px] font-black uppercase tracking-widest mb-2 text-left"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Your current privileges
            </p>
            <div className="flex flex-wrap gap-1.5">
              {held.map((k) => (
                <span
                  key={k}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  {PRIVILEGE_LABELS[k] || k.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {held.length === 0 && (
          <div
            className="w-full mb-6 px-4 py-3 rounded-xl text-center"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No privileges assigned to your account yet.
            </p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(returnTo || '/admin')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--color-card-hover)',
            border: '1px solid var(--color-border-main)',
            color: 'var(--color-text-main)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cc0000'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-main)'}
        >
          <ArrowLeft size={15} />
          Go to Dashboard
        </button>
      </motion.div>
    </div>
  )
}