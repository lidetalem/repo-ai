/**
 * src/pages/GuardDashboard/GuardScannedPage.jsx
 * AMECO — Scanned Responses: list of everyone recognized at this guard's gate.
 * Each card shows profile, name, role, tag, with X to remove from view.
 * Clicking a card opens full detail.
 */

import React, { useEffect, useState } from 'react'
import { X, User, CheckCircle, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Modal from '../../components/Modal'
import { logsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const ROLE_COLORS = {
  admin:   '#3b82f6',
  guard:   '#8b5cf6',
  staff:   '#06b6d4',
  visitor: '#f59e0b',
  ADMIN:   '#3b82f6',
  GUARD:   '#8b5cf6',
  STAFF:   '#06b6d4',
  TEMP:    '#f59e0b',
}

export default function GuardScannedPage() {
  const { user } = useAuth()
  const { lang } = useLang()

  const [logs, setLogs]         = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ameco_dismissed_scans') || '[]') }
    catch { return [] }
  })
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    logsAPI.history()
      .then((r) => {
        const all = r.data.results || r.data
        // Only SCAN_ACCEPTED logs
        const accepted = all.filter(l => l.action_type === 'SCAN_ACCEPTED')
        setLogs(accepted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('ameco_dismissed_scans', JSON.stringify(next))
  }

  const visible = logs.filter(l => !dismissed.includes(l.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle size={18} style={{ color: '#22c55e' }} />
        <h3 className="text-lg font-black" style={{ color: 'var(--color-text-main)' }}>
          {lang === 'am' ? 'የተቃኙ ምላሾች' : 'Scanned Responses'}
        </h3>
        <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
          ({visible.length})
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#cc0000', borderTopColor: 'transparent' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
             style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>
          <CheckCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No scanned entries yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {visible.map((log) => {
              const roleColor = ROLE_COLORS[log.actor_role] || '#6b7280'
              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className="relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer group"
                  style={{
                    background: 'var(--color-card-main)',
                    border: '1px solid var(--color-border-main)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-main)'}
                  onClick={() => setSelected(log)}
                >
                  {/* Dismiss X */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(log.id) }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  >
                    <X size={11} />
                  </button>

                  {/* Profile image */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                       style={{ background: 'var(--color-card-hover)' }}>
                    {log.actor_image ? (
                      <img src={`http://127.0.0.1:8000${log.actor_image}`} alt=""
                           className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} style={{ color: 'var(--color-text-muted)' }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate"
                         style={{ color: 'var(--color-text-main)' }}>
                        {log.actor_name || log.actor_username || 'Unknown'}
                      </p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${roleColor}20`, color: roleColor }}>
                        {log.actor_role?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {log.description}
                    </p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {log.ethiopian_time}
                    </p>
                  </div>

                  {/* Access granted badge */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <CheckCircle size={14} style={{ color: '#22c55e' }} />
                    <span className="text-xs font-bold" style={{ color: '#22c55e' }}>Granted</span>
                  </div>

                  <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scan Detail" width="max-w-md">
        {selected && (
          <div className="space-y-4">
            {/* Profile image */}
            {selected.actor_image && (
              <div className="flex justify-center">
                <img
                  src={`http://127.0.0.1:8000${selected.actor_image}`}
                  alt=""
                  className="w-24 h-24 rounded-2xl object-cover"
                  style={{ border: '3px solid #22c55e' }}
                />
              </div>
            )}

            <div className="space-y-3 text-sm">
              {[
                ['Name',         selected.actor_name || selected.actor_username],
                ['Role',         selected.actor_role],
                ['Action',       selected.action_type],
                ['Description',  selected.description],
                ['Gate/Camera',  selected.gate_camera_id],
                ['Ethiopian Time', selected.ethiopian_time],
                ['UTC Time',     selected.timestamp ? new Date(selected.timestamp).toLocaleString() : '—'],
                ['Confidence',   selected.confidence ? `${selected.confidence}%` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="w-32 flex-shrink-0 font-semibold"
                        style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                  </span>
                  <span style={{ color: 'var(--color-text-main)' }}>{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}