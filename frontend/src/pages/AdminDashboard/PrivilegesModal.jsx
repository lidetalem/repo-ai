/**
 * PrivilegesModal.jsx
 * AMECO — Privilege management modal for admins.
 * Super Admin can toggle granular permissions per admin.
 * Drop this file into: src/pages/AdminDashboard/PrivilegesModal.jsx
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Users, Shield, UserCheck, Camera,
  FileText, ClipboardList, Settings,
  UserCog, BarChart2, X, ShieldCheck,
  Loader2,
} from 'lucide-react'
import Modal from '../../components/Modal'
import { adminsAPI } from '../../services/api'

/* ─── Privilege definitions ───────────────────────────────────────────────── */
const GROUPS = [
  {
    label: 'User Management',
    color: '#3b82f6',
    items: [
      {
        key: 'manage_staff',
        icon: Users,
        title: 'Manage Staff',
        desc: 'Add, edit, and remove staff members',
      },
      {
        key: 'manage_guards',
        icon: Shield,
        title: 'Manage Guards',
        desc: 'Full control over guard accounts',
      },
      {
        key: 'manage_visitors',
        icon: UserCheck,
        title: 'Manage Visitors',
        desc: 'Handle visitor authorization & records',
      },
    ],
  },
  {
    label: 'System Control',
    color: '#f59e0b',
    items: [
      {
        key: 'manage_cameras',
        icon: Camera,
        title: 'Camera Control',
        desc: 'Add, power, and configure cameras',
      },
      {
        key: 'view_logs',
        icon: FileText,
        title: 'View Logs',
        desc: 'Access full system activity logs',
      },
      {
        key: 'review_requests',
        icon: ClipboardList,
        title: 'Review Requests',
        desc: 'Approve or deny visitor access requests',
      },
    ],
  },
  {
    label: 'Administration',
    color: '#cc0000',
    items: [
      {
        key: 'manage_settings',
        icon: Settings,
        title: 'System Settings',
        desc: 'Modify platform configuration',
      },
      {
        key: 'manage_admins',
        icon: UserCog,
        title: 'Manage Admins',
        desc: 'Register and configure other admins',
      },
      {
        key: 'view_reports',
        icon: BarChart2,
        title: 'View Reports',
        desc: 'Access analytics and reporting data',
      },
    ],
  },
]

const ALL_KEYS = GROUPS.flatMap((g) => g.items.map((i) => i.key))

/* ─── Toggle Switch ────────────────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: on ? '#cc0000' : 'var(--color-card-hover)' }}
      aria-checked={on}
      role="switch"
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  )
}

/* ─── Single Privilege Card ───────────────────────────────────────────────── */
function PrivCard({ item, active, groupColor, onChange }) {
  const Icon = item.icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-default"
      style={{
        background: active
          ? `${groupColor}12`
          : 'var(--color-card-hover)',
        border: `1px solid ${active ? groupColor + '35' : 'var(--color-border-main)'}`,
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: active ? `${groupColor}20` : 'var(--color-bg-main)',
        }}
      >
        <Icon size={16} style={{ color: active ? groupColor : 'var(--color-text-muted)' }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold truncate"
          style={{ color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
        >
          {item.title}
        </p>
        <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
          {item.desc}
        </p>
      </div>

      {/* Toggle */}
      <Toggle on={active} onChange={onChange} />
    </motion.div>
  )
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function PrivilegesModal({ admin, onClose }) {
  const [active, setActive]   = useState([])   // list of active privilege keys
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(false)

  /* Load existing privileges when modal opens */
  useEffect(() => {
    if (!admin) return
    setLoading(true)
    adminsAPI.retrieve(admin.id)
      .then((res) => {
        const priv = res.data?.privileges ?? []
        setActive(Array.isArray(priv) ? priv : [])
      })
      .catch(() => {
        // Fallback: use whatever came in the list row
        setActive(Array.isArray(admin.privileges) ? admin.privileges : [])
      })
      .finally(() => setLoading(false))
  }, [admin?.id])

  const toggle = (key) =>
    setActive((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )

  const toggleAll = () =>
    setActive((prev) => (prev.length === ALL_KEYS.length ? [] : [...ALL_KEYS]))

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminsAPI.update(admin.id, { privileges: active })
      toast.success('Privileges updated')
      onClose()
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {}).flat().join('\n') ||
        'Failed to update privileges'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const fullName = admin
    ? `${admin.first_name ?? ''} ${admin.middle_name ?? ''} ${admin.last_name ?? ''}`.trim()
    : ''

  return (
    <Modal
      open={!!admin}
      onClose={onClose}
      title="Manage Privileges"
      width="max-w-2xl"
    >
      {admin && (
        <div className="space-y-5">

          {/* Admin identity strip */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg,rgba(204,0,0,0.10),transparent)',
              border: '1px solid rgba(204,0,0,0.20)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: 'var(--color-card-hover)' }}
            >
              {admin.profile_image ? (
                <img src={admin.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black" style={{ color: '#cc0000' }}>
                  {fullName[0]?.toUpperCase() ?? 'A'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                {fullName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {admin.digital_id} · {admin.admin_tag ?? 'Admin'}
              </p>
            </div>

            {/* Active count badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
              style={{ background: 'rgba(204,0,0,0.15)', color: '#cc0000' }}
            >
              <ShieldCheck size={12} />
              {active.length} / {ALL_KEYS.length}
            </div>
          </div>

          {/* Select-all row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {active.length === ALL_KEYS.length ? 'Deselect all' : 'Select all privileges'}
            </p>
            <Toggle
              on={active.length === ALL_KEYS.length}
              onChange={toggleAll}
            />
          </div>

          {/* Loading skeleton */}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2
                size={26}
                className="animate-spin"
                style={{ color: '#cc0000' }}
              />
            </div>
          ) : (
            /* Privilege groups */
            <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
              {GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  {/* Group header */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-px flex-1"
                      style={{ background: `${group.color}30` }}
                    />
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-2"
                      style={{ color: group.color }}
                    >
                      {group.label}
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{ background: `${group.color}30` }}
                    />
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {group.items.map((item) => (
                      <PrivCard
                        key={item.key}
                        item={item}
                        active={active.includes(item.key)}
                        groupColor={group.color}
                        onChange={() => toggle(item.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 pt-3 border-t"
            style={{ borderColor: 'var(--color-border-main)' }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: 'var(--color-card-hover)',
                color: 'var(--color-text-muted)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              {saving ? 'Saving…' : 'Save Privileges'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}