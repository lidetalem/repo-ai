import React, { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import { staffAPI, BASE_URL } from '../../services/api'
import PersonDetailModal from '../../components/PersonDetailModal'
import ImportStaffModal from '../../components/ImportStaffModal'
import { useLang } from '../../context/LanguageContext'

export default function StaffPage() {
  const { t } = useLang()
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState(null)
  const [viewItem, setViewItem]       = useState(null)
  const [showImport, setShowImport]   = useState(false)

  const load = () => {
    setLoading(true)
    staffAPI.list()
      .then((r) => setData(r.data.results || r.data))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (selected) {
        await staffAPI.update(selected.id, form)
        toast.success('Staff record updated successfully')
      } else {
        await staffAPI.create({ ...form, registered_by: 'admin' })
        toast.success('Staff member registered successfully')
      }
      setSelected(null)
      setShowForm(false)
      load()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msg = data.detail || Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        toast.error(msg || 'Save failed')
      } else {
        toast.error('Save failed — please check your connection and try again')
      }
      throw err  // re-throw so RegistrationForm can surface field errors
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return
    try {
      await staffAPI.delete(id)
      toast.success('Deleted successfully')
      load()
    } catch {
      toast.error('Delete failed')
    }
  }

  const openEditor = (row) => {
    setSelected(row)
    setShowForm(true)
  }

  const openNew = () => {
    setSelected(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setSelected(null)
    setShowForm(false)
  }

  const columns = [
    {
      key: 'profile_image',
      label: '',
      render: (v, row) => (
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
             style={{ background: 'var(--color-card-hover)' }}>
          {row.profile_image
            ? <img src={row.profile_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                   style={{ color: 'var(--color-ameco-red)' }}>
                {row.first_name?.[0]?.toUpperCase()}
              </div>
          }
        </div>
      ),
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
    { key: 'position',   label: t('position') },
    { key: 'department', label: t('department') },
    { key: 'phone_number', label: t('phone') },
    {
      key: 'registered_at',
      label: 'Registered',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t('staff')} <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
            ({data.length})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ border: '1px solid var(--color-border-main)', color: 'var(--color-text-muted)' }}>
            <Upload size={14} /> Import from Company DB
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
            <Plus size={15} /> {t('addNew')}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKeys={['first_name', 'last_name', 'position', 'department', 'digital_id']}
        actions={(row) => (
          <>
            <button
              onClick={() => openEditor(row)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: '#f59e0b' }}
              title="Edit">
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setViewItem(row)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: '#3b82f6' }}
              title="View">
              <Eye size={14} />
            </button>
            <button
              onClick={() => handleDelete(row.id)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: '#ef4444' }}
              title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        )}
      />

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={closeForm} title={selected ? 'Edit Staff' : t('registerStaff')} width="max-w-3xl">
        <RegistrationForm
          key={selected?.id ?? 'new-staff'}
          type="staff"
          initialData={selected}
          editing={!!selected}
          onSubmit={handleSave}
          onCancel={closeForm}
          loading={saving}
        />
      </Modal>

      {/* View Modal — enhanced */}
      {viewItem && (
        <PersonDetailModal
          person={viewItem}
          type="staff"
          onClose={() => setViewItem(null)}
        />
      )}

      {showImport && (
        <ImportStaffModal
          onClose={() => setShowImport(false)}
          onImportDone={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}