/**
 * components/guard/DigitalIDCard.jsx
 * AMECO — Full-detail Digital ID Card popup.
 * Opens when guard taps the CompactIDOverlay, or directly for denied/locked states.
 *
 * Design: physical ID card aesthetic — white card, red AMECO header,
 * barcode footer, bilingual (EN/AM) labels, auto-close countdown ring.
 */

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ShieldCheck, ShieldX, Clock, CheckCircle,
  Phone, Building2, Hash, Calendar, UserCog,
  Shield, User, UserCheck,
} from 'lucide-react'
import logoImage from '../../assets/logo.png'

const BASE_URL = 'http://127.0.0.1:8000'
const AUTO_CLOSE_MS = 12000

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  ADMIN:   { color: '#cc0000', label: 'Admin',   labelAm: 'አስተዳዳሪ',  Icon: UserCog,   bg: '#fff5f5' },
  GUARD:   { color: '#2563eb', label: 'Guard',   labelAm: 'ጠባቂ',     Icon: Shield,    bg: '#eff6ff' },
  STAFF:   { color: '#059669', label: 'Staff',   labelAm: 'ሠራተኛ',   Icon: User,      bg: '#f0fdf4' },
  VISITOR: { color: '#d97706', label: 'Visitor', labelAm: 'ጎብኚ',     Icon: UserCheck, bg: '#fffbeb' },
}
function getRoleCfg(role = '') {
  return ROLE_CONFIG[role.toUpperCase()] || ROLE_CONFIG.STAFF
}

