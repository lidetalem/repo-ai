/**
 * PersonDetailModal.jsx — Enhanced Eye-Icon View for all person types
 * Shows: complete personal info, profile photo, ID card front/back,
 * digital ID card image, all 5 face images, registration details.
 * Includes "Download Info" PDF button.
 */

import React, { useState } from 'react'
import { X, Download, User, Phone, Mail, Building2, Hash, Calendar, Shield, Image, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BASE_URL } from '../services/api'
import { useLang } from '../context/LanguageContext'
import { formatBackendDate, formatEthiopianDateTime } from '../utils/ethiopianTime'

function imgUrl(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

function InfoRow({ label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border-main)' }}>
      <span className="w-36 flex-shrink-0 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className={`text-xs flex-1 ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--color-text-main)' }}>{value}</span>
    </div>
  )
}

function ImageCard({ label, src }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-main)', minHeight: 80 }}>
        {src
          ? <img src={src} alt={label} className="w-full h-32 object-cover" />
          : <div className="w-full h-32 flex items-center justify-center" style={{ background: 'var(--color-card-hover)', color: 'var(--color-text-muted)', fontSize: 11 }}>
              <span>No image</span>
            </div>
        }
      </div>
    </div>
  )
}

export default function PersonDetailModal({ person, onClose, type = 'staff' }) {
  const [downloading, setDownloading] = useState(false)
  const { lang, t } = useLang()

  if (!person) return null

  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
  const profile = imgUrl(person.profile_image)
  const idFront = imgUrl(person.id_card_front || person.id_card_image)
  const idBack = imgUrl(person.id_card_back)
  const digitalIdCard = imgUrl(person.digital_id_card_image || person.id_card_generated)
  const faces = [
    imgUrl(person.face_front || person.face_scan_1),
    imgUrl(person.face_left || person.face_scan_2),
    imgUrl(person.face_right || person.face_scan_3),
    imgUrl(person.face_down || person.face_scan_4),
    imgUrl(person.face_unusual || person.face_scan_5),
  ]

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const W = 210
      let y = 0

      // Header
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

      // Profile image
      if (profile) {
        try {
          doc.addImage(profile, 'JPEG', 14, y, 36, 42)
        } catch {}
      }

      // Basic info block
      const infoX = profile ? 56 : 14
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(30, 30, 30)
      doc.text(fullName || '—', infoX, y + 8)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Digital ID: ${person.digital_id || '—'}`, infoX, y + 16)
      if (person.position || person.department) {
        doc.text(`${person.position || ''} ${person.department ? '· ' + person.department : ''}`, infoX, y + 23)
      }

      y = Math.max(y + 50, y + 50)
      doc.setDrawColor(220, 220, 220)
      doc.line(14, y, W - 14, y)
      y += 6

      // Personal Info section
      const fields = [
        ['Full Name', fullName],
        ['Digital ID', person.digital_id],
        ['Phone', person.phone_number || person.phone],
        ['Email', person.email],
        ['Gender', person.gender === 'M' ? 'Male' : person.gender === 'F' ? 'Female' : person.gender],
        ['Position', person.position],
        ['Department', person.department],
        ['Description', person.description],
        ['Registered At', person.registered_at ? formatBackendDate(person.registered_at, lang) : null],
        ['Start Date', person.date_of_first_entry],
        ['Expiry Date', person.date_of_expiry],
        ['Status', person.status],
      ].filter(([, v]) => v)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(204, 0, 0)
      doc.text('PERSONAL INFORMATION', 14, y)
      y += 5

      for (const [label, value] of fields) {
        if (y > 265) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(label + ':', 14, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 30, 30)
        doc.text(String(value), 60, y)
        y += 6
      }

      y += 4

      // ID Cards section
      const addImgSection = async (title, images) => {
        if (!images.some(Boolean)) return
        if (y > 250) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(204, 0, 0)
        doc.text(title, 14, y)
        y += 6

        let x = 14
        const imgW = 54, imgH = 38
        for (const [i, src] of images.entries()) {
          if (!src) continue
          try {
            if (x + imgW > W - 14) { x = 14; y += imgH + 4 }
            if (y + imgH > 275) { doc.addPage(); y = 20; x = 14 }
            doc.addImage(src, 'JPEG', x, y, imgW, imgH)
            x += imgW + 4
          } catch {}
        }
        y += imgH + 8
      }

      await addImgSection('ID CARD IMAGES', [idFront, idBack])
      if (digitalIdCard) await addImgSection('DIGITAL ID CARD', [digitalIdCard])
      await addImgSection('FACE REGISTRATION IMAGES', faces.filter(Boolean))

      doc.save(`AMECO_${person.digital_id || fullName}_Record.pdf`)
    } catch (err) {
      console.error('PDF error:', err)
      alert('PDF generation failed. Make sure jspdf is installed.')
    } finally {
      setDownloading(false)
    }
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
          className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden"
          style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
               style={{ borderBottom: '1px solid var(--color-border-main)', background: 'linear-gradient(135deg,rgba(204,0,0,0.08),transparent)' }}>
            <div className="flex items-center gap-3">
              {profile
                ? <img src={profile} alt="" className="w-12 h-12 rounded-2xl object-cover" style={{ border: '2px solid rgba(204,0,0,0.3)' }} />
                : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black"
                       style={{ background: 'rgba(204,0,0,0.12)', color: '#cc0000' }}>
                    {(person.first_name || '?')[0].toUpperCase()}
                  </div>
              }
              <div>
                <h2 className="font-black text-base" style={{ color: 'var(--color-text-main)' }}>{fullName || '—'}</h2>
                <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{person.digital_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)' }}
              >
                {downloading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Download size={14} />}
                Download Info
              </button>
              <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--color-card-hover)]">
                <X size={16} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Personal Info */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 pb-1.5 border-b"
                  style={{ color: '#cc0000', borderColor: 'rgba(204,0,0,0.2)' }}>Personal Information</h3>
              <div className="space-y-0">
                <InfoRow label="Full Name" value={fullName} />
                <InfoRow label="Digital ID" value={person.digital_id} mono />
                <InfoRow label="Phone" value={person.phone_number || person.phone} />
                <InfoRow label="Email" value={person.email} />
                <InfoRow label="Gender" value={person.gender === 'M' ? 'Male' : person.gender === 'F' ? 'Female' : person.gender} />
                <InfoRow label="Position" value={person.position} />
                <InfoRow label="Department" value={person.department} />
                <InfoRow label="Description" value={person.description} />
                <InfoRow label="Status" value={person.status} />
                <InfoRow label="Registered At" value={person.registered_at ? formatBackendDate(person.registered_at, lang) : null} />
                <InfoRow label="Start Date" value={person.date_of_first_entry} />
                <InfoRow label="Expiry Date" value={person.date_of_expiry} />
                {person.admin_tag && <InfoRow label="Admin Tag" value={person.admin_tag} />}
                {person.username && <InfoRow label="Username" value={person.username} />}
              </div>
            </section>

            {/* ID Card Images */}
            {(idFront || idBack || digitalIdCard) && (
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 pb-1.5 border-b"
                    style={{ color: '#cc0000', borderColor: 'rgba(204,0,0,0.2)' }}>ID Cards</h3>
                <div className="grid grid-cols-3 gap-3">
                  {idFront && <ImageCard label="ID Card Front" src={idFront} />}
                  {idBack && <ImageCard label="ID Card Back" src={idBack} />}
                  {digitalIdCard && <ImageCard label="Digital ID Card" src={digitalIdCard} />}
                </div>
              </section>
            )}

            {/* Face Images */}
            {faces.some(Boolean) && (
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 pb-1.5 border-b"
                    style={{ color: '#cc0000', borderColor: 'rgba(204,0,0,0.2)' }}>Face Registration Images</h3>
                <div className="grid grid-cols-5 gap-2">
                  {['Front', 'Left', 'Right', 'Down', 'Angled'].map((lbl, i) => (
                    <ImageCard key={lbl} label={lbl} src={faces[i]} />
                  ))}
                </div>
              </section>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}