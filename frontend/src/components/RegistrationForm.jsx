/**
 * RegistrationForm.jsx — uses CaptureSystem for biometric capture
 */
import React, { useState, useCallback } from 'react'
import { Save, X, AlertCircle, CalendarDays } from 'lucide-react'
import CaptureSystem from './CaptureSystem'
import { useLang } from '../context/LanguageContext'
import PasswordInput from './PasswordInput'

// --- HELPER COMPONENTS MOVED OUTSIDE TO FIX THE INPUT FOCUS BUG ---

const F = ({ label, fk, type: t2 = 'text', req = false, opts = null, form, errors, set }) => {
  const isPassword = fk === 'password' || t2 === 'password'
  const isCalendar = t2 === 'date' || t2 === 'datetime-local'
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
             style={{ color: errors[fk] ? '#cc0000' : 'var(--color-text-muted)' }}>
        {label}{req ? ' *' : ''}
      </label>
      {opts ? (
        <select className="ameco-input" value={form[fk]} onChange={set(fk)}
                style={errors[fk] ? { borderColor: '#cc0000', background: 'rgba(204,0,0,0.04)' } : {}}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <div className="relative">
          {isPassword ? (
            <PasswordInput
              id={fk}
              value={form[fk] || ''}
              onChange={set(fk)}
              placeholder={t2 === 'datetime-local' ? 'DD/MM/YYYY HH:MM' : undefined}
              className={`ameco-input${errors[fk] ? ' animate-error-shake' : ''}`}
            />
          ) : (
            <input
              id={fk}
              type={t2}
              className={`ameco-input${errors[fk] ? ' animate-error-shake' : ''}`}
              value={form[fk] || ''}
              placeholder={t2 === 'datetime-local' ? 'DD/MM/YYYY HH:MM' : undefined}
              onChange={set(fk)}
              style={errors[fk] ? { borderColor: '#cc0000', background: 'rgba(204,0,0,0.04)' } : {}}
            />
          )}
          {isCalendar && (
            <button type="button"
                    onClick={() => document.getElementById(fk)?.showPicker?.() || document.getElementById(fk)?.focus()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded opacity-70 hover:opacity-100"
                    style={{ color: 'var(--color-text-muted)' }}>
              <CalendarDays size={16} />
            </button>
          )}
          {errors[fk] && <AlertCircle size={14} className="absolute right-9 top-1/2 -translate-y-1/2" style={{ color: '#cc0000' }}/>}
        </div>
      )}
      {errors[fk] && (
        <p className="mt-1 text-xs" style={{ color: '#cc0000' }}>
          {typeof errors[fk] === 'string' ? errors[fk] : 'Please complete this field'}
        </p>
      )}
    </div>
  )
}

const ST = ({ children }) => (
  <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 pb-2 border-b"
      style={{ color: '#cc0000', borderColor: 'rgba(204,0,0,0.2)' }}>{children}</h4>
)

// --- MAIN REGISTRATION FORM COMPONENT ---

