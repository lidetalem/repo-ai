import React, { useState } from 'react'
import { usePrivilege } from '../../hooks/usePrivilege'
import { useLang } from '../../context/LanguageContext'
import AccessDenied from '../../components/AccessDenied'
import { ShieldCheck, ScanFace, FileText, CreditCard } from 'lucide-react'
import SystemLogPage from './Systemlogpage'
import DetectionLogPage from './Detectionlogpage'
import DownloadInfoModal from '../../components/DownloadInfoModal'

const TABS = [
  {
    id: 'system',
    label: 'System Log',
    Icon: ShieldCheck,
    color: '#3b82f6',
    description: 'Logins, logouts, camera events & admin actions',
    Component: SystemLogPage,
  },
  {
    id: 'detection',
    label: 'Detection Log',
    Icon: ScanFace,
    color: '#22c55e',
    description: 'Staff & visitor scan results — export as attendance CSV',
    Component: DetectionLogPage,
  },
]

export default function LogsPage() {
  const { hasPrivilege } = usePrivilege()
  const { t, lang } = useLang()

  const [activeTab, setActiveTab] = useState('system')
  const [downloadModal, setDownloadModal] = useState(null) // 'info' | 'idcard' | null

  const canAccess = hasPrivilege('view_logs')

  if (!canAccess) {
    return <AccessDenied privilege="view_logs" />
  }

  const active = TABS.find((t) => t.id === activeTab)
  const ActiveComponent = active.Component

  return (
    <div className="space-y-5">

      {/* ── Action buttons row ── */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setDownloadModal('info')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)', color: 'var(--color-text-main)' }}
        >
          <FileText size={14} style={{ color: '#3b82f6' }} />
          {t('downloadInfo') || 'Download Info'}
        </button>
        <button
          onClick={() => setDownloadModal('idcard')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
        >
          <CreditCard size={14} />
          {t('idDownload') || 'ID Download'}
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex gap-2 p-1.5 rounded-2xl"
        style={{
          background: 'var(--color-card-main)',
          border: '1px solid var(--color-border-main)',
        }}>
        {TABS.map(({ id, label, Icon, color, description }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{
                background: isActive ? `${color}18` : 'transparent',
                border: `1px solid ${isActive ? `${color}50` : 'transparent'}`,
              }}>
              <span
                className="p-2 rounded-lg shrink-0"
                style={{ background: isActive ? `${color}25` : 'var(--color-card-hover)' }}>
                <Icon size={16} style={{ color: isActive ? color : 'var(--color-text-muted)' }} />
              </span>
              <div className="min-w-0">
                <p
                  className="text-sm font-bold"
                  style={{ color: isActive ? color : 'var(--color-text-main)' }}>
                  {label}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Active tab content ── */}
      <ActiveComponent />

      {/* ── Download modals ── */}
      {downloadModal && (
        <DownloadInfoModal
          mode={downloadModal}
          onClose={() => setDownloadModal(null)}
        />
      )}
    </div>
  )
}