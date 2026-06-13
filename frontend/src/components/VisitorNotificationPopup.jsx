/**
 * VisitorNotificationPopup.jsx
 * AMECO — Real-time popup for visitor request events.
 *
 * Shows a floating card when:
 *  - Admin: guard submits a new visitor request  (type: new_visitor_request)
 *  - Guard: admin approves or rejects a request  (type: request_decision)
 *
 * Auto-dismisses after 2 s, plays ring.mp3 on appear.
 */

import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, UserCheck, Bell } from 'lucide-react'
import wsManager from '../services/websocket'

const RING_SRC = '/src/asset/ring.mp3'
const AUTO_DISMISS_MS = 2000

function NotifCard({ notif, onDismiss }) {
  const { type, visitor_name, visitor_image, guard, guard_image, reason, status, denial_reason } = notif

  const isNew      = type === 'new_visitor_request'
  const isApproved = type === 'request_decision' && status === 'APPROVED'
  const isRejected = type === 'request_decision' && status === 'REJECTED'

  const accentColor = isApproved ? '#22c55e' : isRejected ? '#ef4444' : '#f59e0b'
  const Icon        = isApproved ? CheckCircle : isRejected ? XCircle : Bell

  const leftImage  = isNew ? guard_image  : visitor_image
  const rightImage = isNew ? visitor_image : null
  const title      = isNew
    ? `New visitor request from ${guard || 'Guard'}`
    : isApproved
      ? `✅ Request Approved`
      : `❌ Request Denied`
  const subtitle   = isNew
    ? `Visitor: ${visitor_name}${reason ? ` · ${reason}` : ''}`
    : isApproved
      ? `${visitor_name} has been approved`
      : `${visitor_name} — ${denial_reason || 'Request denied'}`

  return (
    <div
      style={{
        background: 'var(--color-card-main, #1a1a1a)',
        border: `1.5px solid ${accentColor}44`,
        borderRadius: '16px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${accentColor}22`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '320px',
        maxWidth: '420px',
        pointerEvents: 'auto',
        animation: 'notifSlideIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Avatar(s) */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Primary avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: '12px', overflow: 'hidden',
          background: 'var(--color-card-hover, #222)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${accentColor}`,
        }}>
          {leftImage
            ? <img src={leftImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 20 }}>👤</span>
          }
        </div>
        {/* Secondary avatar (new request only — show visitor next to guard) */}
        {isNew && rightImage && (
          <div style={{
            width: 26, height: 26, borderRadius: '8px', overflow: 'hidden',
            background: 'var(--color-card-hover, #222)',
            border: `2px solid var(--color-card-main, #1a1a1a)`,
            position: 'absolute', bottom: -6, right: -10,
          }}>
            <img src={rightImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={13} style={{ color: accentColor, flexShrink: 0 }} />
          <p style={{
            fontSize: 13, fontWeight: 700,
            color: 'var(--color-text-main, #fff)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </p>
        </div>
        <p style={{
          fontSize: 11, marginTop: 2,
          color: 'var(--color-text-muted, #888)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {subtitle}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          flexShrink: 0, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-text-muted, #666)',
          fontSize: 16, lineHeight: 1, padding: '2px 4px',
        }}
      >
        ×
      </button>
    </div>
  )
}

export default function VisitorNotificationPopup() {
  const [notifications, setNotifications] = useState([])
  const audioRef = useRef(null)

  useEffect(() => {
    // Create audio element for ring.mp3
    audioRef.current = new Audio(RING_SRC)
    audioRef.current.volume = 0.7

    const handleNotif = (data) => {
      const type = data.type
      if (type !== 'new_visitor_request' && type !== 'request_decision') return

      const id = `${type}-${data.request_id}-${Date.now()}`
      const notif = { ...data, _id: id }

      setNotifications((prev) => [...prev, notif])

      // Play sound
      try {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      } catch {}

      // Auto-dismiss after 2 s
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n._id !== id))
      }, AUTO_DISMISS_MS)
    }

    const unsubNew  = wsManager.on('new_visitor_request', handleNotif)
    const unsubDec  = wsManager.on('request_decision',    handleNotif)
    return () => { unsubNew(); unsubDec() }
  }, [])

  if (notifications.length === 0) return null

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.92); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {notifications.map((n) => (
          <NotifCard
            key={n._id}
            notif={n}
            onDismiss={() => setNotifications((prev) => prev.filter((x) => x._id !== n._id))}
          />
        ))}
      </div>
    </>
  )
}