export default function RegistrationForm({ type, onSubmit, onCancel, loading = false, initialData = {}, editing = false }) {
  const { t } = useLang()
  const defaultForm = {
    first_name: '', middle_name: '', last_name: '',
    phone_number: '', email: '', gender: 'M',
    position: '', department: '', description: '',
    username: '', password: '',
    date_of_first_entry: '', date_of_expiry: '', reason: '',
    gate_camera_id: '', gates_assigned_to: '',
  }
  const [form, setForm] = useState({ ...defaultForm, ...initialData })
  const [captures, setCaptures] = useState({})
  const [errors, setErrors]     = useState({})
  const [submitShake, setSS]    = useState(false)

  const toDateTimeLocal = (value) => {
    if (!value) return ''
    if (value.includes('T')) return value
    return `${value}T00:00`
  }

  React.useEffect(() => {
    if (editing && initialData) {
      const { profile_image, id_card_image, ...safeData } = initialData
      const phoneValue = initialData.phone || initialData.phone_number || ''
      setForm({
        ...defaultForm,
        ...safeData,
        phone_number: phoneValue,
        date_of_first_entry: toDateTimeLocal(initialData.date_of_first_entry),
        date_of_expiry: toDateTimeLocal(initialData.date_of_expiry),
      })
      setCaptures({
        profile: initialData.profile_image || undefined,
        id_front: initialData.id_card_front || undefined,
        id_back: initialData.id_card_back || undefined,
        front: initialData.face_front || undefined,
        left: initialData.face_left || undefined,
        right: initialData.face_right || undefined,
        down: initialData.face_down || undefined,
        unusual: initialData.face_unusual || undefined,
      })
    } else {
      setForm({ ...defaultForm })
      setCaptures({})
    }
    setErrors({})
  }, [editing, initialData?.id])

  const set = useCallback((key) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [key]: val }))
    setErrors(err => {
      if (err[key]) {
        const n = { ...err }
        delete n[key]
        return n
      }
      return err
    })
  }, [])

  const validate = () => {
    const req = ['first_name']
    if (!editing && (type === 'admin' || type === 'guard')) req.push('username', 'password')
    if (type === 'visitor') req.push('date_of_expiry')
    const errs = {}
    req.forEach((k) => {
      if (!form[k]?.toString().trim()) {
        errs[k] = k === 'date_of_expiry' ? 'Expiry date is required' : 'This field is required'
      }
    })
    if (type === 'visitor' && form.date_of_expiry) {
      const now = new Date()
      const expiry = new Date(form.date_of_expiry)
      if (Number.isNaN(expiry.getTime()) || expiry < now) {
        errs.date_of_expiry = 'End date must be in the future'
      }
    }
    if (type === 'visitor' && form.date_of_first_entry && form.date_of_expiry) {
      const startDate = new Date(form.date_of_first_entry)
      const endDate = new Date(form.date_of_expiry)
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate > endDate) {
        errs.date_of_first_entry = 'Start date must be before end date'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) { setSS(true); setTimeout(() => setSS(false), 600); return }

    const payload = { ...form }
    delete payload.profile_image
    delete payload.id_card_image
    delete payload.id_card_front
    delete payload.id_card_back
    delete payload.face_scan_1
    delete payload.face_scan_2
    delete payload.face_scan_3
    delete payload.face_scan_4
    delete payload.face_scan_5

    if (type === 'visitor') {
      payload.phone = payload.phone_number
      delete payload.phone_number
    }

    // Backend DateFields expect YYYY-MM-DD — strip any time suffix if present
    const stripDate = (v) => {
      if (!v) return ''
      return typeof v === 'string' && v.includes('T') ? v.split('T')[0] : v
    }
    payload.date_of_first_entry = stripDate(payload.date_of_first_entry)
    payload.date_of_expiry = stripDate(payload.date_of_expiry)
    if (editing && !payload.password) delete payload.password

    const capturesPayload = {}
    if (captures.profile) capturesPayload.profile_image_base64 = captures.profile
    if (captures.front)   capturesPayload.face_scan_1_base64 = captures.front
    if (captures.left)    capturesPayload.face_scan_2_base64 = captures.left
    if (captures.right)   capturesPayload.face_scan_3_base64 = captures.right
    if (captures.down)    capturesPayload.face_scan_4_base64 = captures.down
    if (captures.unusual) capturesPayload.face_scan_5_base64 = captures.unusual
    if (captures.id_front) capturesPayload.id_card_front_base64 = captures.id_front
    if (captures.id_back)  capturesPayload.id_card_back_base64  = captures.id_back

    try {
      // Return parent's promise so callers can await the save operation.
      const result = await onSubmit({
        ...payload,
        ...capturesPayload,
      })
      return result
    } catch (err) {
      // If backend returned field errors, surface them inline.
      const data = err?.response?.data || err?.data
      if (data && typeof data === 'object') {
        const newErrs = {}
        Object.entries(data).forEach(([k, v]) => {
          // join arrays of messages
          if (Array.isArray(v)) newErrs[k] = v.join('\n')
          else if (typeof v === 'string') newErrs[k] = v
          else newErrs[k] = JSON.stringify(v)
        })
        setErrors(prev => ({ ...prev, ...newErrs }))
      }
      throw err
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <ST>Basic Information</ST>
        <div className="grid grid-cols-3 gap-3">
          <F label={t('firstName')} fk="first_name" req form={form} errors={errors} set={set}/>
          <F label={t('middleName')} fk="middle_name" form={form} errors={errors} set={set}/>
          <F label={t('lastName')} fk="last_name" form={form} errors={errors} set={set}/>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <F label={t('phone')} fk="phone_number" form={form} errors={errors} set={set}/>
          <F label={t('email')} fk="email" type="email" form={form} errors={errors} set={set}/>
        </div>
        <div className="mt-3">
          <F label={t('gender')} fk="gender" form={form} errors={errors} set={set}
             opts={[['M', 'Male / ወንድ'], ['F', 'Female / ሴት']]}/>
        </div>
      </section>

      {(type === 'staff') && (
        <section>
          <ST>Work Details</ST>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('position')} fk="position" form={form} errors={errors} set={set}/>
            <F label={t('department')} fk="department" form={form} errors={errors} set={set}/>
          </div>
        </section>
      )}

      {(type === 'visitor') && (
        <section>
          <ST>Visit Period</ST>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('startDate')} fk="date_of_first_entry" type="datetime-local" form={form} errors={errors} set={set}/>
            <F label={t('endDate') + ' *'} fk="date_of_expiry" type="datetime-local" req form={form} errors={errors} set={set}/>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                   style={{ color: 'var(--color-text-muted)' }}>{t('reason')}</label>
            <textarea className="ameco-input" rows={2} value={form.reason} onChange={set('reason')}/>
          </div>
        </section>
      )}

      {(type === 'admin' || type === 'guard') && (
        <section>
          <ST>Account Credentials</ST>
          <div className="grid grid-cols-2 gap-3">
            <F label="Username *" fk="username" req form={form} errors={errors} set={set}/>
            <F label="Password *" fk="password" type="password" req form={form} errors={errors} set={set}/>
          </div>
        </section>
      )}

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
               style={{ color: 'var(--color-text-muted)' }}>{t('description')}</label>
        <textarea className="ameco-input" rows={2} value={form.description} onChange={set('description')}/>
      </div>

      {(editing && (initialData.profile_image || initialData.id_card_image || initialData.face_front || initialData.face_left || initialData.face_right || initialData.face_down || initialData.face_unusual || initialData.id_card_front || initialData.id_card_back)) && (
        <section>
          <ST>Existing Images</ST>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Profile Photo', initialData.profile_image],
              ['ID Card', initialData.id_card_image],
              ['Face Front', initialData.face_front],
              ['Face Left', initialData.face_left],
              ['Face Right', initialData.face_right],
              ['Face Down', initialData.face_down],
              ['Face Unusual', initialData.face_unusual],
              ['ID Front', initialData.id_card_front],
              ['ID Back', initialData.id_card_back],
            ].map(([label, imgUrl]) => (
              <div key={label} className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--color-border-main)' }}>
                <p className="px-3 py-2 text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  {label}
                </p>
                {imgUrl ? (
                  <img src={imgUrl} alt={label} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center bg-[rgba(204,0,0,0.05)]"
                       style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                    No image
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <ST>Biometric Capture</ST>
        <CaptureSystem values={captures} onChange={setCaptures}/>
      </section>

      <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-main)' }}>
        <button type="button" onClick={onCancel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-card-hover)', border: '1px solid var(--color-border-main)', color: 'var(--color-text-muted)' }}>
          <X size={14}/> {t('cancel')}
        </button>
        <button type="submit" disabled={loading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white${submitShake ? ' animate-error-shake' : ''}`}
                style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)', opacity: loading ? 0.6 : 1 }}>
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <Save size={14}/>}
          {t('save')}
        </button>
      </div>
    </form>
  )
}