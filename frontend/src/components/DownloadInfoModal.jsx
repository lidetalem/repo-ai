/**
 * DownloadInfoModal.jsx
 * Search modal for downloading person info PDF or ID Card PDF.
 * Used in Logs section and Guard Dashboard.
 */

import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Download, FileText, CreditCard, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { staffAPI, adminsAPI, guardsAPI, visitorsAPI, BASE_URL } from '../services/api'
import { formatBackendDate, formatEthiopianDateTime } from '../utils/ethiopianTime'
import { useLang } from '../context/LanguageContext'

function imgUrl(u) {
  if (!u) return null
  if (u.startsWith('http')) return u
  return `${BASE_URL}${u}`
}

async function generatePersonPDF(person, lang = 'en') {
  const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  let y = 0

  doc.setFillColor(204, 0, 0)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('AMECO — Person Information Record', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('አማራ ሚዲያ ኮርፖሬሽን · Amhara Media Corporation', 14, 20)
  doc.text(`Generated: ${formatEthiopianDateTime(new Date(), lang)}`, W - 14, 20, { align: 'right' })
  y = 36

  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
  const profile = imgUrl(person.profile_image)

  if (profile) {
    try { doc.addImage(profile, 'JPEG', 14, y, 36, 42) } catch {}
  }
  const infoX = profile ? 56 : 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 30, 30)
  doc.text(fullName || '—', infoX, y + 8)
  doc.setFontSize(10); doc.setTextColor(100, 100, 100)
  doc.text(`Digital ID: ${person.digital_id || '—'}`, infoX, y + 16)
  y = Math.max(y + 50, y + 50)
  doc.setDrawColor(220,220,220); doc.line(14, y, W-14, y); y += 6

  const fields = [
    ['Full Name', fullName], ['Digital ID', person.digital_id],
    ['Phone', person.phone_number || person.phone], ['Email', person.email],
    ['Gender', person.gender === 'M' ? 'Male' : person.gender === 'F' ? 'Female' : person.gender],
    ['Position', person.position], ['Department', person.department],
    ['Description', person.description],
    ['Registered At', person.registered_at ? formatBackendDate(person.registered_at, lang) : null],
    ['Start Date', person.date_of_first_entry], ['Expiry Date', person.date_of_expiry],
    ['Status', person.status],
  ].filter(([, v]) => v)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(204, 0, 0)
  doc.text('PERSONAL INFORMATION', 14, y); y += 5
  for (const [label, value] of fields) {
    if (y > 265) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100,100,100); doc.text(label + ':', 14, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30,30,30); doc.text(String(value), 60, y); y += 6
  }
  y += 4

  const addImgSection = async (title, imgs) => {
    if (!imgs.some(Boolean)) return
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(204,0,0)
    doc.text(title, 14, y); y += 6
    let x = 14; const imgW = 54, imgH = 38
    for (const src of imgs) {
      if (!src) continue
      try {
        if (x + imgW > W-14) { x=14; y+=imgH+4 }
        if (y+imgH>275) { doc.addPage(); y=20; x=14 }
        doc.addImage(src, 'JPEG', x, y, imgW, imgH); x += imgW+4
      } catch {}
    }
    y += imgH + 8
  }

  const faces = [person.face_front||person.face_scan_1, person.face_left||person.face_scan_2,
    person.face_right||person.face_scan_3, person.face_down||person.face_scan_4,
    person.face_unusual||person.face_scan_5].map(imgUrl)

  await addImgSection('ID CARD IMAGES', [imgUrl(person.id_card_front||person.id_card_image), imgUrl(person.id_card_back)])
  if (person.digital_id_card_image) await addImgSection('DIGITAL ID CARD', [imgUrl(person.digital_id_card_image)])
  await addImgSection('FACE REGISTRATION IMAGES', faces.filter(Boolean))

  doc.save(`AMECO_${person.digital_id || fullName}_Record.pdf`)
}

