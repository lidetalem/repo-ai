import React from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { useLang } from '../../context/LanguageContext'

const TYPE_COLORS = {
  new_request:         '#f59e0b',
  request_approved:    '#22c55e',
  request_denied:      '#ef4444',
  camera_update:       '#3b82f6',
  system:              '#6b7280',
  new_visitor_request: '#f59e0b',
  request_decision:    '#22c55e',
  camera_power:        '#3b82f6',
}

export default function NotificationsPage() {
  const { t } = useLang()
  const { notifications, markAllRead, dismiss } = useNotifications()

  // Always safe array — never call .filter on something that might not be an array
  const safeList = Array.isArray(notifications) ? notifications : []
  const unread   = safeList.filter((n) => !n.is_read)

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} style={{ color: 'var(--color-ameco-red)' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
            {t('notifications')}
          </h3>
          {unread.length > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(204,0,0,0.15)', color: '#cc0000' }}>
              {unread.length} unread
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
            style={{
              background: 'var(--color-card-main)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-muted)',
            }}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Empty state */}
      {safeList.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{
            background: 'var(--color-card-main)',
            border: '1px solid var(--color-border-main)',
          }}>
          <Bell size={32} className="mx-auto mb-3"
                style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No notifications yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {safeList.map((n) => {
            const color = TYPE_COLORS[n.notification_type] || '#6b7280'
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-4 rounded-2xl transition-all"
                style={{
                  background: n.is_read
                    ? 'var(--color-card-main)'
                    : `${color}10`,
                  border: n.is_read
                    ? '1px solid var(--color-border-main)'
                    : `1px solid ${color}44`,
                }}>

                {/* Unread dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{
                    background: n.is_read
                      ? 'var(--color-text-muted)'
                      : color,
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold"
                     style={{ color: 'var(--color-text-main)' }}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs mt-0.5"
                       style={{ color: 'var(--color-text-muted)' }}>
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs mt-1.5"
                     style={{ color: 'var(--color-text-muted)' }}>
                    {n.created_at
                      ? new Date(n.created_at).toLocaleString()
                      : ''}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => dismiss(n.id)}
                  className="p-1 rounded-lg flex-shrink-0 transition-all"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) =>
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={(e) =>
                    e.currentTarget.style.background = 'transparent'}>
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}