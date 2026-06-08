/**
 * ImportStaffModal.jsx — AMECO External Staff Import
 *
 * Three-step wizard:
 *   Step 1 — Connection form  (DB engine, host, credentials, table, field map)
 *   Step 2 — Preview table    (shows fetched rows, admin selects which to import)
 *   Step 3 — Live import      (streaming progress bar, per-row status)
 */

import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Link2, Download, CheckCircle2,
  XCircle, AlertCircle, ChevronRight, ChevronLeft,
  Loader2, X, RefreshCw, Check, Minus,
} from 'lucide-react'
import PasswordInput from './PasswordInput'
import toast from 'react-hot-toast'
import { BASE_URL } from '../services/api'
import { useAuth } from '../context/AuthContext'

const api = (path, opts = {}) =>
  fetch(`${BASE_URL}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      ...opts.headers,
    },
    ...opts,
  })

// ── Field map editor ──────────────────────────────────────────────────────────
const AMECO_FIELDS = [
  { key: 'first_name',        label: 'First Name',        required: true  },
  { key: 'middle_name',       label: 'Middle Name',        required: false },
  { key: 'last_name',         label: 'Last Name',          required: false },
  { key: 'email',             label: 'Email',              required: false },
  { key: 'phone_number',      label: 'Phone',              required: false },
  { key: 'position',          label: 'Position',           required: false },
  { key: 'department',        label: 'Department',         required: false },
  { key: 'gender',            label: 'Gender (M/F/O)',     required: false },
  { key: 'profile_image_url', label: 'Profile Image URL',  required: false },
  { key: 'face_front_url',    label: 'Face Front URL',     required: false },
  { key: 'face_left_url',     label: 'Face Left URL',      required: false },
  { key: 'face_right_url',    label: 'Face Right URL',     required: false },
  { key: 'face_down_url',     label: 'Face Down URL',      required: false },
  { key: 'face_unusual_url',  label: 'Face Angled URL',    required: false },
]

const DEFAULT_MAP = Object.fromEntries(
  AMECO_FIELDS.map(f => [f.key, f.key.replace('_url', '').replace('phone_number', 'phone')])
)

// ── Styles ────────────────────────────────────────────────────────────────────
const inputCls = `
  w-full px-3 py-2 rounded-xl text-sm outline-none transition-all
  border border-[var(--color-border-main)]
  bg-[var(--color-card-bg)] text-[var(--color-text-main)]
  focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc000040]
