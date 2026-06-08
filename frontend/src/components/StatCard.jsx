import React from 'react'

export default function StatCard({ icon: Icon, label, value, color = '#cc0000', trend }) {
  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-4 transition-all duration-200"
      style={{
        background: 'var(--color-card-main)',
        border: '1px solid var(--color-border-main)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = color}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-main)'}>

      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}20` }}>
        <Icon size={22} style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider truncate"
           style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--color-text-main)' }}>
          {value ?? '—'}
        </p>
        {trend !== undefined && (
          <p className="text-xs mt-0.5" style={{ color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} today
          </p>
        )}
      </div>
    </div>
  )
}