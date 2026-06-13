import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import { guardsAPI, BASE_URL } from '../../services/api'
import PersonDetailModal from '../../components/PersonDetailModal'
import { useLang } from '../../context/LanguageContext'
import { usePrivilege } from '../../hooks/usePrivilege'
import AccessDenied from '../../components/AccessDenied'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts a relative media path returned by DRF into a full URL.
 * e.g. "/media/profile_images/foo.jpg" → "http://127.0.0.1:8000/media/..."
 * Already-absolute URLs (http/https) are returned unchanged.
 */
function getImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${BASE_URL}${url}`
}

/**
 * Converts a plain object into a FormData instance.
 * File/Blob values → binary append.
 * Arrays          → multi-append under the same key.
 * null/undefined  → skipped (partial-update safe).
 */
function toFormData(fields) {
  const fd = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    if (value instanceof File || value instanceof Blob) {
      fd.append(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((item) => fd.append(key, item))
    } else {
      fd.append(key, String(value))
    }
  })
  return fd
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GuardsPage() {
  const { t } = useLang()
  const { hasPrivilege } = usePrivilege()

  if (!hasPrivilege('manage_guards')) {
    return <AccessDenied privilege="manage_guards" />
  }
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [viewItem, setViewItem] = useState(null)

  const load = () => {
    setLoading(true)
    guardsAPI.list()
      .then((r) => setData(r.data.results || r.data))
      .catch(() => toast.error('Failed to load guards'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (selected) {
        const payload = toFormData(form)
        // Drop profile_image when it's still the existing URL string, not a new File
        if (!(form.profile_image instanceof File)) {
          payload.delete('profile_image')
        }
        const res = await guardsAPI.update(selected.id, payload)
        const updated = res.data || res
        if (JSON.stringify(updated) === JSON.stringify(selected)) {
          toast('No Changes Detected')
        } else {
          toast.success('Saved Successfully')
        }
      } else {
        const payload = toFormData({ ...form, role: 'guard', registered_by: 'admin' })
        await guardsAPI.create(payload)
        toast.success('Saved Successfully')
      }
      setSelected(null)
      setShowForm(false)
      load()
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {}).flat().join('\n') ||
        'Save failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await guardsAPI.delete(id)
      toast.success('Deleted')
      load()
    } catch {
      toast.error('Delete failed')
    }
  }

  const openEditor = (row) => { setSelected(row); setShowForm(true) }
  const openNew    = ()    => { setSelected(null); setShowForm(true) }
  const closeForm  = ()    => { setSelected(null); setShowForm(false) }

  const columns = [
    {
      key: 'profile_image',
      label: '',
      render: (v, row) => {
        const src = getImageUrl(row.profile_image)
        return (
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
               style={{ background: 'var(--color-card-hover)' }}>
            {src
              ? <img src={src} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                     style={{ color: 'var(--color-ameco-red)' }}>
                  {row.first_name?.[0]?.toUpperCase()}
                </div>
            }
          </div>
        )
      },
    },
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
    { key: 'username',          label: 'Username' },
    { key: 'phone_number',      label: t('phone') },
    { key: 'guard_tag',         label: t('tag') },
    { key: 'gates_assigned_to', label: t('assignedGate'), render: (v) => v || '—' },
    { key: 'registered_at',     label: 'Registered',      render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t('guards')} <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>({data.length})</span>
        </h3>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
          <Plus size={15} /> {t('addNew')}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKeys={['first_name', 'last_name', 'username', 'digital_id']}
        actions={(row) => (
          <>
            <button onClick={() => openEditor(row)} className="p-1.5 rounded-lg" style={{ color: '#f59e0b' }} title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setViewItem(row)} className="p-1.5 rounded-lg" style={{ color: '#3b82f6' }} title="View"><Eye size={14} /></button>
            <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal open={showForm} onClose={closeForm} title={selected ? 'Edit Guard' : t('registerGuard')} width="max-w-3xl">
        <RegistrationForm
          key={selected?.id ?? 'new-guard'}
          type="guard"
          initialData={selected}
          editing={!!selected}
          onSubmit={handleSave}
          onCancel={closeForm}
          loading={saving}
        />
      </Modal>

      {viewItem && (
        <PersonDetailModal
          person={viewItem}
          type="guard"
          onClose={() => setViewItem(null)}
        />
      )}
    </div>
  )
}