`
const labelCls = 'block text-xs font-semibold mb-1 text-[var(--color-text-muted)]'

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Connect', 'Preview', 'Import']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
              ${i < current ? 'bg-green-500 text-white' :
                i === current ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
              style={i === current ? { background: 'linear-gradient(135deg,#cc0000,#aa0000)' } :
                i < current ? {} : { background: 'var(--color-card-hover)' }}>
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs font-semibold ${i === current ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px" style={{
              background: i < current ? '#22c55e' : 'var(--color-border-main)'
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportStaffModal({ onClose, onImportDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)

  // Step 1 — connection
  const [conn, setConn] = useState({
    engine: 'postgresql', host: '', port: '', database: '',
    username: '', password: '', ssl_mode: 'prefer',
  })
  const [table,        setTable]        = useState('employees')
  const [fieldMap,     setFieldMap]      = useState(DEFAULT_MAP)
  const [showFieldMap, setShowFieldMap]  = useState(false)
  const [connecting,   setConnecting]    = useState(false)

  // Step 2 — preview
  const [previewRows,  setPreviewRows]   = useState([])
  const [selected,     setSelected]      = useState(new Set())
  const [skipExisting, setSkipExisting]  = useState(true)

  // Step 3 — import progress
  const [importing,    setImporting]     = useState(false)
  const [log,          setLog]           = useState([])   // [{status,message,name}]
  const [summary,      setSummary]       = useState(null)
  const logRef = useRef(null)

  const setConnField = (k, v) => setConn(p => ({ ...p, [k]: v }))

  // ── Step 1: fetch preview ──────────────────────────────────────────────────
  const fetchPreview = async () => {
    setConnecting(true)
    try {
      const res = await api('/staff/import/preview/', {
        method: 'POST',
        body: JSON.stringify({
          connection: { ...conn, port: conn.port ? Number(conn.port) : undefined },
          table,
          field_map: fieldMap,
          preview_limit: 100,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')

      setPreviewRows(data.rows || [])
      setSelected(new Set(data.rows.map((_, i) => i)))
      toast.success(data.message || `Found ${data.total} records`)
      setStep(1)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConnecting(false)
    }
  }

  // ── Step 2: toggle selection ───────────────────────────────────────────────
  const toggleRow = (i) => setSelected(prev => {
    const s = new Set(prev)
    s.has(i) ? s.delete(i) : s.add(i)
    return s
  })

  const toggleAll = () => setSelected(
    selected.size === previewRows.length
      ? new Set()
      : new Set(previewRows.map((_, i) => i))
  )

  // ── Step 3: run import (streaming) ────────────────────────────────────────
  const runImport = async () => {
    setImporting(true)
    setLog([])
    setSummary(null)
    setStep(2)

    try {
      const res = await fetch(`${BASE_URL}/api/staff/import/run/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          connection:       { ...conn, port: conn.port ? Number(conn.port) : undefined },
          table,
          field_map:        fieldMap,
          selected_indices: [...selected].sort((a, b) => a - b),
          skip_existing:    skipExisting,
          registered_by:    user?.username || 'admin',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Import failed')
      }

      // Read the streaming NDJSON response
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()   // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'progress') {
              setLog(prev => [...prev, event])
              // Auto-scroll log
              setTimeout(() => logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
            } else if (event.type === 'done') {
              setSummary(event)
              onImportDone?.()
            }
          } catch {}
        }
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setImporting(false)
    }
  }

  // ── Status icon ───────────────────────────────────────────────────────────
  const StatusIcon = ({ status }) => {
    if (status === 'created') return <CheckCircle2 size={13} className="text-green-400 shrink-0" />
    if (status === 'skipped') return <AlertCircle  size={13} className="text-amber-400 shrink-0" />
    return <XCircle size={13} className="text-red-400 shrink-0" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.95, y: 20  }}
        className="w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
             style={{ borderBottom: '1px solid var(--color-border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(204,0,0,0.1)' }}>
              <Database size={18} style={{ color: '#cc0000' }} />
            </div>
            <div>
              <h2 className="font-black text-base" style={{ color: 'var(--color-text-main)' }}>
                Import Staff from Company Database
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Connect to your hosting company's HR database and import staff records
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--color-card-hover)]">
            <X size={16} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Steps current={step} />

          <AnimatePresence mode="wait">

            {/* ── Step 0: Connection ── */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Database Engine">
                    <select value={conn.engine} onChange={e => setConnField('engine', e.target.value)} className={inputCls}>
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL / MariaDB</option>
                      <option value="mssql">Microsoft SQL Server</option>
                      <option value="sqlite">SQLite (file path)</option>
                    </select>
                  </Field>
                  <Field label="Table / View Name">
                    <input value={table} onChange={e => setTable(e.target.value)}
                           placeholder="employees" className={inputCls} />
                  </Field>
                </div>

                {conn.engine !== 'sqlite' && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Field label="Host / IP Address">
                          <input value={conn.host} onChange={e => setConnField('host', e.target.value)}
                                 placeholder="db.company.com" className={inputCls} />
                        </Field>
                      </div>
                      <Field label="Port">
                        <input value={conn.port} onChange={e => setConnField('port', e.target.value)}
                               placeholder={conn.engine === 'mssql' ? '1433' : conn.engine === 'mysql' ? '3306' : '5432'}
                               className={inputCls} />
                      </Field>
                    </div>

                    <Field label="Database Name">
                      <input value={conn.database} onChange={e => setConnField('database', e.target.value)}
                             placeholder="hr_system" className={inputCls} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Username">
                        <input value={conn.username} onChange={e => setConnField('username', e.target.value)}
                               placeholder="readonly_user" className={inputCls} autoComplete="off" />
                      </Field>
                      <Field label="Password">
                        <PasswordInput
                          value={conn.password}
                          onChange={e => setConnField('password', e.target.value)}
                          placeholder="••••••••"
                          className={inputCls}
                          autoComplete="new-password"
                        />
                      </Field>
                    </div>

                    {conn.engine === 'postgresql' && (
                      <Field label="SSL Mode">
                        <select value={conn.ssl_mode} onChange={e => setConnField('ssl_mode', e.target.value)} className={inputCls}>
                          <option value="prefer">Prefer (recommended)</option>
                          <option value="require">Require</option>
                          <option value="disable">Disable</option>
                        </select>
                      </Field>
                    )}
                  </>
                )}

                {conn.engine === 'sqlite' && (
                  <Field label="Database File Path">
                    <input value={conn.database} onChange={e => setConnField('database', e.target.value)}
                           placeholder="/path/to/hr.db" className={inputCls} />
                  </Field>
                )}

                {/* Field mapping (collapsible) */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-main)' }}>
                  <button
                    onClick={() => setShowFieldMap(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                    style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-main)' }}>
                    <span className="flex items-center gap-2">
                      <Link2 size={14} style={{ color: '#cc0000' }} />
                      Column Mapping
                      <span className="text-xs font-normal opacity-60">(map their column names → AMECO fields)</span>
                    </span>
                    <ChevronRight size={14} className={`transition-transform ${showFieldMap ? 'rotate-90' : ''}`} />
                  </button>

                  {showFieldMap && (
                    <div className="p-4 grid grid-cols-2 gap-2"
                         style={{ borderTop: '1px solid var(--color-border-main)' }}>
                      {AMECO_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="text-xs w-36 shrink-0 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            {f.label}{f.required && <span className="text-red-400"> *</span>}
                          </span>
                          <input
                            value={fieldMap[f.key] || ''}
                            onChange={e => setFieldMap(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.key}
                            className={`${inputCls} text-xs`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="rounded-2xl p-4 text-xs space-y-1"
                     style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                  <p className="font-semibold">Requirements from your hosting company:</p>
                  <p>• A read-only database user with SELECT access on the staff table</p>
                  <p>• The database port must be accessible from this server (whitelist this server's IP)</p>
                  <p>• Face image URLs must be publicly accessible or base64-encoded in the table</p>
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Preview ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-4">

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                    {previewRows.length} records found — select which to import
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                      <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)}
                             className="w-3.5 h-3.5 accent-[#cc0000]" />
                      Skip already-imported staff
                    </label>
                    <button onClick={toggleAll}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)' }}>
                      {selected.size === previewRows.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-main)' }}>
                  {/* Table header */}
                  <div className="grid text-[10px] font-black uppercase tracking-wide px-3 py-2"
                       style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)',
                                gridTemplateColumns: '28px 1fr 1fr 1fr 60px 60px' }}>
                    <span></span>
                    <span>Name</span>
                    <span>Position</span>
                    <span>Department</span>
                    <span>Photo</span>
                    <span>Faces</span>
                  </div>

                  {/* Rows */}
                  <div className="max-h-[36vh] overflow-y-auto divide-y"
                       style={{ divideColor: 'var(--color-border-main)' }}>
                    {previewRows.map((row, i) => (
                      <div key={i}
                           onClick={() => toggleRow(i)}
                           className="grid items-center px-3 py-2.5 cursor-pointer hover:bg-[var(--color-card-hover)] transition-colors"
                           style={{ gridTemplateColumns: '28px 1fr 1fr 1fr 60px 60px' }}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                          ${selected.has(i) ? 'border-[#cc0000]' : 'border-[var(--color-border-main)]'}`}
                             style={selected.has(i) ? { background: '#cc0000' } : {}}>
                          {selected.has(i) && <Check size={10} color="white" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                            {row.first_name} {row.middle_name} {row.last_name}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{row.email}</p>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.position || '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.department || '—'}</p>
                        <span className={`text-[10px] font-bold ${row.has_photo ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
                          {row.has_photo ? '✓' : '—'}
                        </span>
                        <span className={`text-[10px] font-bold ${row.has_faces ? 'text-green-400' : 'text-amber-400'}`}>
                          {row.has_faces ? '✓' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-semibold" style={{ color: '#cc0000' }}>{selected.size}</span> of {previewRows.length} selected
                  {selected.size > 0 && !previewRows.filter((r,i) => selected.has(i)).some(r => r.has_faces) && (
                    <span className="text-amber-400 ml-2">⚠ None of the selected records have face images — they will be imported without face recognition</span>
                  )}
                </p>
              </motion.div>
            )}

            {/* ── Step 2: Import progress ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          className="space-y-4">

                {/* Progress bar */}
                {importing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin text-[#cc0000]" />
                        Importing...
                      </span>
                      <span>{log.length} / {selected.size} done</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-card-hover)' }}>
                      <motion.div className="h-full rounded-full"
                                  style={{ background: 'linear-gradient(90deg,#cc0000,#ff4444)', width: `${(log.length / selected.size) * 100}%` }}
                                  transition={{ duration: 0.3 }} />
                    </div>
                  </div>
                )}

                {/* Summary */}
                {summary && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Imported', value: summary.created, color: '#22c55e' },
                      { label: 'Skipped',  value: summary.skipped, color: '#f59e0b' },
                      { label: 'Errors',   value: summary.errors,  color: '#ef4444' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-2xl p-4 text-center"
                           style={{ background: 'var(--color-card-hover)', border: '1px solid var(--color-border-main)' }}>
                        <p className="text-2xl font-black" style={{ color }}>{value}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Log */}
                <div ref={logRef}
                     className="rounded-2xl p-3 max-h-[40vh] overflow-y-auto space-y-1 font-mono text-[11px]"
                     style={{ background: '#060606', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {log.length === 0 && importing && (
                    <p style={{ color: '#555' }}>Connecting to database...</p>
                  )}
                  {log.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <StatusIcon status={entry.status} />
                      <span style={{
                        color: entry.status === 'created' ? '#86efac'
                             : entry.status === 'skipped' ? '#fcd34d' : '#fca5a5'
                      }}>
                        {entry.message}
                      </span>
                    </div>
                  ))}
                  {summary && (
                    <p className="pt-2 font-bold" style={{ color: '#cc0000' }}>
                      ✓ Import complete — face recognition cache reloaded.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
             style={{ borderTop: '1px solid var(--color-border-main)' }}>

          <div>
            {step > 0 && step < 2 && !importing && (
              <button onClick={() => setStep(s => s - 1)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border-main)' }}>
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 2 && summary && (
              <button onClick={onClose}
                      className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
                Done
              </button>
            )}

            {step === 0 && (
              <button onClick={fetchPreview} disabled={connecting}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                {connecting ? 'Connecting...' : 'Connect & Preview'}
                {!connecting && <ChevronRight size={14} />}
              </button>
            )}

            {step === 1 && (
              <button onClick={runImport} disabled={selected.size === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}>
                <Download size={14} />
                Import {selected.size} Staff Member{selected.size !== 1 ? 's' : ''}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
