import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, CheckCircle, XCircle, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import { visitorsAPI, requestsAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { usePrivilege } from '../../hooks/usePrivilege'
import AccessDenied from '../../components/AccessDenied'

export default function VisitorsPage() {
  const { t } = useLang()
  const { hasPrivilege } = usePrivilege()

  // ALL hooks must come before any conditional return
  const [visitors, setVisitors]     = useState([])
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('visitors')
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [selected, setSelected]     = useState(null)
  const [viewItem, setViewItem]     = useState(null)
  const [denyModal, setDenyModal]   = useState(null)
  const [denyReason, setDenyReason] = useState('')

  const canAccess = hasPrivilege('manage_visitors')

  const load = () => {
    if (!canAccess) return
    setLoading(true)
    Promise.all([visitorsAPI.list(), requestsAPI.list()])
      .then(([v, r]) => {
        setVisitors(v.data.results || v.data)
        setRequests(r.data.results || r.data)
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // NOW safe to conditionally render
  if (!canAccess) {
    return <AccessDenied privilege="manage_visitors" />
  }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (selected) {
        const res = await visitorsAPI.update(selected.id, form)
        const updated = res.data || res
        if (JSON.stringify(updated) === JSON.stringify(selected)) {
          toast('No Changes Detected')
        } else {
          toast.success('Saved Successfully')
        }
      } else {
        await visitorsAPI.create(form)
        toast.success('Saved Successfully')
      }
      setSelected(null)
      setShowForm(false)
      load()
    } catch (err) {
      const msg = err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join('\n') || 'Save failed'
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
    } catch {
      toast.error('Delete failed')
    }
  }

  const openEditor = (row) => { setSelected(row); setShowForm(true) }
  const openNew    = () => { setSelected(null); setShowForm(true) }
  const closeForm  = () => { setSelected(null); setShowForm(false) }

  const handleApprove = async (id) => {
    try {
      await requestsAPI.updateStatus(id, { status: 'APPROVED' })
      toast.success('Request approved')
      load()
    } catch (err) {
      console.error('Approve failed', err)
      const msg = err.response?.data?.detail || err.response?.data || err.message || 'Failed to approve request'
      toast.error(String(msg))
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
      console.error('Deny failed', err)
      const msg = err.response?.data?.detail || err.response?.data || err.message || 'Failed to deny request'
      toast.error(String(msg))
    }
  }

  const visitorCols = [
    {
      key: 'first_name',
      label: 'Name',
      render: (_, row) => (
        <div>
          <p className="font-semibold text-sm">{row.first_name} {row.middle_name} {row.last_name}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.digital_id}</p>
        </div>
      ),
    },
    { key: 'phone_number', label: t('phone') },
    { key: 'date_of_first_entry', label: t('startDate') },
    { key: 'date_of_expiry', label: t('endDate') },
    { key: 'reason', label: t('reason') },
  ]

  const requestCols = [
    {
      key: 'visitor_name',
      label: 'Visitor',
      render: (v) => <span className="font-semibold">{v || '—'}</span>,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['visitors', 'requests'].map((tab_) => (
            <button
              key={tab_}
              onClick={() => setTab(tab_)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === tab_ ? 'linear-gradient(135deg,#cc0000,#aa0000)' : 'var(--color-card-main)',
                color: tab === tab_ ? 'white' : 'var(--color-text-muted)',
                border: tab === tab_ ? 'none' : '1px solid var(--color-border-main)',
              }}>
              {tab_ === 'visitors' ? t('visitors') : t('visitorRequest')}
              {tab_ === 'requests' && (
                <span className="ml-1.5 text-xs">
                  ({requests.filter((r) => r.status === 'PENDING').length})
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'visitors' && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
            <Plus size={15} /> {t('addNew')}
          </button>
        )}
      </div>

      {tab === 'visitors' ? (
        <DataTable columns={visitorCols} data={visitors} loading={loading}
          searchKeys={['first_name', 'last_name', 'digital_id', 'phone_number']}
          actions={(row) => (
            <>
              <button onClick={() => openEditor(row)} className="p-1.5 rounded-lg" style={{ color: '#f59e0b' }} title="Edit"><Pencil size={14} /></button>
              <button onClick={() => setViewItem(row)} className="p-1.5 rounded-lg" style={{ color: '#3b82f6' }} title="View"><Eye size={14} /></button>
              <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />
      ) : (
        <DataTable columns={requestCols} data={requests} loading={loading}
          searchKeys={['visitor_name', 'guard_username']}
          actions={(row) => row.status === 'PENDING' ? (
            <>
              <button onClick={() => handleApprove(row.id)} className="p-1.5 rounded-lg" style={{ color: '#22c55e' }} title="Approve">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => { setDenyModal(row.id); setDenyReason('') }} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Deny">
                <XCircle size={14} />
              </button>
            </>
          ) : null}
        />
      )}

      <Modal open={showForm} onClose={closeForm} title={selected ? 'Edit Visitor' : t('registerVisitor')} width="max-w-3xl">
        <RegistrationForm
          key={selected?.id ?? 'new-visitor'}
          type="visitor"
          initialData={selected}
          editing={!!selected}
          onSubmit={handleSave}
          onCancel={closeForm}
          loading={saving}
        />
      </Modal>

      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Visitor Details">
        {viewItem && (
          <div className="space-y-3 text-sm">
            {[
              ['Name', `${viewItem.first_name} ${viewItem.middle_name} ${viewItem.last_name}`],
              ['Digital ID', viewItem.digital_id],
              ['Phone', viewItem.phone_number || viewItem.phone],
              ['Email', viewItem.email],
              ['Start Date', viewItem.date_of_first_entry ? new Date(viewItem.date_of_first_entry).toLocaleDateString() : '—'],
              ['Expiry', viewItem.date_of_expiry ? new Date(viewItem.date_of_expiry).toLocaleDateString() : '—'],
              ['Reason', viewItem.reason],
              ['Registered At', viewItem.registered_at ? new Date(viewItem.registered_at).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <span className="w-36 flex-shrink-0 font-semibold" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--color-text-main)' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!denyModal} onClose={() => setDenyModal(null)} title="Deny Request" width="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--color-text-muted)' }}>
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
            <button onClick={() => setDenyModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-main)' }}>
              {t('cancel')}
            </button>
            <button onClick={handleDeny} className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#ef4444' }}>
              {t('deny')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}