// ── Barcode strip ─────────────────────────────────────────────────────────────
function BarcodeStrip({ id = '', color = '#cc0000' }) {
  // Generate pseudo-barcode widths from digital_id chars
  const bars = (id || 'AMECO').split('').flatMap(c => {
    const n = c.charCodeAt(0) % 4
    return [n + 1, 1]   // bar width, gap width
  })
  return (
    <div className="flex items-center gap-px h-8" style={{ opacity: 0.7 }}>
      {bars.map((w, i) =>
        i % 2 === 0 ? (
          <div key={i} style={{ width: w * 2, height: '100%', background: color, borderRadius: 1 }} />
        ) : (
          <div key={i} style={{ width: w, height: '100%' }} />
        )
      )}
    </div>
  )
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ LabelIcon, en, am, value, color, mono }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}15` }}
      >
        <LabelIcon size={11} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest leading-none" style={{ color }}>
          {en} · <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{am}</span>
        </p>
        <p
          className={`text-sm font-bold mt-0.5 leading-tight ${mono ? 'font-mono' : ''}`}
          style={{ color: '#111', letterSpacing: mono ? '0.08em' : 0 }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// ── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({ totalMs, onExpire }) {
  const [pct, setPct] = useState(100)
  const startRef = useRef(Date.now())
  const rafRef   = useRef(null)

  useEffect(() => {
    startRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const p = Math.max(0, 100 - (elapsed / totalMs) * 100)
      setPct(p)
      if (p > 0) { rafRef.current = requestAnimationFrame(tick) }
      else        { onExpire() }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [totalMs, onExpire])

  const r  = 14
  const cx = 16
  const circumference = 2 * Math.PI * r
  const dash = (pct / 100) * circumference

  return (
    <svg width={32} height={32} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={2.5} />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="rgba(204,0,0,0.5)"
        strokeWidth={2.5}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DigitalIDCard({ person, onClose }) {
  if (!person) return null

  const isGranted = Boolean(person.access_granted)
  const isLocked  = Boolean(person.locked_out)
  const roleCfg   = getRoleCfg(person.user_type || person.role)

  const imageUrl = person.profile_image
    ? (person.profile_image.startsWith('http')
        ? person.profile_image
        : `${BASE_URL}${person.profile_image}`)
    : null

  const accentColor = isGranted ? roleCfg.color : isLocked ? '#d97706' : '#cc0000'

  const formatDate = (iso) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
    catch { return iso }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="id-card-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ scale: 0.82, opacity: 0, y: 40 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 0.82, opacity: 0, y: 40  }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="relative w-full max-w-[400px] rounded-[28px] overflow-hidden"
          style={{
            background: '#ffffff',
            boxShadow: isGranted
              ? `0 0 0 1px ${roleCfg.color}30, 0 30px 80px rgba(0,0,0,0.7), 0 0 60px ${roleCfg.color}25`
              : '0 0 0 1px rgba(204,0,0,0.3), 0 30px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* ── Status banner ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            className="flex items-center justify-center gap-2 py-2.5"
            style={{
              background: isGranted ? '#00cc66' : isLocked ? '#d97706' : '#cc0000',
              transformOrigin: 'left',
            }}
          >
            {isGranted ? (
              <><ShieldCheck size={14} color="white" />
                <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
                  Access Granted · ፈቃድ ተሰጥቷል
                </span></>
            ) : isLocked ? (
              <><Clock size={14} color="white" />
                <span className="text-white text-[11px] font-black uppercase tracking-widest">
                  Face Locked — Wait {person.seconds_remaining}s
                </span></>
            ) : (
              <><ShieldX size={14} color="white" />
                <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
                  Access Denied · ፈቃድ አልተሰጠም
                </span></>
            )}
          </motion.div>

          {/* ── AMECO Header ──────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{
              background: 'linear-gradient(135deg, #cc0000 0%, #990000 100%)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                 style={{ background: 'white', padding: 4 }}>
              <img src={logoImage} alt="AMECO" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-base leading-tight">
                አማራ ሚዲያ ኮርፖሬሽን
              </p>
              <p className="text-white/75 text-[10px] font-bold tracking-widest uppercase mt-0.5">
                Amhara Media Corporation
              </p>
              <p className="text-white/50 text-[9px] font-bold tracking-widest uppercase">
                AMECO Security Access System
              </p>
            </div>

            {/* Countdown ring + close */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {isGranted && (
                <CountdownRing totalMs={AUTO_CLOSE_MS} onExpire={onClose} />
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-xl flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Card body ─────────────────────────────────────────────────── */}
          {isGranted ? (
            <div style={{ background: roleCfg.bg || '#fafafa' }}>

              {/* Photo + core info */}
              <div className="flex gap-4 px-5 pt-5 pb-4">

                {/* Photo */}
                <div className="flex-shrink-0">
                  <div
                    className="w-28 h-32 rounded-2xl overflow-hidden"
                    style={{ border: `3px solid ${roleCfg.color}30`, background: '#f0f0f0' }}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={person.person_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                           style={{ background: `${roleCfg.color}08` }}>
                        <roleCfg.Icon size={32} style={{ color: `${roleCfg.color}60` }} />
                        <span className="text-[9px] font-black" style={{ color: `${roleCfg.color}60` }}>
                          NO PHOTO
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Role badge below photo */}
                  <div
                    className="mt-2 flex items-center justify-center gap-1 py-1 rounded-xl"
                    style={{ background: `${roleCfg.color}18`, border: `1px solid ${roleCfg.color}25` }}
                  >
                    <roleCfg.Icon size={10} style={{ color: roleCfg.color }} />
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: roleCfg.color }}>
                      {roleCfg.label}
                    </span>
                    <span className="text-[9px]" style={{ color: `${roleCfg.color}80` }}>
                      {roleCfg.labelAm}
                    </span>
                  </div>
                </div>

                {/* Info stack */}
                <div className="flex-1 min-w-0 space-y-3">
                  <InfoRow
                    LabelIcon={User}
                    en="Full Name" am="ሙሉ ስም"
                    value={person.person_name || person.name}
                    color={roleCfg.color}
                  />
                  <InfoRow
                    LabelIcon={Hash}
                    en="Digital ID" am="መለያ"
                    value={person.digital_id}
                    color={roleCfg.color}
                    mono
                  />
                  {(person.position || person.department) && (
                    <InfoRow
                      LabelIcon={Building2}
                      en="Position" am="ቦታ"
                      value={[person.position, person.department].filter(Boolean).join(' · ')}
                      color={roleCfg.color}
                    />
                  )}
                  {person.phone && (
                    <InfoRow
                      LabelIcon={Phone}
                      en="Phone" am="ስልክ"
                      value={person.phone}
                      color={roleCfg.color}
                    />
                  )}
                  {person.valid_until && (
                    <InfoRow
                      LabelIcon={Calendar}
                      en="Valid Until" am="ፍቃድ ያበቃል"
                      value={formatDate(person.valid_until)}
                      color="#d97706"
                    />
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              {person.confidence && (
                <div className="mx-5 mb-4 p-3 rounded-2xl"
                     style={{ background: 'rgba(0,204,102,0.07)', border: '1px solid rgba(0,204,102,0.15)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={11} style={{ color: '#00cc66' }} />
                      <span className="text-[10px] font-black" style={{ color: '#00cc66' }}>
                        Biometric Match Confidence
                      </span>
                    </div>
                    <span className="text-[10px] font-black font-mono" style={{ color: '#00cc66' }}>
                      {typeof person.confidence === 'number'
                        ? (person.confidence > 1 ? person.confidence.toFixed(1) : (person.confidence * 100).toFixed(1))
                        : person.confidence}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,204,102,0.1)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${typeof person.confidence === 'number'
                        ? (person.confidence > 1 ? person.confidence : person.confidence * 100)
                        : 85}%` }}
                      transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #00cc66, #00ff88)' }}
                    />
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* Denied / Locked body */
            <div className="px-5 py-6" style={{ background: '#fafafa' }}>
              <div
                className="flex flex-col items-center text-center gap-3 py-4 rounded-2xl"
                style={{ background: isLocked ? '#fffbeb' : '#fff5f5', border: `1px solid ${isLocked ? '#fde68a' : '#fecaca'}` }}
              >
                {isLocked
                  ? <Clock size={40} style={{ color: '#d97706' }} />
                  : <ShieldX size={40} style={{ color: '#cc0000' }} />
                }
                <div>
                  <p className="text-lg font-black" style={{ color: isLocked ? '#d97706' : '#cc0000' }}>
                    {isLocked ? 'Face Locked Out' : 'Unknown Person'}
                  </p>
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#666', maxWidth: 280 }}>
                    {isLocked
                      ? `Too many failed attempts. Scanner blocked for ${person.seconds_remaining} seconds.`
                      : `This person is not registered in the AMECO system. ${person.attempts_remaining ?? 0} attempt(s) remaining before lockout.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Footer barcode ─────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ background: accentColor }}
          >
            <BarcodeStrip id={person.digital_id || person.person_name} color="rgba(255,255,255,0.4)" />
            <div className="text-right">
              <p className="text-white/50 text-[8px] font-black uppercase tracking-widest">
                AMECO · Access Control
              </p>
              <p className="text-white/30 text-[7px] font-mono mt-0.5">
                {new Date().toISOString().slice(0, 19).replace('T', ' ')}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}