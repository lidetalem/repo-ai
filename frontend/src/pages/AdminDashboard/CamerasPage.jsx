import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Power, Wrench, Scan, Settings, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal'
import FaceScanOverlay from '../../components/FaceScanOverlay'
import { camerasAPI } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { usePrivilege } from '../../hooks/usePrivilege'
import AccessDenied from '../../components/AccessDenied'

// ─── Styled delete confirmation modal ─────────────────────────────────────────
function DeleteConfirmModal({ camera, onConfirm, onCancel, loading }) {
  if (!camera) return null
  return (
    <Modal open onClose={onCancel} title="" width="max-w-sm">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={26} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>
            Delete Camera?
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
              {camera.camera_name}
            </span>{' '}
            at <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{camera.gate_name}</span> will
            be permanently removed. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 w-full pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-muted)',
            }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
              opacity: loading ? 0.6 : 1,
            }}>
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit / Settings modal ────────────────────────────────────────────────────
function EditCameraModal({ camera, onSave, onClose, saving }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    gate_name:         camera.gate_name        || '',
    camera_name:       camera.camera_name      || '',
    terminal_id:       camera.terminal_id      || '',
    location:          camera.location         || '',
    ip_address:        camera.ip_address       || '',
    installation_date: camera.installation_date || '',
  })

  useEffect(() => {
    if (!camera) return
    setForm({
      gate_name:         camera.gate_name        || '',
      camera_name:       camera.camera_name      || '',
      terminal_id:       camera.terminal_id      || '',
      location:          camera.location         || '',
      ip_address:        camera.ip_address       || '',
      installation_date: camera.installation_date || '',
    })
  }, [camera])

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Modal open onClose={onClose} title="Camera Settings" width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          ['gate_name',   t('gateName')   || 'Gate Name'],
          ['camera_name', t('cameraName') || 'Camera Name'],
          ['terminal_id', t('terminalId') || 'Terminal ID'],
          ['location',    'Location'],
          ['ip_address',  'IP Address'],
        ].map(([key, label]) => (
          <div key={key}>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </label>
            <input
              className="ameco-input"
              value={form[key]}
              onChange={setF(key)}
              required={['gate_name', 'camera_name', 'terminal_id'].includes(key)}
            />
          </div>
        ))}
        <div>
          <label
            className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}>
            Installation Date
          </label>
          <input
            className="ameco-input"
            type="date"
            value={form.installation_date}
            onChange={setF('installation_date')}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'var(--color-card-hover)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border-main)',
            }}>
            {t('cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg,#cc0000,#aa0000)',
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? (t('loading') || 'Saving…') : (t('save') || 'Save Changes')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Icon button helper ───────────────────────────────────────────────────────
function IconBtn({ onClick, title, bg, color, border, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: bg, color, border: border || '1px solid var(--color-border-main)' }}>
      {children}
    </button>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 12, color = '#ffffff' }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-t-transparent animate-spin"
      style={{
        width: size,
        height: size,
        borderColor: color,
        borderTopColor: 'transparent',
      }}
    />
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CamerasPage() {
  const { t } = useLang()
  const { hasPrivilege } = usePrivilege()

  if (!hasPrivilege('manage_cameras')) {
    return <AccessDenied privilege="manage_cameras" />
  }


  const [cameras, setCameras]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [scanCam, setScanCam]       = useState(null)

  // Per-camera action loading: { [id]: 'power' | 'status' | 'delete' | 'edit' | null }
  const [actionLoading, setActionLoading] = useState({})

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null)   // camera object
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Edit / settings
  const [editTarget, setEditTarget]   = useState(null)     // camera object
  const [editSaving, setEditSaving]   = useState(false)

  // Add form
  const [form, setForm] = useState({
    gate_name: '', camera_name: '', terminal_id: '',
    location: '', ip_address: '', installation_date: '',
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const load = () => {
    setLoading(true)
    camerasAPI.list()
      .then((r) => setCameras(r.data.results || r.data))
      .catch(() => toast.error('Failed to load cameras'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const setBusy = (id, action) =>
    setActionLoading((prev) => ({ ...prev, [id]: action }))
  const clearBusy = (id) =>
    setActionLoading((prev) => ({ ...prev, [id]: null }))

  // ── Add camera ────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await camerasAPI.create({ ...form, power: 'on', status: 'active' })
      toast.success('Camera added!')
      setShowAdd(false)
      setForm({ gate_name: '', camera_name: '', terminal_id: '', location: '', ip_address: '', installation_date: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add camera')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle power ──────────────────────────────────────────────────────────────
  const handleTogglePower = async (cam) => {
    setBusy(cam.id, 'power')
    try {
      await camerasAPI.togglePower(cam.id)
      const next = cam.power === 'on' ? 'off' : 'on'
      toast.success(`${cam.camera_name} powered ${next === 'on' ? 'ON' : 'OFF'}`)
      load()
    } catch {
      toast.error('Failed to toggle power')
    } finally {
      clearBusy(cam.id)
    }
  }

  // ── Toggle maintenance ────────────────────────────────────────────────────────
  const handleToggleStatus = async (cam) => {
    setBusy(cam.id, 'status')
    try {
      await camerasAPI.toggleStatus(cam.id)
      const next = cam.status === 'active' ? 'maintenance' : 'active'
      toast.success(
        next === 'maintenance'
          ? `${cam.camera_name} set to Maintenance`
          : `${cam.camera_name} back to Active`
      )
      load()
    } catch {
      toast.error('Failed to toggle status')
    } finally {
      clearBusy(cam.id)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await camerasAPI.delete(deleteTarget.id)
      toast.success(`${deleteTarget.camera_name} deleted`)
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Edit / save ───────────────────────────────────────────────────────────────
  const handleEditSave = async (updatedForm) => {
    if (!editTarget) return
    setEditSaving(true)
    try {
      await camerasAPI.update(editTarget.id, updatedForm)
      toast.success('Camera settings saved!')
      setEditTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setEditSaving(false)
    }
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t('cameras') || 'Cameras'}
          <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
            ({cameras.length})
          </span>
        </h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
          <Plus size={15} /> {t('addNew') || 'Add New'}
        </button>
      </div>

      {/* Camera grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-ameco-red)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : cameras.length === 0 ? (
        <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('noData') || 'No cameras found'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((cam) => {
            const busy    = actionLoading[cam.id]
            const isLive  = cam.power === 'on' && cam.status === 'active'
            const isMaint = cam.status === 'maintenance'

            return (
              <div
                key={cam.id}
                className="rounded-2xl p-5 space-y-4 transition-all"
                style={{
                  background: 'var(--color-card-main)',
                  border: `1px solid ${
                    isLive
                      ? 'rgba(34,197,94,0.3)'
                      : isMaint
                      ? 'rgba(245,158,11,0.3)'
                      : 'var(--color-border-main)'
                  }`,
                  opacity: busy === 'delete' ? 0.5 : 1,
                }}>

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--color-text-main)' }}>
                      {cam.gate_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {cam.camera_name} · {cam.terminal_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${isLive ? 'status-dot-live' : ''}`}
                      style={{ background: isLive ? '#22c55e' : isMaint ? '#f59e0b' : '#6b7280' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {isLive ? 'Live' : isMaint ? 'Maintenance' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {cam.location   && <p>📍 {cam.location}</p>}
                  {cam.ip_address && <p>🌐 {cam.ip_address}</p>}
                </div>

                {/* Badges */}
                <div className="flex gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: cam.power === 'on' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                      color:      cam.power === 'on' ? '#22c55e' : '#6b7280',
                    }}>
                    {t('power') || 'Power'}: {cam.power === 'on' ? (t('on') || 'ON') : (t('off') || 'OFF')}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: cam.status === 'active' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                      color:      cam.status === 'active' ? '#3b82f6' : '#f59e0b',
                    }}>
                    {cam.status === 'active' ? (t('active') || 'Active') : (t('maintenance') || 'Maintenance')}
                  </span>
                </div>

                {/* ── Action buttons ── */}
                <div
                  className="flex gap-2 pt-2 border-t"
                  style={{ borderColor: 'var(--color-border-main)' }}>

                  {/* Scan Face */}
                  <button
                    onClick={() => setScanCam(cam.terminal_id)}
                    disabled={!!busy || cam.power !== 'on'}
                    title={cam.power !== 'on' ? 'Camera is offline' : 'Start face scan'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
                    <Scan size={12} /> {t('scanFace') || 'Scan Face'}
                  </button>

                  {/* Settings / Edit */}
                  <IconBtn
                    onClick={() => setEditTarget(cam)}
                    title="Camera Settings"
                    disabled={!!busy}
                    bg="rgba(99,102,241,0.1)"
                    color="#818cf8">
                    {busy === 'edit' ? <Spinner size={14} color="#818cf8" /> : <Settings size={14} />}
                  </IconBtn>

                  {/* Power toggle */}
                  <IconBtn
                    onClick={() => handleTogglePower(cam)}
                    title={cam.power === 'on' ? 'Turn Off' : 'Turn On'}
                    disabled={!!busy}
                    bg={cam.power === 'on' ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)'}
                    color={cam.power === 'on' ? '#22c55e' : '#6b7280'}>
                    {busy === 'power'
                      ? <Spinner size={14} color={cam.power === 'on' ? '#22c55e' : '#6b7280'} />
                      : <Power size={14} />}
                  </IconBtn>

                  {/* Maintenance toggle */}
                  <IconBtn
                    onClick={() => handleToggleStatus(cam)}
                    title={cam.status === 'active' ? 'Set to Maintenance' : 'Set to Active'}
                    disabled={!!busy}
                    bg={cam.status === 'maintenance' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)'}
                    color="#f59e0b">
                    {busy === 'status'
                      ? <Spinner size={14} color="#f59e0b" />
                      : <Wrench size={14} />}
                  </IconBtn>

                  {/* Delete */}
                  <IconBtn
                    onClick={() => setDeleteTarget(cam)}
                    title="Delete Camera"
                    disabled={!!busy}
                    bg="rgba(239,68,68,0.1)"
                    color="#ef4444">
                    {busy === 'delete'
                      ? <Spinner size={14} color="#ef4444" />
                      : <Trash2 size={14} />}
                  </IconBtn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Camera Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Gate Camera" width="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          {[
            ['gate_name',   t('gateName')   || 'Gate Name'],
            ['camera_name', t('cameraName') || 'Camera Name'],
            ['terminal_id', t('terminalId') || 'Terminal ID'],
            ['location',    'Location'],
            ['ip_address',  'IP Address'],
          ].map(([key, label]) => (
            <div key={key}>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </label>
              <input
                className="ameco-input"
                value={form[key]}
                onChange={setF(key)}
                required={['gate_name', 'camera_name', 'terminal_id'].includes(key)}
              />
            </div>
          ))}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}>
              Installation Date
            </label>
            <input
              className="ameco-input"
              type="date"
              value={form.installation_date}
              onChange={setF('installation_date')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: 'var(--color-card-hover)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-main)',
              }}>
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)', opacity: saving ? 0.6 : 1 }}>
              {saving ? (t('loading') || 'Saving…') : (t('save') || 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit / Settings Modal ── */}
      {editTarget && (
        <EditCameraModal
          camera={editTarget}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
          saving={editSaving}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      <DeleteConfirmModal
        camera={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      {/* ── Face Scan Overlay ── */}
      {scanCam && <FaceScanOverlay cameraId={scanCam} onClose={() => setScanCam(null)} />}
    </div>
  )
}