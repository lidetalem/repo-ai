/**
 * components/guard/CompactIDOverlay.jsx
 * AMECO — Compact Digital ID card that appears as an overlay
 * anchored to the TOP-RIGHT corner of the live camera feed.
 *
 * Shown for every ACCEPTED scan (Staff, Visitor, Guard, Admin).
 * Auto-dismisses after `displayMs` with a countdown progress bar.
 * Clicking it opens the full DigitalIDCard popup.
 */

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, User, UserCheck, Shield,
  UserCog, ChevronRight, X, Clock,
} from 'lucide-react'

const BASE_URL = 'http://127.0.0.1:8000'

// Role config ─────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  ADMIN:   { color: '#cc0000', label: 'Admin',   labelAm: 'አስተዳዳሪ', Icon: UserCog   },
  GUARD:   { color: '#3b82f6', label: 'Guard',   labelAm: 'ጠባቂ',    Icon: Shield    },
  STAFF:   { color: '#10b981', label: 'Staff',   labelAm: 'ሠራተኛ',  Icon: User      },
  VISITOR: { color: '#f59e0b', label: 'Visitor', labelAm: 'ጎብኚ',    Icon: UserCheck },
}

function getRoleConfig(role = '') {
  return ROLE_CONFIG[role.toUpperCase()] || ROLE_CONFIG.STAFF
}

// Countdown hook ───────────────────────────────────────────────────────────────
function useCountdown(totalMs, onExpire) {
  const [progress, setProgress] = useState(100)
  const startRef = useRef(Date.now())
  const rafRef   = useRef(null)

  useEffect(() => {
    startRef.current = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const pct     = Math.max(0, 100 - (elapsed / totalMs) * 100)
      setProgress(pct)
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onExpire()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [totalMs, onExpire])

  return progress
}

// ── CompactIDOverlay ──────────────────────────────────────────────────────────
export default function CompactIDOverlay({
  person,         // scan result from backend (ACCEPTED)
  displayMs = 8000,
  onClose,        // called on dismiss
  onExpand,       // called when guard clicks to see full DigitalIDCard
}) {
  const { color, label, labelAm, Icon } = getRoleConfig(person?.role)
  const progress = useCountdown(displayMs, onClose)

  if (!person) return null

  const imageUrl = person.profile_image
    ? (person.profile_image.startsWith('http')
        ? person.profile_image
        : `${BASE_URL}${person.profile_image}`)
    : null

  const firstName = (person.name || '').split(' ')[0]

  return (
    <motion.div
        key="compact-overlay"
        initial={{ opacity: 0, x: 60, scale: 0.88 }}
        animate={{ opacity: 1, x: 0,  scale: 1    }}
        exit={{    opacity: 0, x: 60, scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative w-[220px] rounded-2xl overflow-hidden cursor-pointer select-none"
        style={{
          background: 'rgba(8, 8, 10, 0.92)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${color}50`,
          boxShadow: `0 0 30px ${color}30, 0 8px 24px rgba(0,0,0,0.6)`,
        }}
        onClick={onExpand}
      >
        {/* Role accent line */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}60)` }} />

        {/* Header row */}
        <div
          className="flex items-center gap-2 px-3 pt-2.5 pb-2"
          style={{ borderBottom: `1px solid ${color}20` }}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}25` }}
          >
            <Icon size={10} style={{ color }} />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>
              {label}
            </span>
            <span className="text-[9px]" style={{ color: '#555' }}>·</span>
            <span className="text-[9px]" style={{ color: '#666' }}>{labelAm}</span>
          </div>
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="w-4 h-4 flex items-center justify-center rounded flex-shrink-0 transition-all"
            style={{ color: '#444' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#444'}
          >
            <X size={9} />
          </button>
        </div>

        {/* Person row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
            style={{ border: `1.5px solid ${color}40`, background: '#111' }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-sm font-black" style={{ color }}>
                  {(person.name || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-black leading-tight truncate"
              style={{ color: '#f0f0f0' }}
            >
              {person.name || 'Unknown'}
            </p>
            {person.position && (
              <p className="text-[9px] leading-tight truncate mt-0.5" style={{ color: '#888' }}>
                {person.position}
              </p>
            )}
            <p
              className="text-[9px] font-black font-mono mt-1 tracking-wide"
              style={{ color }}
            >
              {person.digital_id}
            </p>
          </div>

          {/* Expand arrow */}
          <ChevronRight size={12} style={{ color: '#444', flexShrink: 0 }} />
        </div>

        {/* Confidence + visitor validity */}
        <div
          className="flex items-center justify-between px-3 pb-2.5"
          style={{ gap: 4 }}
        >
          {/* Confidence pill */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: `${color}18` }}
          >
            <ShieldCheck size={9} style={{ color }} />
            <span className="text-[9px] font-black" style={{ color }}>
              {person.confidence?.toFixed(1)}%
            </span>
          </div>

          {/* Visitor valid-until */}
          {person.valid_until && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Clock size={9} style={{ color: '#f59e0b' }} />
              <span className="text-[9px] font-bold" style={{ color: '#f59e0b' }}>
                Until {new Date(person.valid_until).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Access Granted strip */}
        <div
          className="flex items-center justify-center gap-1.5 py-1.5"
          style={{ background: 'rgba(0,204,102,0.12)', borderTop: '1px solid rgba(0,204,102,0.2)' }}
        >
          <ShieldCheck size={9} style={{ color: '#00cc66' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#00cc66' }}>
            Access Granted · Welcome {firstName}
          </span>
        </div>

        {/* Countdown progress bar */}
        <div style={{ height: 2, background: '#111' }}>
          <motion.div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${color}, ${color}80)`,
              transition: 'none',
            }}
          />
        </div>
    </motion.div>
  )
}