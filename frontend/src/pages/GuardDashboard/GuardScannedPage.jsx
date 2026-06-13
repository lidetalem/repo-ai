/**
 * src/pages/GuardDashboard/GuardScannedPage.jsx
 * AMECO — Scanned Responses: list of everyone recognized at this guard's gate.
 * Each card shows profile, name, role, tag, with X to remove from view.
 * Clicking a card opens full detail.
 */

import React, { useEffect, useState } from 'react'
import { X, User, CheckCircle, ChevronRight, CreditCard, FileText, Download } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Modal from '../../components/Modal'
import { logsAPI, BASE_URL } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import wsManager from '../../services/websocket'
import DownloadInfoModal from '../../components/DownloadInfoModal'
import { formatBackendDate } from '../../utils/ethiopianTime'

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
  const [downloadModal, setDownloadModal] = useState(null)
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
    // Subscribe to live websocket pushes for new scans
    const unsub = wsManager.on('*', (data) => {
      try {
        if (!data.type) return
        const t = String(data.type).toUpperCase()
        if (!t.includes('SCAN_ACCEPT')) return
        // Build a log-like object compatible with the list; include any provided
        // `person` payload so the guard can view full details or download ID.
        const personPayload = data.person || data.person_detail || data.person_payload || null
        const actorImage = data.actor_image || data.image || (personPayload && (personPayload.profile_image || personPayload.profile)) || null
        const actorImageUrl = actorImage && actorImage.startsWith ? (actorImage.startsWith('http') ? actorImage : `${BASE_URL}${actorImage}`) : actorImage

        const entry = {
          id: data.id || Date.now(),
          actor_name: data.name || data.guard || data.actor_name || data.actor_username,
          actor_username: data.actor_username,
          actor_image: actorImageUrl,
          actor_role: data.role || data.actor_role || data.role_name || 'visitor',
          description: data.visitor_name || data.message || data.description || '',
          action_type: 'SCAN_ACCEPTED',
          ethiopian_time: data.ethiopian_time || formatBackendDate(new Date(), lang),
          timestamp: data.timestamp || new Date().toISOString(),
          gate_camera_id: data.gate_camera_id || data.camera_id || data.terminal_id,
          confidence: data.confidence,
          digital_id_card_image: data.digital_id_card_image,
          id_card_generated: data.id_card_generated,
          person: personPayload,
        }
        setLogs(prev => [entry, ...prev].slice(0, 100))
      } catch (_) {}
    })
    return () => unsub && unsub()
  }, [])

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('ameco_dismissed_scans', JSON.stringify(next))
  }

  const visible = logs.filter(l => !dismissed.includes(l.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-1">
        <CheckCircle size={18} style={{ color: '#22c55e' }} />
        <h3 className="text-lg font-black" style={{ color: 'var(--color-text-main)' }}>
          {lang === 'am' ? 'የተቃኙ ምላሾች' : 'Scanned Responses'}
        </h3>
        <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
          ({visible.length})
        </span>
      </div>
      <button
        onClick={() => setDownloadModal('idcard')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white ml-auto shrink-0"
        style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
      >
        <CreditCard size={14} />
        {lang === 'am' ? 'መታወቂያ አውርድ' : 'ID Download'}
      </button>

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
                     <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
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
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
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
                  <div className="flex items-center gap-1 shrink-0">
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

      {/* Detail Modal — enhanced */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Scan Detail" width="max-w-lg">
        {selected && (
          <div className="space-y-4">
            {/* Profile image */}
            {selected.actor_image && (
              <div className="flex justify-center">
                <img
                  src={selected.actor_image.startsWith('http') ? selected.actor_image : `${BASE_URL}${selected.actor_image}`}
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
                ['Ethiopian Time', selected.ethiopian_time || (selected.timestamp ? formatBackendDate(selected.timestamp, lang) : '—')],
                ['Confidence',   selected.confidence ? `${selected.confidence}%` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="w-32 shrink-0 font-semibold"
                        style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                  </span>
                  <span style={{ color: 'var(--color-text-main)' }}>{value || '—'}</span>
                </div>
              ))}
            </div>

            {/* Digital ID Card image if available */}
            {(selected.digital_id_card_image || selected.id_card_generated) && (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                   style={{ color: 'var(--color-text-muted)' }}>Digital ID Card</p>
                <img
                  src={`${BASE_URL}${selected.digital_id_card_image || selected.id_card_generated}`}
                  alt="Digital ID Card"
                  className="w-full rounded-2xl object-contain"
                  style={{ border: '1px solid var(--color-border-main)', maxHeight: 200 }}
                />
              </div>
            )}

            {/* Download exact ID for this scan */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const initialPerson = selected.person || {
                    profile_image: selected.actor_image && (selected.actor_image.startsWith('http') ? selected.actor_image : `${BASE_URL}${selected.actor_image}`),
                    digital_id_card_image: selected.digital_id_card_image || selected.id_card_generated,
                    first_name: selected.actor_name || selected.actor_username,
                    digital_id: selected.actor_username,
                    id_card_generated: selected.id_card_generated,
                  }
                  window.__initialDownloadPerson__ = initialPerson
                  setDownloadModal('idcard')
                  setSelected(null)
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
              >
                <Download size={14} />&nbsp;Download ID
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Download Modal */}
      {downloadModal && (
        <DownloadInfoModal
          mode={downloadModal}
          onClose={() => setDownloadModal(null)}
        />
      )}
    </div>
  )
}