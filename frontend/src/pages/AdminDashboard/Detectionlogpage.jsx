import React, { useEffect, useState, useMemo } from 'react'
import { Download, RefreshCw, CheckCircle, XCircle, Users, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import { logsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'

// ─── Detection-only action types ──────────────────────────────────────────────
const DETECTION_ACTIONS = ['SCAN_ACCEPTED', 'SCAN_REJECTED']

const RESULT_META = {
  SCAN_ACCEPTED: { color: '#22c55e', Icon: CheckCircle, label: 'Accepted' },
  SCAN_REJECTED: { color: '#ef4444', Icon: XCircle,     label: 'Rejected' },
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, color, label, value }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-5 py-3 flex-1 min-w-[130px]"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}30`,
      }}>
      <span
        className="p-2 rounded-xl"
        style={{ background: `${color}22` }}>
        <Icon size={16} style={{ color }} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${color}bb` }}>{label}</p>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DetectionLogPage() {
  const { t } = useLang()

  const [logs,         setLogs]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')
  const [resultFilter, setResultFilter] = useState('')   // SCAN_ACCEPTED | SCAN_REJECTED | ''
  const [personFilter, setPersonFilter] = useState('')   // staff | visitor | ''

  const load = () => {
    setLoading(true)
    const params = { action_category: 'detection' }
    if (fromDate) params.from = fromDate
    if (toDate)   params.to   = toDate
    logsAPI.history(params)
      .then((r) => {
        const all = r.data.results || r.data
        setLogs(all.filter((l) => DETECTION_ACTIONS.includes(l.action_type)))
      })
      .catch(() => toast.error('Failed to load detection logs'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    logs.length,
    accepted: logs.filter((l) => l.action_type === 'SCAN_ACCEPTED').length,
    rejected: logs.filter((l) => l.action_type === 'SCAN_REJECTED').length,
  }), [logs])

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let d = logs
    if (resultFilter) d = d.filter((l) => l.action_type === resultFilter)
    if (personFilter) d = d.filter((l) =>
      (l.actor_role || '').toLowerCase() === personFilter.toLowerCase()
    )
    return d
  }, [logs, resultFilter, personFilter])

  // ── CSV export ───────────────────────────────────────────────────────────────
  const handleDownloadCSV = async () => {
    try {
      // Prefer a backend endpoint; fall back to client-side CSV generation
      try {
        const params = { action_category: 'detection' }
        if (fromDate) params.from = fromDate
        if (toDate)   params.to   = toDate
        const response = await logsAPI.exportCsv(params)
        const url  = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href  = url
        link.setAttribute('download', `ameco_attendance_${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast.success('Attendance CSV downloaded!')
        return
      } catch {
        // Fall through to client-side generation
      }

      // ── Client-side CSV generation from filtered data ──
      const headers = [
        'Date/Time (ET)', 'Name', 'Role', 'Result', 'Direction',
        'Gate / Camera', 'Confidence (%)', 'Description',
      ]
      const rows = filtered.map((l) => [
        l.ethiopian_time   || '',
        l.actor_username   || '',
        l.actor_role       || '',
        l.action_type      || '',
        l.direction        || '',
        l.gate_camera_id   || '',
        l.confidence != null ? l.confidence : '',
        (l.description     || '').replace(/,/g, ';'),
      ])

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url  = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `ameco_attendance_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Attendance CSV downloaded!')
    } catch {
      toast.error('CSV export failed')
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'ethiopian_time',
      label: t('timestamp') || 'Date / Time (ET)',
      render: (v) => (
        <span className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'actor_username',
      label: 'Name',
      render: (v, row) => (
        <div>
          <p className="text-sm font-semibold">{v || '—'}</p>
          <p
            className="text-xs capitalize font-medium"
            style={{
              color: row.actor_role?.toLowerCase() === 'visitor' ? '#f59e0b' : '#3b82f6',
            }}>
            {row.actor_role || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'action_type',
      label: 'Result',
      render: (v) => {
        const meta = RESULT_META[v] || { color: '#6b7280', Icon: CheckCircle, label: v }
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
      key: 'direction',
      label: 'In / Out',
      render: (v) => {
        if (!v) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        const isIn = String(v).toUpperCase() === 'IN'
        return (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              color: isIn ? '#22c55e' : '#f59e0b',
              background: isIn ? '#22c55e18' : '#f59e0b18',
            }}>
            {String(v).toUpperCase()}
          </span>
        )
      },
    },
    {
      key: 'gate_camera_id',
      label: 'Gate / Camera',
      render: (v) => (
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'confidence',
      label: t('confidence') || 'Confidence',
      render: (v) => {
        if (v == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        const color = v >= 85 ? '#22c55e' : v >= 65 ? '#f59e0b' : '#ef4444'
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full overflow-hidden"
                 style={{ background: 'var(--color-card-hover)' }}>
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${v}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{v}%</span>
          </div>
        )
      },
    },
    {
      key: 'description',
      label: 'Note',
      render: (v) => (
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{v || '—'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">

      {/* ── Stat cards ── */}
      <div className="flex flex-wrap gap-3">
        <StatCard icon={Users}     color="#3b82f6" label="Total Scans"  value={stats.total}    />
        <StatCard icon={UserCheck} color="#22c55e" label="Accepted"     value={stats.accepted} />
        <StatCard icon={UserX}     color="#ef4444" label="Rejected"     value={stats.rejected} />
      </div>

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
                 style={{ color: 'var(--color-text-muted)' }}>Result</label>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="ameco-input py-2 text-sm"
            style={{ width: '160px' }}>
            <option value="">All Results</option>
            <option value="SCAN_ACCEPTED">Accepted</option>
            <option value="SCAN_REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                 style={{ color: 'var(--color-text-muted)' }}>Person Type</label>
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="ameco-input py-2 text-sm"
            style={{ width: '160px' }}>
            <option value="">Staff & Visitors</option>
            <option value="staff">Staff Only</option>
            <option value="visitor">Visitors Only</option>
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

          <button
            onClick={handleDownloadCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
            <Download size={14} /> Download Attendance CSV
          </button>
        </div>
      </div>

      {/* ── Result summary chips ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {['SCAN_ACCEPTED', 'SCAN_REJECTED'].map((type) => {
          const count  = filtered.filter((l) => l.action_type === type).length
          if (!count) return null
          const { color, Icon, label } = RESULT_META[type]
          const active = resultFilter === type
          return (
            <button
              key={type}
              onClick={() => setResultFilter((p) => (p === type ? '' : type))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-all"
              style={{
                background: active ? `${color}30` : `${color}15`,
                color,
                border: `1px solid ${active ? color : `${color}40`}`,
              }}>
              <Icon size={11} /> {label} · {count}
            </button>
          )
        })}
        {filtered.length > 0 && (
          <span
            className="text-xs px-3 py-1 rounded-full ml-auto"
            style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)' }}>
            Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchKeys={['actor_username', 'actor_role', 'gate_camera_id', 'description']}
        pageSize={15}
      />
    </div>
  )
}