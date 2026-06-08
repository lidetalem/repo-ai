import React, { useState } from 'react'
import { usePrivilege } from '../../hooks/usePrivilege'
import AccessDenied from '../../components/AccessDenied'
import { ShieldCheck, ScanFace } from 'lucide-react'
import SystemLogPage from './Systemlogpage'
import DetectionLogPage from './Detectionlogpage'

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

  // ALL hooks before any conditional return
  const [activeTab, setActiveTab] = useState('system')

  const canAccess = hasPrivilege('view_logs')

  // Now safe to conditionally render
  if (!canAccess) {
    return <AccessDenied privilege="view_logs" />
  }

  const active = TABS.find((t) => t.id === activeTab)
  const ActiveComponent = active.Component

  return (
    <div className="space-y-5">

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
    </div>
  )
}