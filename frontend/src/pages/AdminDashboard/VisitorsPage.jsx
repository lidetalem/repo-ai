import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Eye, CheckCircle, XCircle, Pencil, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import { visitorsAPI, requestsAPI, BASE_URL } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { usePrivilege } from '../../hooks/usePrivilege'
import AccessDenied from '../../components/AccessDenied'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compare current time against expiry_datetime (precise) or date_of_expiry (legacy). */
function computeStatus(row) {
  if (row.status) return row.status   // use server-computed status when available
  if (!row.is_approved) return 'Pending'
  const exp = row.expiry_datetime || row.date_of_expiry
  if (!exp) return 'Active'
  return new Date(exp) < new Date() ? 'Expired' : 'Active'
}

const STATUS_STYLE = {
  Active:  { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  Expired: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  Pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

function StatusBadge({ row }) {
  const st = computeStatus(row)
  const s  = STATUS_STYLE[st] || STATUS_STYLE.Pending
  const emoji = st === 'Active' ? '✓' : st === 'Expired' ? '⏰' : '⌛'
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: s.bg, color: s.color }}>
      {emoji} {st}
    </span>
  )
}

function Avatar({ row, size = 34 }) {
  const src = row.profile_image_url || row.profile_image
  const url = src
    ? (src.startsWith('http') ? src : `${BASE_URL}${src}`)
    : null
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
      background: 'var(--color-card-hover)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontWeight: 700, fontSize: size * 0.38, color: '#f59e0b' }}>
            {row.first_name?.[0]?.toUpperCase() || '?'}
          </span>
      }
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VisitorsPage() {
  const { t } = useLang()
  const { hasPrivilege } = usePrivilege()

  const [visitors, setVisitors]       = useState([])
  const [requests, setRequests]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('visitors')
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [selected, setSelected]       = useState(null)
  const [viewItem, setViewItem]       = useState(null)
  const [denyModal, setDenyModal]     = useState(null)
  const [denyReason, setDenyReason]   = useState('')
  const [extendModal, setExtendModal] = useState(null)
  const [newExpiry, setNewExpiry]     = useState('')

  const canAccess = hasPrivilege('manage_visitors')

  const load = useCallback(() => {
    if (!canAccess) return
    setLoading(true)
    Promise.all([visitorsAPI.list(), requestsAPI.list()])
      .then(([v, r]) => {
        const raw = v.data.results || v.data
        // Normalise image URLs
        const norm = (raw || []).map((item) => {
          const src = item.profile_image_url || item.profile_image
          return {
            ...item,
            _avatarUrl: src
              ? (src.startsWith('http') ? src : `${BASE_URL}${src}`)
              : null,
          }
        })
        setVisitors(norm)
        setRequests(r.data.results || r.data)
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [canAccess])

  useEffect(() => { load() }, [load])

  if (!canAccess) return <AccessDenied privilege="manage_visitors" />

  // ── Save / Edit ───────────────────────────────────────────────────────────

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (selected) {
        await visitorsAPI.update(selected.id, form)
        toast.success('Saved Successfully')
      } else {
        await visitorsAPI.create(form)
        toast.success('Visitor added — awaiting approval if submitted by guard')
      }
      setSelected(null)
      setShowForm(false)
      load()
    } catch (err) {
      const msg = err.response?.data?.detail
        || Object.values(err.response?.data || {}).flat().join('\n')
        || 'Save failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await visitorsAPI.delete(id)
      toast.success('Deleted successfully')
      load()
    } catch { toast.error('Delete failed') }
  }

  const handleExtendExpiry = async () => {
    if (!newExpiry) { toast.error('Please select a new expiry date/time'); return }
    try {
      // Send as expiry_datetime (ISO with seconds)
      await visitorsAPI.update(extendModal.id, {
        expiry_datetime: new Date(newExpiry).toISOString(),
        date_of_expiry:  newExpiry.split('T')[0],
      })
      toast.success('Expiry extended — visitor access restored')
      setExtendModal(null)
      setNewExpiry('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update expiry')
    }
  }

  // ── Request actions ───────────────────────────────────────────────────────

  const handleApprove = async (id) => {
    try {
      await requestsAPI.updateStatus(id, { status: 'APPROVED' })
      toast.success('Request approved')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to approve')
    }
  }

  const handleDeny = async () => {
    try {
      await requestsAPI.updateStatus(denyModal, { status: 'REJECTED', denial_reason: denyReason })
      toast.success('Request denied')
      setDenyModal(null)
      setDenyReason('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to deny')
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────

  const visitorCols = [
    {
      key: '_avatarUrl',
      label: '',
      render: (_, row) => <Avatar row={row} />,
    },
    {
      key: 'first_name',
      label: 'Name',
      render: (_, row) => (
        <div>
          <p className="font-semibold text-sm">
            {row.first_name} {row.middle_name} {row.last_name}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.digital_id}</p>
        </div>
      ),
    },
    { key: 'phone', label: t('phone') },
    {
      key: 'expiry_datetime',
      label: 'Expiry',
      render: (v, row) => {
        const dt = v || row.date_of_expiry
        if (!dt) return <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>—</span>
        return (
          <span className="text-xs font-mono">
            {new Date(dt).toLocaleString()}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <StatusBadge row={row} />,
    },
  ]

  const requestCols = [
    {
      key: 'visitor_name',
      label: 'Visitor',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          {row.visitor_image && (
            <img src={row.visitor_image.startsWith('http') ? row.visitor_image : `${BASE_URL}${row.visitor_image}`}
                 alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          )}
          <span className="font-semibold">{v || '—'}</span>
        </div>
      ),
    },
    { key: 'guard_username', label: 'Guard' },
    { key: 'reason', label: t('reason') },
    { key: 'start_date', label: t('startDate') },
    { key: 'end_date',   label: t('endDate') },
    {
      key: 'status',
      label: t('status'),
      render: (v) => {
        const colors = { PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444' }
        return (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${colors[v]}22`, color: colors[v] }}>
            {v}
          </span>
        )
      },
    },
  ]

  // Only show APPROVED visitors in the main visitors tab
  const approvedVisitors = visitors.filter((v) => v.is_approved || v.status === 'Active' || v.status === 'Expired')
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['visitors', 'requests'].map((tab_) => (
            <button
              key={tab_}
              onClick={() => setTab(tab_)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === tab_
                  ? 'linear-gradient(135deg,#cc0000,#aa0000)'
                  : 'var(--color-card-main)',
                color: tab === tab_ ? 'white' : 'var(--color-text-muted)',
                border: tab === tab_ ? 'none' : '1px solid var(--color-border-main)',
              }}
            >
              {tab_ === 'visitors' ? t('visitors') : t('visitorRequest')}
              {tab_ === 'requests' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                      style={{ background: '#ef4444', color: 'white' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'visitors' && (
          <button
            onClick={() => { setSelected(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
          >
            <Plus size={15} /> {t('addNew')}
          </button>
        )}
      </div>

      {/* Tables */}
      {tab === 'visitors' ? (
        <DataTable
          columns={visitorCols}
          data={approvedVisitors}
          loading={loading}
          searchKeys={['first_name', 'last_name', 'digital_id', 'phone']}
          actions={(row) => {
            const st = computeStatus(row)
            return (
              <>
                <button onClick={() => { setSelected(row); setShowForm(true) }}
                        className="p-1.5 rounded-lg" style={{ color: '#f59e0b' }} title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => setViewItem(row)}
                        className="p-1.5 rounded-lg" style={{ color: '#3b82f6' }} title="View">
                  <Eye size={14} />
                </button>
                {st === 'Expired' && (
                  <button
                    onClick={() => {
                      setExtendModal(row)
                      const cur = row.expiry_datetime || row.date_of_expiry
                      setNewExpiry(cur ? cur.slice(0, 16) : '')
                    }}
                    className="p-1.5 rounded-lg" style={{ color: '#f97316' }} title="Extend Expiry">
                    <CalendarClock size={14} />
                  </button>
                )}
                <button onClick={() => handleDelete(row.id)}
                        className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </>
            )
          }}
        />
      ) : (
        <DataTable
          columns={requestCols}
          data={requests}
          loading={loading}
          searchKeys={['visitor_name', 'guard_username']}
          actions={(row) => row.status === 'PENDING' ? (
            <>
              <button onClick={() => handleApprove(row.id)}
                      className="p-1.5 rounded-lg" style={{ color: '#22c55e' }} title="Approve">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => { setDenyModal(row.id); setDenyReason('') }}
                      className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Deny">
                <XCircle size={14} />
              </button>
            </>
          ) : null}
        />
      )}

      {/* Register / Edit Modal */}
      <Modal open={showForm} onClose={() => { setSelected(null); setShowForm(false) }}
             title={selected ? 'Edit Visitor' : t('registerVisitor')} width="max-w-3xl">
        <RegistrationForm
          key={selected?.id ?? 'new-visitor'}
          type="visitor"
          initialData={selected}
          editing={!!selected}
          onSubmit={handleSave}
          onCancel={() => { setSelected(null); setShowForm(false) }}
          loading={saving}
        />
      </Modal>

      {/* View Detail Modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Visitor Details">
        {viewItem && (
          <div className="space-y-4">
            {/* Header with avatar */}
            <div className="flex items-center gap-4 p-4 rounded-2xl"
                 style={{ background: 'var(--color-card-hover)' }}>
              <Avatar row={viewItem} size={60} />
              <div>
                <p className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {viewItem.first_name} {viewItem.middle_name} {viewItem.last_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {viewItem.digital_id}
                </p>
                <div className="mt-1"><StatusBadge row={viewItem} /></div>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-2 text-sm">
              {[
                ['Phone',        viewItem.phone],
                ['Email',        viewItem.email],
                ['Reason',       viewItem.reason],
                ['Start Date',   viewItem.date_of_first_entry
                  ? new Date(viewItem.date_of_first_entry).toLocaleDateString() : '—'],
                ['Expiry',       (viewItem.expiry_datetime || viewItem.date_of_expiry)
                  ? new Date(viewItem.expiry_datetime || viewItem.date_of_expiry).toLocaleString() : '—'],
                ['Registered By', viewItem.registered_by],
                ['Registered At', viewItem.registered_at
                  ? new Date(viewItem.registered_at).toLocaleString() : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="w-36 flex-shrink-0 font-semibold"
                        style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--color-text-main)' }}>{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Deny Request Modal */}
      <Modal open={!!denyModal} onClose={() => setDenyModal(null)} title="Deny Request" width="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase"
                   style={{ color: 'var(--color-text-muted)' }}>
              {t('denialReason')}
            </label>
            <textarea
              className="ameco-input"
              rows={3}
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Reason for denial…"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDenyModal(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)',
                             border: '1px solid var(--color-border-main)' }}>
              {t('cancel')}
            </button>
            <button onClick={handleDeny}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#ef4444' }}>
              {t('deny')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Extend Expiry Modal */}
      <Modal open={!!extendModal}
             onClose={() => { setExtendModal(null); setNewExpiry('') }}
             title="Extend Visitor Expiry" width="max-w-md">
        {extendModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl"
                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Avatar row={extendModal} size={40} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                  ⏰ {extendModal.first_name} {extendModal.last_name} — access has expired
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Expired: {(extendModal.expiry_datetime || extendModal.date_of_expiry)
                    ? new Date(extendModal.expiry_datetime || extendModal.date_of_expiry).toLocaleString()
                    : '—'}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase"
                     style={{ color: 'var(--color-text-muted)' }}>
                New Expiry Date &amp; Time
              </label>
              <input
                type="datetime-local"
                className="ameco-input w-full"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                step="1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setExtendModal(null); setNewExpiry('') }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)',
                               border: '1px solid var(--color-border-main)' }}>
                Cancel
              </button>
              <button onClick={handleExtendExpiry}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
                Extend Access
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}