import React, { useEffect, useState } from 'react'
import { RefreshCw, ShieldAlert, LogIn, LogOut, Camera, UserPlus, Trash2, CheckCircle, XCircle, AlertTriangle, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import { logsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'

// ─── System-level action types only ───────────────────────────────────────────
const SYSTEM_ACTIONS = [
  'LOGIN', 'LOGOUT', 'CAMERA_POWER', 'REGISTER',
  'DELETE', 'REQUEST_APPROVE', 'REQUEST_DENY', 'ATTEMPT_LIMIT', 'SPOOF_DETECTED',
]

const ACTION_META = {
  LOGIN:           { color: '#3b82f6', Icon: LogIn,       label: 'Login'           },
  LOGOUT:          { color: '#6b7280', Icon: LogOut,      label: 'Logout'          },
  CAMERA_POWER:    { color: '#f59e0b', Icon: Camera,      label: 'Camera Power'    },
  REGISTER:        { color: '#06b6d4', Icon: UserPlus,    label: 'Register'        },
  DELETE:          { color: '#ef4444', Icon: Trash2,      label: 'Delete'          },
  REQUEST_APPROVE: { color: '#22c55e', Icon: CheckCircle, label: 'Req. Approved'   },
  REQUEST_DENY:    { color: '#ef4444', Icon: XCircle,     label: 'Req. Denied'     },
  ATTEMPT_LIMIT:   { color: '#7c3aed', Icon: Lock,        label: 'Attempt Limit'   },
  SPOOF_DETECTED:  { color: '#f59e0b', Icon: AlertTriangle,label: 'Spoof Detected' },
}

// Helper: today's date as YYYY-MM-DD
const todayStr = () => new Date().toISOString().split('T')[0]

// ─── 30-day retention notice banner ───────────────────────────────────────────
function RetentionBanner() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-medium"
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        color: '#f59e0b',
      }}>
      <ShieldAlert size={14} className="shrink-0" />
      System logs are retained for <strong className="mx-1">30 days</strong>.
      Today's activity is displayed by default — use the date range to query past records.
    </div>
  )
}

// ─── Summary chips ─────────────────────────────────────────────────────────────
function SummaryChips({ data, activeFilter, onToggle }) {
  const counts = data.reduce((acc, l) => {
    acc[l.action_type] = (acc[l.action_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => {
          const meta  = ACTION_META[type] || { color: '#6b7280', Icon: ShieldAlert }
          const { color, Icon } = meta
          const active = activeFilter === type
          return (
            <button
              key={type}
              onClick={() => onToggle(type)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-all"
              style={{
                background: active ? `${color}33` : `${color}15`,
                color,
                border: `1px solid ${active ? color : `${color}40`}`,
                transform: active ? 'scale(1.04)' : 'scale(1)',
              }}>
              <Icon size={11} />
              {type} <span className="opacity-75">· {count}</span>
            </button>
          )
        })}
      {data.length > 0 && (
        <span
          className="text-xs px-3 py-1 rounded-full ml-auto"
          style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)' }}>
          Total: {data.length}
        </span>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SystemLogPage() {
  const { t } = useLang()

  const [logs,         setLogs]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [fromDate,     setFromDate]     = useState(todayStr())
  const [toDate,       setToDate]       = useState(todayStr())
  const [actionFilter, setActionFilter] = useState('')

  const load = () => {
    setLoading(true)
    const params = { action_category: 'system' }
    if (fromDate) params.from = fromDate
    if (toDate)   params.to   = toDate
    logsAPI.history(params)
      .then((r) => {
        const all = r.data.results || r.data
        // Client-side guard: only show system-type actions
        setLogs(all.filter((l) => SYSTEM_ACTIONS.includes(l.action_type)))
      })
      .catch(() => toast.error('Failed to load system logs'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleFilter = (type) => setActionFilter((prev) => (prev === type ? '' : type))

  const filtered = actionFilter
    ? logs.filter((l) => l.action_type === actionFilter)
    : logs

  // ─── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'ethiopian_time',
      label: t('timestamp') || 'Timestamp',
      render: (v) => (
        <span className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'actor_username',
      label: 'Actor',
      render: (v, row) => (
        <div>
          <p className="text-sm font-semibold">{v || '—'}</p>
          <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>{row.actor_role}</p>
        </div>
      ),
    },
    {
      key: 'action_type',
      label: t('action') || 'Action',
      render: (v) => {
        const meta  = ACTION_META[v] || { color: '#6b7280', Icon: ShieldAlert, label: v }
        const { color, Icon, label } = meta
        return (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
            <Icon size={11} />
            {label}
          </span>
        )
      },
    },
    {
      key: 'description',
      label: 'Description',
      render: (v) => (
        <span className="text-sm" style={{ color: 'var(--color-text-main)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'gate_camera_id',
      label: 'Gate / Camera',
      render: (v) => (
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{v || '—'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">

      <RetentionBanner />

      {/* ── Controls ── */}
      <div
        className="rounded-2xl p-4 flex flex-wrap items-end gap-3"
        style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                 style={{ color: 'var(--color-text-muted)' }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ameco-input py-2 text-sm"
            style={{ width: '160px' }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                 style={{ color: 'var(--color-text-muted)' }}>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ameco-input py-2 text-sm"
            style={{ width: '160px' }}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                 style={{ color: 'var(--color-text-muted)' }}>Action Type</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="ameco-input py-2 text-sm"
            style={{ width: '190px' }}>
            <option value="">All System Actions</option>
            {SYSTEM_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-muted)',
            }}>
            <RefreshCw size={14} /> {t('filter') || 'Apply'}
          </button>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <SummaryChips data={filtered} activeFilter={actionFilter} onToggle={toggleFilter} />

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchKeys={['actor_username', 'action_type', 'description', 'gate_camera_id']}
        pageSize={15}
      />
    </div>
  )
}