/**
 * PrivilegesSection.jsx
 * AMECO — Inline privilege checklist for the admin add/edit form.
 * Place at: src/pages/AdminDashboard/PrivilegesSection.jsx
 *
 * Props:
 *   value    — string[]  currently checked privilege keys
 *   onChange — (keys: string[]) => void
 */

import React from 'react'
import {
  Users, Shield, UserCheck, Camera,
  FileText, ClipboardList, Settings,
  UserCog, BarChart2,
} from 'lucide-react'

/* ─── Privilege definitions ─────────────────────────────────────────────── */
export const PRIVILEGE_GROUPS = [
  {
    label: 'User Management',
    color: '#3b82f6',
    items: [
      { key: 'manage_staff',    icon: Users,        title: 'Manage Staff',    desc: 'Add, edit & remove staff' },
      { key: 'manage_guards',   icon: Shield,       title: 'Manage Guards',   desc: 'Full guard account control' },
      { key: 'manage_visitors', icon: UserCheck,    title: 'Manage Visitors', desc: 'Visitor authorization & records' },
    ],
  },
  {
    label: 'System Control',
    color: '#f59e0b',
    items: [
      { key: 'manage_cameras',  icon: Camera,       title: 'Camera Control',  desc: 'Add, power & configure cameras' },
      { key: 'view_logs',       icon: FileText,     title: 'View Logs',       desc: 'Full system activity logs' },
      { key: 'review_requests', icon: ClipboardList,title: 'Review Requests', desc: 'Approve or deny access requests' },
    ],
  },
  {
    label: 'Administration',
    color: '#cc0000',
    items: [
      { key: 'manage_settings', icon: Settings,     title: 'System Settings', desc: 'Modify platform configuration' },
      { key: 'manage_admins',   icon: UserCog,      title: 'Manage Admins',   desc: 'Register & configure admins' },
      { key: 'view_reports',    icon: BarChart2,    title: 'View Reports',    desc: 'Analytics & reporting data' },
    ],
  },
]

export const ALL_PRIVILEGE_KEYS = PRIVILEGE_GROUPS.flatMap(g => g.items.map(i => i.key))

/* ─── Single checkbox row ───────────────────────────────────────────────── */
function PrivRow({ item, checked, color, onToggle }) {
  const Icon = item.icon
  const id = `priv-${item.key}`

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all select-none"
      style={{
        background: checked ? `${color}10` : 'transparent',
        border: `1px solid ${checked ? color + '30' : 'var(--color-border-main)'}`,
      }}
    >
      {/* Custom checkbox */}
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: checked ? color : 'transparent',
          border: `2px solid ${checked ? color : 'var(--color-text-muted)'}`,
        }}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />

      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: checked ? `${color}18` : 'var(--color-card-hover)' }}
      >
        <Icon size={13} style={{ color: checked ? color : 'var(--color-text-muted)' }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold leading-tight"
          style={{ color: checked ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
        >
          {item.title}
        </p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {item.desc}
        </p>
      </div>
    </label>
  )
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function PrivilegesSection({ value = [], onChange }) {
  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])

  const allChecked = value.length === ALL_PRIVILEGE_KEYS.length

  const toggleAll = () =>
    onChange(allChecked ? [] : [...ALL_PRIVILEGE_KEYS])

  return (
    <div className="space-y-4">

      {/* Section header */}
      <div
        className="flex items-center justify-between px-1 py-2 rounded-xl"
        style={{
          borderTop: '1px solid var(--color-border-main)',
          paddingTop: '16px',
        }}
      >
        <div>
          <p className="text-sm font-black" style={{ color: 'var(--color-text-main)' }}>
            Privileges
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {value.length === 0
              ? 'No privileges assigned'
              : `${value.length} of ${ALL_PRIVILEGE_KEYS.length} selected`}
          </p>
        </div>

        {/* Select-all checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {allChecked ? 'Deselect all' : 'Select all'}
          </span>
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: allChecked ? '#cc0000' : 'transparent',
              border: `2px solid ${allChecked ? '#cc0000' : 'var(--color-text-muted)'}`,
            }}
            onClick={toggleAll}
          >
            {allChecked && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </label>
      </div>

      {/* Groups */}
      {PRIVILEGE_GROUPS.map(group => (
        <div key={group.label} className="space-y-2">

          {/* Group label */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: `${group.color}25` }} />
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: group.color }}
            >
              {group.label}
            </span>
            <div className="h-px flex-1" style={{ background: `${group.color}25` }} />
          </div>

          {/* 3-col grid of checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {group.items.map(item => (
              <PrivRow
                key={item.key}
                item={item}
                checked={value.includes(item.key)}
                color={group.color}
                onToggle={() => toggle(item.key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}