async function generateIDCardPDF(person) {
  const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
  // Standard ID card ratio — 85.6mm x 54mm (CR80)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
  const W = 85.6, H = 54

  doc.setFillColor(204, 0, 0)
  doc.rect(0, 0, W, 14, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255,255,255)
  doc.text('AMECO', 3, 6)
  doc.setFontSize(5); doc.setFont('helvetica','normal')
  doc.text('Amhara Media Corporation', 3, 11)

  const digitalIdCard = imgUrl(person.digital_id_card_image || person.id_card_generated)
  if (digitalIdCard) {
    try { doc.addImage(digitalIdCard, 'JPEG', 0, 14, W, H-14) } catch {}
  } else {
    const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
    doc.setFillColor(248, 248, 248); doc.rect(0, 14, W, H-14, 'F')
    const profile = imgUrl(person.profile_image)
    if (profile) { try { doc.addImage(profile, 'JPEG', 3, 17, 20, 24) } catch {} }
    const tx = profile ? 26 : 3
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(30,30,30)
    doc.text(fullName || '—', tx, 22)
    doc.setFontSize(7); doc.setTextColor(100,100,100)
    doc.text(person.digital_id || '—', tx, 28)
    if (person.position) doc.text(person.position, tx, 33)
    if (person.department) doc.text(person.department, tx, 38)
  }

  doc.save(`AMECO_ID_${person.digital_id || 'card'}.pdf`)
}

export default function DownloadInfoModal({ mode = 'info', onClose }) {
  // mode: 'info' | 'idcard'
  const { lang, t } = useLang()
  const [allPeople, setAllPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    // Accept a transient initial person object set by other pages (guard detail)
    const transient = window.__initialDownloadPerson__ || null
    if (transient) delete window.__initialDownloadPerson__

    Promise.allSettled([
      staffAPI.list(), adminsAPI.list(), guardsAPI.list(), visitorsAPI.list()
    ]).then(results => {
      const all = results.flatMap(r => {
        if (r.status === 'fulfilled') return r.value.data.results || r.value.data
        return []
      })
      // If a transient initial person exists, prefer it first in the list
      if (transient) setAllPeople([transient, ...all.filter(p => (p.id || p.digital_id) !== (transient.id || transient.digital_id))])
      else setAllPeople(all)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return allPeople
    const q = search.toLowerCase()
    return allPeople.filter(p =>
      [p.first_name, p.middle_name, p.last_name, p.digital_id, p.email, p.phone_number, p.position, p.department]
        .filter(Boolean).some(v => v.toLowerCase().includes(q))
    )
  }, [allPeople, search])

  const handleDownload = async (person) => {
    setDownloading(person.id || person.digital_id)
    try {
      if (mode === 'info') await generatePersonPDF(person, lang)
      else await generateIDCardPDF(person)
    } catch { alert('PDF generation failed') }
    finally { setDownloading(null) }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden"
          style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0"
               style={{ borderBottom: '1px solid var(--color-border-main)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'rgba(204,0,0,0.12)' }}>
                {mode === 'info' ? <FileText size={18} style={{ color: '#cc0000' }} /> : <CreditCard size={18} style={{ color: '#cc0000' }} />}
              </div>
              <div>
                <h2 className="font-black text-base" style={{ color: 'var(--color-text-main)' }}>
                  {mode === 'info' ? (t('downloadInfoTitle') || 'Download Person Info') : (t('idDownloadTitle') || 'Download Digital ID Card')}
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Search and select a person to generate PDF
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-card-hover">
              <X size={15} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border-main)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, Digital ID, email, department..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{
                  background: 'var(--color-card-hover)',
                  borderColor: 'var(--color-border-main)',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin" style={{ color: '#cc0000' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
                <Search size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No results found</p>
              </div>
            ) : (
              <div className="divide-y" style={{ divideColor: 'var(--color-border-main)' }}>
                {filtered.slice(0, 50).map(person => {
                  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
                  const profile = imgUrl(person.profile_image)
                  const isLoading = downloading === (person.id || person.digital_id)
                  return (
                    <div key={person.id || person.digital_id}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-card-hover transition-colors">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                           style={{ background: 'var(--color-card-hover)' }}>
                        {profile
                          ? <img src={profile} alt="" className="w-full h-full object-cover" />
                          : <span className="text-sm font-black" style={{ color: '#cc0000' }}>{(person.first_name||'?')[0]}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-main)' }}>{fullName || '—'}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {person.digital_id} {person.position ? `· ${person.position}` : ''} {person.department ? `· ${person.department}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownload(person)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)', flexShrink: 0 }}
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {isLoading ? 'Generating...' : 'Download'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {filtered.length > 50 && (
            <div className="px-6 py-2 text-xs text-center shrink-0" style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-main)' }}>
              Showing first 50 results — refine your search
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}