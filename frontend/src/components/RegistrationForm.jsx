/**
 * RegistrationForm.jsx
 * Handles registration + editing for all user types: admin, staff, guard, visitor.
 *
 * Key fixes in this version:
 *  - NO separate "Existing Images" section — existing images shown in their CaptureSystem slots
 *  - All saved biometric images reliably pre-fill from initialData on every edit open
 *  - Comprehensive validation (required fields, email, phone, username uniqueness, date logic)
 *  - Username duplicate check against all existing users before submit
 *  - Base64 captures only sent when the user actually retook an image (not re-sending existing URLs)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Save, X, AlertCircle, Eye, EyeOff, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react'
import CaptureSystem from './CaptureSystem'
import { useLang } from '../context/LanguageContext'
import { staffAPI, adminsAPI, guardsAPI } from '../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Field component
// ─────────────────────────────────────────────────────────────────────────────
const F = ({ label, fk, type: t2 = 'text', req = false, opts = null,
             form, errors, set, hint = null, disabled = false }) => {
  const [show, setShow] = useState(false)
  const isPassword = fk === 'password' || t2 === 'password'
  const isCalendar = t2 === 'date' || t2 === 'datetime-local'
  const hasErr = !!errors[fk]

  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
             style={{ color: hasErr ? '#cc0000' : 'var(--color-text-muted)' }}>
        {label}{req ? ' *' : ''}
      </label>
      {opts ? (
        <select
          className="ameco-input"
          value={form[fk] ?? ''}
          onChange={set(fk)}
          disabled={disabled}
          style={hasErr ? { borderColor: '#cc0000', background: 'rgba(204,0,0,0.04)' } : {}}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <div className="relative">
          <input
            id={fk}
            type={isPassword && !show ? 'password' : isCalendar ? t2 : t2}
            className={`ameco-input pr-9${hasErr ? ' animate-error-shake' : ''}`}
            value={form[fk] || ''}
            onChange={set(fk)}
            disabled={disabled}
            autoComplete={isPassword ? 'new-password' : fk === 'username' ? 'off' : undefined}
            style={hasErr ? { borderColor: '#cc0000', background: 'rgba(204,0,0,0.04)' } : {}}
          />
          {isCalendar && (
            <button type="button"
                    onClick={() => document.getElementById(fk)?.showPicker?.() || document.getElementById(fk)?.focus()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded opacity-70 hover:opacity-100"
                    style={{ color: 'var(--color-text-muted)' }}>
              <CalendarDays size={16} />
            </button>
          )}
          {isPassword && (
            <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              {show ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          )}
          {hasErr && !isPassword && !isCalendar && (
            <AlertCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                         style={{ color: '#cc0000' }}/>
          )}
        </div>
      )}
      {hasErr && (
        <p className="mt-1 text-xs flex items-center gap-1" style={{ color: '#cc0000' }}>
          <AlertCircle size={11}/> {typeof errors[fk] === 'string' ? errors[fk] : 'Required'}
        </p>
      )}
      {!hasErr && hint && (
        <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
      )}
    </div>
  )
}

const ST = ({ children }) => (
  <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 pb-2 border-b"
      style={{ color: '#cc0000', borderColor: 'rgba(204,0,0,0.2)' }}>{children}</h4>
)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toDateTimeLocal(value) {
  if (!value) return ''
  if (typeof value === 'string' && value.includes('T')) return value.slice(0, 16)
  return `${value}T00:00`
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone) {
  // Ethiopian phone: 09xxxxxxxx or +2519xxxxxxxx or 9 digits
  return /^(\+?251)?0?[79]\d{8}$/.test(phone.replace(/\s/g, '')) ||
         /^\+?[\d\s\-]{7,15}$/.test(phone)
}

// Extract existing images from initialData for pre-filling CaptureSystem slots
function extractExistingImages(data) {
  if (!data) return {}
  return {
    profile:  data.profile_image   || data.profile_image_url  || null,
    id_front: data.id_card_front   || data.id_card_image       || null,
    id_back:  data.id_card_back                                || null,
    front:    data.face_front      || data.face_scan_1         || null,
    left:     data.face_left       || data.face_scan_2         || null,
    right:    data.face_right      || data.face_scan_3         || null,
    down:     data.face_down       || data.face_scan_4         || null,
    unusual:  data.face_unusual    || data.face_scan_5         || null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function RegistrationForm({
  type,
  onSubmit,
  onCancel,
  loading = false,
  initialData = {},
  editing = false,
}) {
  const { t } = useLang()

  const defaultForm = {
    first_name: '', middle_name: '', last_name: '',
    phone_number: '', email: '', gender: 'M',
    position: '', department: '', description: '',
    username: '', password: '',
    date_of_first_entry: '', date_of_expiry: '', reason: '',
    gate_camera_id: '', gates_assigned_to: '',
  }

  const [form,    setForm]    = useState({ ...defaultForm })
  const [captures, setCaptures] = useState({})          // only NEW base64 captures
  const [existing, setExisting] = useState({})          // existing URL images
  const [errors,  setErrors]  = useState({})
  const [submitShake, setSS]  = useState(false)
  const [checkingUser, setCheckingUser] = useState(false)
  const usernameCheckTimer = useRef(null)

  // ── Pre-fill form and existing images whenever initialData changes ──────────
  useEffect(() => {
    const id = initialData || {}
    const phoneValue = id.phone || id.phone_number || ''

    setForm({
      ...defaultForm,
      first_name:          id.first_name          || '',
      middle_name:         id.middle_name         || '',
      last_name:           id.last_name           || '',
      phone_number:        phoneValue,
      email:               id.email               || '',
      gender:              id.gender              || 'M',
      position:            id.position            || '',
      department:          id.department          || '',
      description:         id.description         || '',
      username:            id.username            || '',
      password:            '',                           // never pre-fill password
      date_of_first_entry: toDateTimeLocal(id.date_of_first_entry),
      date_of_expiry:      toDateTimeLocal(id.date_of_expiry),
      reason:              id.reason              || '',
      gate_camera_id:      id.gate_camera_id      || '',
      gates_assigned_to:   id.gates_assigned_to   || '',
    })

    // Always extract and set existing images — fixes "images missing on edit"
    setExisting(extractExistingImages(id))
    setCaptures({})   // reset new captures
    setErrors({})
  }, [initialData?.id, JSON.stringify(initialData)])    // re-run when record changes

  // ── Field setter — clears error on change ──────────────────────────────────
  const set = useCallback((key) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [key]: val }))
    setErrors(err => {
      if (!err[key]) return err
      const n = { ...err }; delete n[key]; return n
    })
    // Debounced username uniqueness check
    if (key === 'username' && val.trim().length >= 3) {
      clearTimeout(usernameCheckTimer.current)
      usernameCheckTimer.current = setTimeout(() => checkUsernameUnique(val.trim()), 500)
    }
  }, [editing, initialData?.username])

  // ── Username uniqueness check ─────────────────────────────────────────────
  const checkUsernameUnique = async (username) => {
    if (editing && username === (initialData?.username || '')) return // same username = OK
    setCheckingUser(true)
    try {
      const results = await Promise.allSettled([
        adminsAPI.list(),
        guardsAPI.list(),
      ])
      const allUsers = results.flatMap(r =>
        r.status === 'fulfilled' ? (r.value.data.results || r.value.data) : []
      )
      const exists = allUsers.some(u =>
        u.username === username && u.id !== initialData?.id
      )
      if (exists) {
        setErrors(e => ({ ...e, username: 'Username already taken — choose another' }))
      } else {
        setErrors(e => { const n = { ...e }; delete n.username; return n })
      }
    } catch {}
    finally { setCheckingUser(false) }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}

    // Required: first name always
    if (!form.first_name?.trim()) errs.first_name = 'First name is required'

    // Username + password for new admin/guard
    if (type === 'admin' || type === 'guard') {
      if (!form.username?.trim()) {
        errs.username = 'Username is required'
      } else if (form.username.trim().length < 3) {
        errs.username = 'Username must be at least 3 characters'
      } else if (/\s/.test(form.username)) {
        errs.username = 'Username cannot contain spaces'
      }
      if (!editing && !form.password?.trim()) {
        errs.password = 'Password is required'
      } else if (!editing && form.password.length < 6) {
        errs.password = 'Password must be at least 6 characters'
      }
    }

    // Email format (if provided)
    if (form.email && !isValidEmail(form.email)) {
      errs.email = 'Enter a valid email address'
    }

    // Phone format (if provided)
    if (form.phone_number && !isValidPhone(form.phone_number)) {
      errs.phone_number = 'Enter a valid phone number'
    }

    // Visitor-specific
    if (type === 'visitor') {
      if (!form.date_of_expiry) {
        errs.date_of_expiry = 'Expiry date/time is required'
      } else {
        const expiry = new Date(form.date_of_expiry)
        if (isNaN(expiry.getTime())) {
          errs.date_of_expiry = 'Invalid date/time format'
        } else if (!editing && expiry <= new Date()) {
          errs.date_of_expiry = 'Expiry must be a future date and time'
        }
      }
      if (form.date_of_first_entry && form.date_of_expiry) {
        const s = new Date(form.date_of_first_entry)
        const e = new Date(form.date_of_expiry)
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s >= e) {
          errs.date_of_first_entry = 'Start date must be before expiry date'
        }
      }
    }

    // Surface any already-detected username error
    if (errors.username) errs.username = errors.username

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      setSS(true)
      setTimeout(() => setSS(false), 600)
      // Scroll to first error
      const firstErrKey = Object.keys(errors)[0]
      if (firstErrKey) document.getElementById(firstErrKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const payload = { ...form }

    // Strip image URL fields from form payload — images go as base64 in capturesPayload
    ;['profile_image','id_card_image','id_card_front','id_card_back',
      'face_front','face_left','face_right','face_down','face_unusual',
      'face_scan_1','face_scan_2','face_scan_3','face_scan_4','face_scan_5',
    ].forEach(k => delete payload[k])

    // Visitor uses 'phone' not 'phone_number'
    if (type === 'visitor') {
      payload.phone = payload.phone_number
      delete payload.phone_number
    }

    // Strip time component from date fields for backend DateField
    const stripTime = v => (!v ? '' : v.includes('T') ? v.split('T')[0] : v)
    payload.date_of_first_entry = stripTime(payload.date_of_first_entry)
    payload.date_of_expiry      = stripTime(payload.date_of_expiry)

    // Don't send blank password on edit
    if (editing && !payload.password?.trim()) delete payload.password

    // Build captures payload — ONLY include newly captured base64 images
    // (not the existing URLs — backend already has those)
    const capturesPayload = {}
    if (captures.profile  && captures.profile.startsWith('data:'))  capturesPayload.profile_image_base64   = captures.profile
    if (captures.front    && captures.front.startsWith('data:'))    capturesPayload.face_scan_1_base64     = captures.front
    if (captures.left     && captures.left.startsWith('data:'))     capturesPayload.face_scan_2_base64     = captures.left
    if (captures.right    && captures.right.startsWith('data:'))    capturesPayload.face_scan_3_base64     = captures.right
    if (captures.down     && captures.down.startsWith('data:'))     capturesPayload.face_scan_4_base64     = captures.down
    if (captures.unusual  && captures.unusual.startsWith('data:'))  capturesPayload.face_scan_5_base64     = captures.unusual
    if (captures.id_front && captures.id_front.startsWith('data:')) capturesPayload.id_card_front_base64  = captures.id_front
    if (captures.id_back  && captures.id_back.startsWith('data:'))  capturesPayload.id_card_back_base64   = captures.id_back

    try {
      await onSubmit({ ...payload, ...capturesPayload })
    } catch (err) {
      // Surface backend field errors inline
      const data = err?.response?.data || err?.data
      if (data && typeof data === 'object') {
        const backendErrs = {}
        Object.entries(data).forEach(([k, v]) => {
          backendErrs[k] = Array.isArray(v) ? v.join(' ') : String(v)
        })
        setErrors(prev => ({ ...prev, ...backendErrs }))
        setSS(true); setTimeout(() => setSS(false), 600)
      }
      throw err
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>

      {/* ── Basic Information ── */}
      <section>
        <ST>Basic Information</ST>
        <div className="grid grid-cols-3 gap-3">
          <F label={t('firstName') || 'First Name'} fk="first_name" req form={form} errors={errors} set={set}/>
          <F label={t('middleName') || 'Middle Name'} fk="middle_name" form={form} errors={errors} set={set}/>
          <F label={t('lastName') || 'Last Name'} fk="last_name" form={form} errors={errors} set={set}/>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <F label={t('phone') || 'Phone'} fk="phone_number" form={form} errors={errors} set={set}
             hint="e.g. 0912345678 or +251912345678"/>
          <F label={t('email') || 'Email'} fk="email" type="email" form={form} errors={errors} set={set}/>
        </div>
        <div className="mt-3">
          <F label={t('gender') || 'Gender'} fk="gender" form={form} errors={errors} set={set}
             opts={[['M', 'Male / ወንድ'], ['F', 'Female / ሴት']]}/>
        </div>
      </section>

      {/* ── Work Details (staff) ── */}
      {type === 'staff' && (
        <section>
          <ST>Work Details</ST>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('position') || 'Position'} fk="position" form={form} errors={errors} set={set}/>
            <F label={t('department') || 'Department'} fk="department" form={form} errors={errors} set={set}/>
          </div>
        </section>
      )}

      {/* ── Visit Period (visitor) ── */}
      {type === 'visitor' && (
        <section>
          <ST>Visit Period</ST>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('startDate') || 'Start Date/Time'} fk="date_of_first_entry"
               type="datetime-local" form={form} errors={errors} set={set}/>
            <F label={(t('endDate') || 'Expiry Date/Time') + ' *'} fk="date_of_expiry"
               type="datetime-local" req form={form} errors={errors} set={set}/>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
                   style={{ color: 'var(--color-text-muted)' }}>
              {t('reason') || 'Reason for Visit'}
            </label>
            <textarea className="ameco-input" rows={2} value={form.reason} onChange={set('reason')}/>
          </div>
        </section>
      )}

      {/* ── Account Credentials (admin / guard) ── */}
      {(type === 'admin' || type === 'guard') && (
        <section>
          <ST>Account Credentials</ST>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label="Username *" fk="username" req form={form} errors={errors} set={set}
                 hint="Min. 3 chars, no spaces"/>
              {checkingUser && (
                <p className="mt-1 text-[10px] flex items-center gap-1" style={{ color: '#f59e0b' }}>
                  <Loader2 size={10} className="animate-spin"/> Checking availability…
                </p>
              )}
              {!checkingUser && form.username?.trim().length >= 3 && !errors.username && (
                <p className="mt-1 text-[10px] flex items-center gap-1" style={{ color: '#22c55e' }}>
                  <CheckCircle2 size={10}/> Username available
                </p>
              )}
            </div>
            <F label={editing ? 'New Password (leave blank to keep)' : 'Password *'}
               fk="password" type="password"
               req={!editing}
               form={form} errors={errors} set={set}
               hint={editing ? undefined : 'Min. 6 characters'}/>
          </div>
        </section>
      )}

      {/* ── Description ── */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5"
               style={{ color: 'var(--color-text-muted)' }}>
          {t('description') || 'Description / Notes'}
        </label>
        <textarea className="ameco-input" rows={2} value={form.description} onChange={set('description')}/>
      </div>

      {/* ── Biometric Capture — existing images pre-filled inline ── */}
      <section>
        <ST>Biometric Capture</ST>
        <CaptureSystem
          values={captures}
          onChange={setCaptures}
          existingImages={existing}
        />
      </section>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-main)' }}>
        <button type="button" onClick={onCancel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-card-hover)', border: '1px solid var(--color-border-main)', color: 'var(--color-text-muted)' }}>
          <X size={14}/> {t('cancel') || 'Cancel'}
        </button>
        <button type="submit" disabled={loading || checkingUser || !!errors.username}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white${submitShake ? ' animate-error-shake' : ''}`}
                style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)', opacity: (loading || checkingUser || !!errors.username) ? 0.6 : 1 }}>
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <Save size={14}/>}
          {t('save') || 'Save'}
        </button>
      </div>
    </form>
  )
}