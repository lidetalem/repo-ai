/**
 * GuardVisitorRequestsPage.jsx
 *
 * Unified page that merges GuardVisitorsPage + GuardRequestsPage.
 *
 * USAGE IN GuardDashboard.jsx:
 *   1. Replace the two separate route/nav entries for "visitors" and "requests"
 *      with a single entry pointing here.
 *   2. Update NAV:
 *       { key:'visitors', icon:Users, path:'/guard/visitors', exact:false, badge:null }
 *   3. Update Routes:
 *       <Route path="visitors/*" element={<GuardVisitorRequestsPage />} />
 *   4. Remove GuardRequestsPage import and route entirely.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus, Eye, Trash2, Send, Clock, CheckCircle, XCircle,
  Users, ClipboardList, Search, X, Camera, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import { requestsAPI, visitorsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import wsManager from '../../services/websocket'

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:  { color: '#f59e0b', icon: Clock,        label: 'Pending'  },
  APPROVED: { color: '#22c55e', icon: CheckCircle,   label: 'Approved' },
  REJECTED: { color: '#ef4444', icon: XCircle,       label: 'Denied'   },
}

function fullName(v) {
  return [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(' ')
}

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}
    >
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5 font-semibold" style={{ color }}>{label}</p>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function GuardVisitorRequestsPage() {
  const { t }    = useLang()
  const { user } = useAuth()

  // ── data state
  const [visitors, setVisitors]   = useState([])
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)

  // ── ui state
  const [tab, setTab]             = useState('visitors')   // 'visitors' | 'requests'
  const [showRegister, setShowRegister] = useState(false)  // new visitor + request modal
  const [showRequest,  setShowRequest]  = useState(false)  // quick request for existing visitor
  const [viewVisitor,  setViewVisitor]  = useState(null)   // visitor detail modal
  const [viewRequest,  setViewRequest]  = useState(null)   // request detail modal
  const [saving, setSaving]       = useState(false)

  // ── request form state (for "quick request" on existing visitor)
  const [selectedVisitorId, setSelectedVisitorId] = useState('')
  const [reqForm, setReqForm] = useState({ reason: '', start_date: '', end_date: '' })

  // ── photo ref for registration form override
  const photoRef = useRef(null)

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([visitorsAPI.list(), requestsAPI.list()])
      .then(([v, r]) => {
        setVisitors(v.data.results ?? v.data)
        setRequests(r.data.results ?? r.data)
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  // Real-time: admin approves / rejects a request
  useEffect(() => {
    const unsub = wsManager.on('request_decision', (data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.request_id
            ? { ...r, status: data.status, denial_reason: data.denial_reason }
            : r
        )
      )
      const msg =
        data.status === 'APPROVED'
          ? `✅ Request for ${data.visitor_name} approved!`
          : `❌ Request for ${data.visitor_name} denied.`
      toast(msg)
    })
    return unsub
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  /** Register a new visitor AND immediately submit an access request. */
  const handleRegister = async (form) => {
    setSaving(true)
    try {
      const res = await visitorsAPI.create({
        ...form,
        registered_by: user?.username || 'guard',
      })
      const newVisitor = res.data

      // Auto-submit request for this new visitor
      await requestsAPI.create({
        temp_user:  newVisitor.id,
        reason:     form.reason     || '',
        start_date: form.date_of_first_entry ? (form.date_of_first_entry.split('T')[0]) : '',
        end_date:   form.date_of_expiry      ? (form.date_of_expiry.split('T')[0]) : '',
      })

      toast.success('Visitor registered & request sent!')
      setShowRegister(false)
      load()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Registration failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  /** Submit a standalone access request for an already-registered visitor. */
  const handleSendRequest = async (e) => {
    e.preventDefault()
    if (!selectedVisitorId) { toast.error('Please select a visitor'); return }
    setSaving(true)
    try {
      await requestsAPI.create({
        temp_user:  parseInt(selectedVisitorId, 10),
        reason:     reqForm.reason,
        start_date: reqForm.start_date ? (reqForm.start_date.split('T')[0]) : '',
        end_date:   reqForm.end_date   ? (reqForm.end_date.split('T')[0])   : '',
      })
      toast.success('Request submitted!')
      setShowRequest(false)
      setSelectedVisitorId('')
      setReqForm({ reason: '', start_date: '', end_date: '' })
      load()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Submission failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVisitor = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await visitorsAPI.delete(id)
      toast.success('Visitor deleted')
      load()
    } catch {
      toast.error('Delete failed')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived stats
  // ─────────────────────────────────────────────────────────────────────────

  const pending  = requests.filter((r) => r.status === 'PENDING').length
  const approved = requests.filter((r) => r.status === 'APPROVED').length
  const denied   = requests.filter((r) => r.status === 'REJECTED').length
  const today    = new Date().toISOString().split('T')[0]

  // ─────────────────────────────────────────────────────────────────────────
  // Table column definitions
  // ─────────────────────────────────────────────────────────────────────────

  const visitorColumns = [
    {
      key: 'profile_image',
      label: '',
      render: (v, row) => (
        <div
          className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--color-card-hover)' }}
        >
          {v
            ? <img src={v} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>
                {row.first_name?.[0]?.toUpperCase()}
              </span>
          }
        </div>
      ),
    },
    {
      key: 'first_name',
      label: t('name'),
      render: (_, row) => (
        <div>
          <p className="font-semibold text-sm">{fullName(row)}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.digital_id}</p>
        </div>
      ),
    },
    { key: 'phone', label: t('phone') },
    {
      key: 'date_of_expiry',
      label: t('endDate'),
      render: (v) => {
        if (!v) return '—'
        const expired = v < today
        return (
          <span className="text-xs font-semibold" style={{ color: expired ? '#ef4444' : '#22c55e' }}>
            {v} {expired ? '(Expired)' : ''}
          </span>
        )
      },
    },
    {
      key: 'reason',
      label: t('reason'),
      render: (v) => (
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{v || '—'}</span>
      ),
    },
  ]

  const requestColumns = [
    {
      key: 'visitor_name',
      label: t('visitor'),
      render: (v, row) => (
        <div className="flex items-center gap-2">
          {row.visitor_image && (
            <img src={row.visitor_image} alt=""
                 className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-sm">{v || '—'}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.visitor_phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      label: t('reason'),
      render: (v) => (
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{v || '—'}</span>
      ),
    },
    { key: 'start_date', label: t('startDate') },
    { key: 'end_date',   label: t('endDate')   },
    {
      key: 'status',
      label: t('status'),
      render: (v) => {
        const cfg  = STATUS_CONFIG[v] || STATUS_CONFIG.PENDING
        const Icon = cfg.icon
        return (
          <div className="flex items-center gap-1.5">
            <Icon size={13} style={{ color: cfg.color }} />
            <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
        )
      },
    },
    {
      key: 'denial_reason',
      label: t('denialReason') || 'Denial Reason',
      render: (v) =>
        v
          ? <span className="text-xs" style={{ color: '#ef4444' }}>{v}</span>
          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
    {
      key: 'submitted_at',
      label: t('submitted') || 'Submitted',
      render: (v) =>
        v
          ? <span className="text-xs font-mono">{new Date(v).toLocaleDateString()}</span>
          : '—',
    },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
            Visitor Management
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Register visitors and manage access requests
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick request for existing visitor */}
          <button
            onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-main)',
            }}
          >
            <Send size={14} /> New Request
          </button>

          {/* Register new visitor */}
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
          >
            <Plus size={15} /> Register Visitor
          </button>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Visitors" value={visitors.length} color="#3b82f6" />
        <StatCard label={t('pending')}    value={pending}         color="#f59e0b" />
        <StatCard label={t('approved')}   value={approved}        color="#22c55e" />
        <StatCard label={t('denied')}     value={denied}          color="#ef4444" />
      </div>

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--color-card-hover)' }}
      >
        {[
          { key: 'visitors', icon: Users,         label: `Visitors (${visitors.length})` },
          { key: 'requests', icon: ClipboardList,  label: `Requests (${requests.length})` },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === key ? 'linear-gradient(135deg,#cc0000,#aa0000)' : 'transparent',
              color: tab === key ? 'white' : 'var(--color-text-muted)',
              boxShadow: tab === key ? '0 2px 8px rgba(204,0,0,0.25)' : 'none',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {tab === 'visitors' ? (
        <DataTable
          key="visitors"
          columns={visitorColumns}
          data={visitors}
          loading={loading}
          searchKeys={['first_name', 'last_name', 'digital_id', 'phone']}
          pageSize={10}
          actions={(row) => (
            <>
              <button
                onClick={() => setViewVisitor(row)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#3b82f6' }}
                title="View details"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => {
                  setSelectedVisitorId(String(row.id))
                  setReqForm({ reason: row.reason || '', start_date: '', end_date: '' })
                  setShowRequest(true)
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#22c55e' }}
                title="Send request"
              >
                <Send size={14} />
              </button>
              <button
                onClick={() => handleDeleteVisitor(row.id)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#ef4444' }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        />
      ) : (
        <DataTable
          key="requests"
          columns={requestColumns}
          data={requests}
          loading={loading}
          searchKeys={['visitor_name', 'reason', 'status']}
          pageSize={10}
          actions={(row) => (
            <button
              onClick={() => setViewRequest(row)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#3b82f6' }}
              title="View details"
            >
              <Eye size={14} />
            </button>
          )}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Register new visitor (+ auto-submit request)
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        title="Register Visitor"
        width="max-w-3xl"
      >
        {/*
          RegistrationForm handles all the visitor fields + photo upload.
          On submit it calls onSubmit(formData) — we intercept that to also
          create the request automatically.
        */}
        <RegistrationForm
          type="visitor"
          onSubmit={handleRegister}
          onCancel={() => setShowRegister(false)}
          loading={saving}
          submitLabel="Register & Send Request"
        />
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Quick request for an existing visitor
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showRequest}
        onClose={() => { setShowRequest(false); setSelectedVisitorId('') }}
        title="Submit Access Request"
        width="max-w-md"
      >
        <form onSubmit={handleSendRequest} className="space-y-4">

          {/* Visitor selector */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Select Visitor *
            </label>
            <select
              className="ameco-input"
              value={selectedVisitorId}
              onChange={(e) => setSelectedVisitorId(e.target.value)}
              required
            >
              <option value="">— Choose a visitor —</option>
              {visitors.map((v) => (
                <option key={v.id} value={v.id}>
                  {fullName(v)}{v.digital_id ? ` (${v.digital_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('reason')}
            </label>
            <textarea
              className="ameco-input"
              rows={3}
              value={reqForm.reason}
              onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for visit…"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('startDate')}
              </label>
              <input
                type="date"
                className="ameco-input"
                value={reqForm.start_date}
                onChange={(e) => setReqForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('endDate')}
              </label>
              <input
                type="date"
                className="ameco-input"
                value={reqForm.end_date}
                onChange={(e) => setReqForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-3 pt-2 border-t"
            style={{ borderColor: 'var(--color-border-main)' }}
          >
            <button
              type="button"
              onClick={() => { setShowRequest(false); setSelectedVisitorId('') }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: 'var(--color-card-hover)',
                border: '1px solid var(--color-border-main)',
                color: 'var(--color-text-muted)',
              }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg,#cc0000,#aa0000)',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Send size={13} /> Send Request</>
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Visitor detail view
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!viewVisitor}
        onClose={() => setViewVisitor(null)}
        title="Visitor Details"
      >
        {viewVisitor && (
          <div className="space-y-3 text-sm">

            {/* Photo */}
            {viewVisitor.profile_image && (
              <img
                src={viewVisitor.profile_image}
                alt="profile"
                className="w-20 h-20 rounded-xl object-cover mb-2"
              />
            )}

            {/* Fields */}
            {[
              ['Name',       fullName(viewVisitor)],
              ['Digital ID', viewVisitor.digital_id],
              ['Phone',      viewVisitor.phone],
              ['Email',      viewVisitor.email],
              ['Reason',     viewVisitor.reason],
              ['Start Date', viewVisitor.date_of_first_entry],
              ['Expiry',     viewVisitor.date_of_expiry],
              ['Registered', viewVisitor.registered_at
                ? new Date(viewVisitor.registered_at).toLocaleString()
                : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <span
                  className="w-28 flex-shrink-0 font-semibold"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {label}
                </span>
                <span style={{ color: 'var(--color-text-main)' }}>{value || '—'}</span>
              </div>
            ))}

            {/* Quick-send request from detail view */}
            <div
              className="pt-3 mt-3 border-t flex justify-end"
              style={{ borderColor: 'var(--color-border-main)' }}
            >
              <button
                onClick={() => {
                  setViewVisitor(null)
                  setSelectedVisitorId(String(viewVisitor.id))
                  setReqForm({ reason: viewVisitor.reason || '', start_date: '', end_date: '' })
                  setShowRequest(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
              >
                <Send size={13} /> Send Access Request
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Request detail view
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!viewRequest}
        onClose={() => setViewRequest(null)}
        title="Request Details"
      >
        {viewRequest && (() => {
          const cfg  = STATUS_CONFIG[viewRequest.status] || STATUS_CONFIG.PENDING
          const Icon = cfg.icon
          return (
            <div className="space-y-3 text-sm">

              {/* Visitor header */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-card-hover)' }}>
                {viewRequest.visitor_image && (
                  <img src={viewRequest.visitor_image} alt=""
                       className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{viewRequest.visitor_name || '—'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {viewRequest.visitor_phone}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Icon size={14} style={{ color: cfg.color }} />
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>

              {/* Fields */}
              {[
                ['Reason',        viewRequest.reason],
                ['Start Date',    viewRequest.start_date],
                ['End Date',      viewRequest.end_date],
                ['Submitted',     viewRequest.submitted_at
                  ? new Date(viewRequest.submitted_at).toLocaleString()
                  : '—'],
                ['Denial Reason', viewRequest.denial_reason],
              ].map(([label, value]) => (
                value ? (
                  <div key={label} className="flex gap-3">
                    <span
                      className="w-28 flex-shrink-0 font-semibold"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        color: label === 'Denial Reason' ? '#ef4444' : 'var(--color-text-main)',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ) : null
              ))}
            </div>
          )
        })()}
      </Modal>

    </div>
  )
}