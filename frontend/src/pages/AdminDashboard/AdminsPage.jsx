import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, Link, LinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import RegistrationForm from '../../components/RegistrationForm'
import PrivilegesSection from './PrivilegesSection'
import { adminsAPI, staffAPI, BASE_URL } from '../../services/api'
import { useLang } from '../../context/LanguageContext'
import { usePrivilege } from '../../hooks/usePrivilege'
import { useAuth } from '../../context/AuthContext'
import AccessDenied from '../../components/AccessDenied'
import PersonDetailModal from '../../components/PersonDetailModal'

function getImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${BASE_URL}${url}`
}

// Fields that are stored as JSONField on the backend must be sent as a
// JSON string in multipart/form-data — NOT as repeated keys.
// Sending repeated keys (e.g. privileges=a&privileges=b) causes DRF to
// reject the value with "Must be valid JSON".
const JSON_FIELDS = new Set(['privileges'])

function toFormData(fields) {
  const fd = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    if (value instanceof File || value instanceof Blob) {
      fd.append(key, value)
    } else if (Array.isArray(value)) {
      if (JSON_FIELDS.has(key)) {
        // JSONField: send the whole array as a single JSON string
        fd.append(key, JSON.stringify(value))
      } else {
        value.forEach((item) => fd.append(key, item))
      }
    } else {
      fd.append(key, String(value))
    }
  })
  return fd
}

// ── Staff-link dropdown ───────────────────────────────────────────────────────
// Shown inside the Add/Edit modal so a super admin can link an admin to their
// existing StaffProfile.  When linked, the recognition pipeline will return
// "Admin" (not "Staff") when that person is scanned at an entrance camera.

function StaffLinkSelect({ value, onChange, onStaffSelected, currentAdminId }) {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    staffAPI.list()
      .then((r) => setStaffList(r.data.results || r.data))
      .catch(() => toast.error('Could not load staff list'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    if (v === '') {
      onChange(null)
      onStaffSelected?.(null)
    } else {
      const id = Number(v)
      onChange(id)
      const staff = staffList.find(s => s.id === id)
      onStaffSelected?.(staff || null)
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        Linked Staff Profile
        <span className="ml-1 font-normal opacity-70">(optional — links staff data to this admin)</span>
      </label>
      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={loading}
        className="w-full px-3 py-2 rounded-xl text-sm border outline-none transition-all"
        style={{
          background:   'var(--color-card-bg)',
          borderColor:  'var(--color-border-main)',
          color:        'var(--color-text-main)',
        }}
      >
        <option value="">— Not linked to any staff profile —</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.first_name} {s.middle_name} {s.last_name} · {s.position || s.department || s.digital_id}
          </option>
        ))}
      </select>
      {value && (
        <p className="text-xs" style={{ color: '#22c55e' }}>
          ✓ Staff data auto-filled into the form. Admin will be recognised as <strong>Admin</strong> at cameras.
        </p>
      )}
      {!value && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Linking a staff profile auto-fills their personal details into the registration form.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { t } = useLang()
  const { hasPrivilege } = usePrivilege()
  const { refreshPrivileges } = useAuth()

  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [viewItem, setViewItem]     = useState(null)
  const [privileges, setPrivileges] = useState([])
  const [linkedStaff, setLinkedStaff] = useState(null)  // staff profile id or null
  const [staffPrefill, setStaffPrefill] = useState(null) // staff data to prefill form
  const [formKey, setFormKey] = useState(0) // force re-mount of form when staff selected

  const canAccess = hasPrivilege('manage_admins')

  const load = () => {
    if (!canAccess) return
    setLoading(true)
    adminsAPI.list()
      .then((r) => setData(r.data.results || r.data))
      .catch(() => toast.error('Failed to load admins'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess) {
    return <AccessDenied privilege="manage_admins" />
  }

  const openEditor = (row) => {
    setSelected(row)
    setPrivileges(Array.isArray(row.privileges) ? row.privileges : [])
    setLinkedStaff(row.linked_staff ?? null)
    setStaffPrefill(null)
    setShowForm(true)
  }

  const openNew   = () => { setSelected(null); setPrivileges([]); setLinkedStaff(null); setStaffPrefill(null); setShowForm(true) }
  const closeForm = () => { setSelected(null); setPrivileges([]); setLinkedStaff(null); setStaffPrefill(null); setShowForm(false) }

  const handleStaffSelected = async (staff) => {
    if (!staff) { setStaffPrefill(null); setFormKey(k => k + 1); return }
    // Fetch full staff record to get all images and biometric data
    let fullStaff = staff
    try {
      const { data } = await staffAPI.retrieve(staff.id)
      fullStaff = data
    } catch {}

    // Build comprehensive prefill — all personal info + all images + all biometrics
    setStaffPrefill({
      // Personal info
      first_name:   fullStaff.first_name   || '',
      middle_name:  fullStaff.middle_name  || '',
      last_name:    fullStaff.last_name    || '',
      phone_number: fullStaff.phone_number || '',
      email:        fullStaff.email        || '',
      gender:       fullStaff.gender       || 'M',
      position:     fullStaff.position     || '',
      department:   fullStaff.department   || '',
      description:  fullStaff.description  || '',
      // Profile & ID card images
      profile_image:  fullStaff.profile_image  || null,
      id_card_front:  fullStaff.id_card_front  || fullStaff.id_card_image || null,
      id_card_back:   fullStaff.id_card_back   || null,
      // All 5 face biometric images
      face_front:     fullStaff.face_front     || fullStaff.face_scan_1 || null,
      face_left:      fullStaff.face_left      || fullStaff.face_scan_2 || null,
      face_right:     fullStaff.face_right     || fullStaff.face_scan_3 || null,
      face_down:      fullStaff.face_down      || fullStaff.face_scan_4 || null,
      face_unusual:   fullStaff.face_unusual   || fullStaff.face_scan_5 || null,
    })
    setFormKey(k => k + 1)
    toast.success(`All data auto-filled from ${fullStaff.first_name || 'Staff'}'s profile`, { icon: '✅' })
  }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      const extra = {
        privileges,
        // Send null explicitly to clear a link; otherwise send the id
        linked_staff: linkedStaff ?? '',
      }

      if (selected) {
        const payload = toFormData({ ...form, ...extra })
        if (!(form.profile_image instanceof File)) payload.delete('profile_image')
        const res = await adminsAPI.update(selected.id, payload)
        const updated = res.data || res
        if (JSON.stringify(updated) === JSON.stringify(selected)) {
          toast('No Changes Detected')
        } else {
          toast.success('Saved Successfully')
        }
      } else {
        const payload = toFormData({ ...form, ...extra, role: 'admin' })
        await adminsAPI.create(payload)
        toast.success('Saved Successfully')
      }
      closeForm()
      load()
      // Refresh current user's privileges immediately so access controls update
      try { await refreshPrivileges() } catch {}
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
      await adminsAPI.delete(id)
      toast.success('Deleted')
      load()
    } catch {
      toast.error('Delete failed')
    }
  }

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
    { key: 'admin_tag',    label: t('tag') },
    { key: 'phone_number', label: t('phone') },
    {
      key: 'linked_staff',
      label: 'Staff Link',
      render: (v) => v
        ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
            <LinkIcon size={10} /> Linked
          </span>
        : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
    {
      key: 'registered_at',
      label: 'Registered',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t('admins')}
          <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
            ({data.length})
          </span>
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
        searchKeys={['first_name', 'last_name', 'admin_tag', 'digital_id']}
        actions={(row) => (
          <>
            <button onClick={() => openEditor(row)} className="p-1.5 rounded-lg" style={{ color: '#f59e0b' }} title="Edit"><Pencil size={14} /></button>
            <button onClick={() => setViewItem(row)} className="p-1.5 rounded-lg" style={{ color: '#3b82f6' }} title="View"><Eye size={14} /></button>
            <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      {/* ── Add / Edit modal ── */}
      <Modal open={showForm} onClose={closeForm} title={selected ? 'Edit Admin' : t('registerAdmin')} width="max-w-3xl">
        <RegistrationForm
          key={`${selected?.id ?? 'new-admin'}-${formKey}`}
          type="admin"
          initialData={selected ?? staffPrefill ?? undefined}
          editing={!!selected}
          onSubmit={handleSave}
          onCancel={closeForm}
          loading={saving}
        />

        {/* Staff link — shown below the form, above privileges */}
        <div className="mt-4 px-1">
          <StaffLinkSelect
            value={linkedStaff}
            onChange={setLinkedStaff}
            onStaffSelected={!selected ? handleStaffSelected : undefined}
            currentAdminId={selected?.id}
          />
        </div>

        {/* Privilege checklist */}
        <div className="mt-4 px-1">
          <PrivilegesSection value={privileges} onChange={setPrivileges} />
        </div>
      </Modal>

      {/* ── View modal — enhanced ── */}
      {viewItem && (
        <PersonDetailModal
          person={viewItem}
          type="admin"
          onClose={() => setViewItem(null)}
        />
      )}
    </div>
  )
}