/**
 * LiveCameraFeed.jsx — AMECO Multi-Person Recognition Feed
 *
 * Two independent loops:
 *
 *   DRAW LOOP  (requestAnimationFrame ~60fps)
 *     Reads lastFacesRef — the latest faces from the backend — and repaints
 *     bounding boxes + labels on a transparent canvas overlay every frame.
 *     Zero network cost, so boxes feel instant and smooth.
 *
 *   SCAN LOOP  (every SCAN_MS milliseconds)
 *     Captures one JPEG frame from the video element, POSTs it to the backend,
 *     and stores the resulting faces array into lastFacesRef.
 *     The draw loop picks up the new positions on the very next frame.
 *
 * Every detected face gets a coloured bounding box:
 *   Green  — ACCEPTED (staff / admin / guard / visitor with valid access)
 *   Red    — UNKNOWN  (not in system)
 *   Amber  — VISITOR_EXPIRED
 *
 * Recognised people also get a CompactIDOverlay card stacked in the top-right
 * corner showing their name, digital ID, role, confidence, and a countdown bar.
 * Multiple people are shown simultaneously as a stacked list.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Minus, Maximize2, Minimize2, X,
  Play, StopCircle, Camera, Zap, Users,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { recognitionAPI } from '../../services/api'
import CompactIDOverlay from './CompactIDOverlay'
import DigitalIDCard    from './DigitalIDCard'
import audioManager from '../../utils/audioManager'

// ── Constants ─────────────────────────────────────────────────────────────────
const SCAN_MS = 1200   // ms between backend POSTs — fast enough without hammering
const CARD_MS = 9000   // ms an ID card stays visible
const PER_PERSON_COOLDOWN_MS = 10000 // default client-side cooldown for recognized persons

const BOX = {
  ACCEPTED:        '#00e676',
  UNKNOWN:         '#ff1744',
  VISITOR_EXPIRED: '#ffab00',
}

// ── Ethiopian time ────────────────────────────────────────────────────────────
function ethTime() {
  const now  = new Date()
  const utcH = now.getUTCHours() + 3
  const ethH = ((utcH - 6 + 24) % 12) || 12
  const ampm = utcH >= 6 && utcH < 18 ? 'ቀን' : 'ማታ'
  return `${ethH}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ${ampm}`
}

// ── Canvas — draw all face boxes in one pass ──────────────────────────────────
function drawBoxes(canvas, video, faces) {
  if (!canvas || !video || !video.videoWidth) return

  // Keep canvas resolution in sync with the actual video stream
  if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  const W   = canvas.width
  const H   = canvas.height
  ctx.clearRect(0, 0, W, H)

  for (const face of faces) {
    const b = face.box
    if (!b) continue

    const x  = (b.left   / 100) * W
    const y  = (b.top    / 100) * H
    const fw = ((b.right  - b.left) / 100) * W
    const fh = ((b.bottom - b.top)  / 100) * H
    const color = BOX[face.result] || BOX.UNKNOWN
    const cs    = Math.min(fw, fh) * 0.22   // corner arm length

    // Soft glow
    ctx.shadowBlur  = 16
    ctx.shadowColor = color

    // Semi-transparent full rect
    ctx.strokeStyle = color + '44'
    ctx.lineWidth   = 1
    ctx.strokeRect(x, y, fw, fh)

    // Bold L-corner marks
    ctx.strokeStyle = color
    ctx.lineWidth   = 2.5
    ctx.shadowBlur  = 22
    ;[
      [[x,      y + cs], [x,      y],      [x + cs, y]     ],   // TL
      [[x+fw-cs,y],      [x + fw, y],      [x + fw, y + cs]],   // TR
      [[x,      y+fh-cs],[x,      y + fh], [x + cs, y + fh]],   // BL
      [[x+fw-cs,y+fh],   [x + fw, y + fh], [x + fw,y+fh-cs]],  // BR
    ].forEach(([s, m, e]) => {
      ctx.beginPath(); ctx.moveTo(...s); ctx.lineTo(...m); ctx.lineTo(...e); ctx.stroke()
    })
    ctx.shadowBlur = 0

    // Label above the box
    const label = face.result === 'ACCEPTED'
      ? (face.digital_id || face.name || 'ID')
      : face.result === 'VISITOR_EXPIRED' ? 'EXPIRED' : 'UNKNOWN'

    const fs  = Math.max(9, Math.min(13, fw * 0.11))
    ctx.font  = `bold ${fs}px monospace`
    const tw  = ctx.measureText(label).width
    const pad = 4
    const lh  = fs + pad * 2
    const ly  = Math.max(0, y - lh - 3)

    ctx.fillStyle = color + 'cc'
    ctx.beginPath(); ctx.roundRect(x, ly, tw + pad * 2 + 2, lh, 3); ctx.fill()

    ctx.fillStyle    = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + pad, ly + lh / 2)

    // Confidence badge at bottom of box (accepted only)
    if (face.result === 'ACCEPTED' && face.confidence != null) {
      const ct  = `${Math.round(face.confidence)}%`
      ctx.font  = `bold ${fs - 1}px monospace`
      const ctw = ctx.measureText(ct).width + 8
      const cy  = y + fh + 3
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.beginPath(); ctx.roundRect(x + fw - ctw - 2, cy, ctw, lh, 3); ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(ct, x + fw - ctw + 2, cy + lh / 2)
    }
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveCameraFeed({
  onStatusChange,
  onLog,
  onAlert,
  addNotification,
  assignedGateId = 'GATE-01',
  fullScreen     = false,
  displayOnly    = false,
}) {
  const videoRef    = useRef(null)
  const overlayRef  = useRef(null)   // transparent canvas — face boxes
  const captureRef  = useRef(null)   // hidden canvas — JPEG capture
  const streamRef   = useRef(null)
  const synthRef    = useRef(window.speechSynthesis)
  const scanningRef = useRef(false)  // prevent overlapping requests
  const rafRef      = useRef(null)
  const lastFaces   = useRef([])     // latest faces from backend
  const stickyFaces  = useRef(new Map()) // persistent locked faces to draw for TTL
  const announceQueue = useRef([])
  const announceRunning = useRef(false)
  const announcePlayingKey = useRef(null)

  // ── Per-person attempt limiting ───────────────────────────────────────────
  // Key: face token (bbox fingerprint). Value: { attempts, blockedUntil }
  const attemptMap  = useRef(new Map())
  // processedMap tracks recognized/expired people cooldowns (not shown as 'too many attempts')
  const processedMap = useRef(new Map())
  const [blockCountdowns, setBlockCountdowns] = useState({}) // { faceKey: secondsLeft }

  const [running,     setRunning]     = useState(false)
  const [isMax,       setIsMax]       = useState(fullScreen)
  const [minimized,   setMinimized]   = useState(false)
  const [clock,       setClock]       = useState(ethTime())
  const [scanning,    setScanning]    = useState(false)
  const [faceCount,   setFaceCount]   = useState(0)
  const [cards,       setCards]       = useState([])   // [{uid, person}, ...]
  const [idCard,      setIdCard]      = useState(null)
  const [flash,       setFlash]       = useState(null) // 'ok'|'deny'

  // Clock ticker
  useEffect(() => {
    const iv = setInterval(() => setClock(ethTime()), 1000)
    return () => clearInterval(iv)
  }, [])

  // ── Block countdown ticker ─────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now()
      const updated = {}
      let changed = false
      // Only show countdowns for unknown-face attemptMap entries
      attemptMap.current.forEach((state, key) => {
        if (state?.type !== 'unknown') return
        if (state.blockedUntil && state.blockedUntil > now) {
          updated[key] = Math.ceil((state.blockedUntil - now) / 1000)
          changed = true
        } else if (state.blockedUntil && state.blockedUntil <= now) {
          // unblock unknown entry
          state.blockedUntil = null
          state.attempts = 0
          changed = true
        }
      })
      // expire sticky faces
      stickyFaces.current.forEach((v, k) => {
        if (v.expiresAt && v.expiresAt <= now) {
          stickyFaces.current.delete(k)
          changed = true
        }
      })
      if (changed) setBlockCountdowns({ ...updated })
      else if (Object.keys(blockCountdowns).length > 0) setBlockCountdowns({})
    }, 500)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw loop — requestAnimationFrame, zero network ───────────────────────
  useEffect(() => {
    if (!running) return
    const loop = () => {
      // merge live faces with active sticky faces so locked persons remain visible
      const now = Date.now()
      const merged = [...lastFaces.current]
      stickyFaces.current.forEach((s, k) => {
        if (!s || (s.expiresAt && s.expiresAt <= now)) return
        // avoid duplicate if same digital_id or very similar bbox exists
        const exists = merged.some(f => (
          (s.digital_id && f.digital_id && f.digital_id === s.digital_id) ||
          (s.person_key && f.person_key && f.person_key === s.person_key) ||
          (f.box && Math.abs(f.box.left - s.box.left) < 2 && Math.abs(f.box.top - s.box.top) < 2)
        ))
        if (!exists) {
          merged.push({ box: s.box, result: s.result, name: s.name, digital_id: s.digital_id, confidence: s.confidence })
        }
      })
      drawBoxes(overlayRef.current, videoRef.current, merged)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running])

  useEffect(() => {
    // audioManager handles voices and queued playback centrally
  }, [])

  // Use centralized queued audio manager to avoid overlapping sounds.
  const speak = useCallback((text, lang = 'en-US') => audioManager.speakWeb(text, lang), [])
  const getEthiopianTime = useCallback(() => {
    const now = new Date()
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
    return new Date(utcMs + 3 * 60 * 60000)
  }, [])

  const getTimeCall = useCallback(() => {
    const hour = getEthiopianTime().getHours()
    if (hour >= 11 && hour < 21) return 'ቀን'
    if (hour >= 21 && hour < 24) return 'ጊዜ'
    return 'ምሽት'
  }, [getEthiopianTime])

  const getWelcomeMessage = useCallback((firstName) => {
    const timeCall = getTimeCall()
    return `እንኳን ወደ አሚኮ በደህና መጡ${firstName ? `, ${firstName}` : ''}, መልካም ${timeCall} ይሁንልዎ።`
  }, [getTimeCall])

  const getLockoutMessage = useCallback((seconds) => {
    const timeText = typeof seconds === 'number' && seconds >= 0 ? seconds : 'ጥቂት'
    return `በተደጋጋሚ ማንነትዎ ስላልታወቀ እባክዎ ለ ${timeText} ሰከንዶች ይጠብቁ እና ከዚያ በኋላ ዳግም ይሞክሩ።`
  }, [])

  const speakAmharic = useCallback((text) => audioManager.speakAmharic(text), [])
  const beep = useCallback((ok = true) => audioManager.beep(ok), [])

  // Announcement queue — ensures announcements correspond to currently-visible person
  const _isFaceStillVisible = useCallback((personKey, bbox, digital_id) => {
    const nowFaces = lastFaces.current || []
    // Prefer person_key match, then digital_id, then nearby bbox
    if (personKey) {
      if (nowFaces.some(f => f.person_key && f.person_key === personKey)) return true
    }
    if (digital_id) {
      if (nowFaces.some(f => f.digital_id && f.digital_id === digital_id)) return true
    }
    if (bbox) {
      return nowFaces.some(f => f.box && Math.abs(f.box.left - bbox.left) < 4 && Math.abs(f.box.top - bbox.top) < 4)
    }
    return false
  }, [])

  const enqueueAnnouncement = useCallback((opts) => {
    // opts: { personKey, bbox, digital_id, buildMessage: ()=>string, ok }
    announceQueue.current.push(opts)
    if (announceRunning.current) return
    announceRunning.current = true

    ;(async function run() {
      while (announceQueue.current.length) {
        try {
          // Collapse the queue to the most recent visible announcement
          const q = announceQueue.current.slice()
          // Find candidates that are still visible
          const candidates = q.filter(it => _isFaceStillVisible(it.personKey, it.bbox, it.digital_id))
          if (candidates.length === 0) {
            // No visible candidates; drop the entire queue
            announceQueue.current = []
            break
          }
          const chosen = candidates[candidates.length - 1] // most recently enqueued visible
          // Remove all queued items (they are stale) before playing chosen
          announceQueue.current = []

          // Mark currently-playing person so we can avoid starting stale follow-ups
          announcePlayingKey.current = chosen.personKey || chosen.digital_id || null

          // run onPlay UI actions (cards, flashes, logs) before audio so UI matches
          try { chosen.onPlay && chosen.onPlay() } catch (e) { console.warn('onPlay error', e) }

          if (chosen.buildMessage) {
            const msg = chosen.buildMessage()
            await audioManager.beepThenSpeak(chosen.ok !== false, msg)
          }

          // Finished speaking for this person
          announcePlayingKey.current = null
        } catch (e) {
          console.warn('Announce error', e)
        }
      }
      announceRunning.current = false
    })()
  }, [ _isFaceStillVisible ])

  const clearAnnouncements = useCallback(() => {
    announceQueue.current = []
    announceRunning.current = false
    audioManager.cancelAll()
  }, [])

  // ── Push a card onto the stack (de-duplicates by digital_id) ─────────────
  const pushCard = useCallback((person) => {
    const uid = `${person.digital_id}_${Date.now()}`
    setCards(prev => {
      if (prev.some(c => c.person.digital_id === person.digital_id)) return prev
      return [...prev, { uid, person }]
    })
    setTimeout(() => setCards(prev => prev.filter(c => c.uid !== uid)), CARD_MS)
  }, [])

  // ── Scan loop — capture frame → POST → update state ───────────────────────
  const scan = useCallback(async () => {
    if (displayOnly || scanningRef.current || !running) return
    const video   = videoRef.current
    const capture = captureRef.current
    if (!video?.videoWidth || !capture) return

    scanningRef.current = true
    setScanning(true)

    // Capture current frame as JPEG
    capture.width  = video.videoWidth
    capture.height = video.videoHeight
    capture.getContext('2d').drawImage(video, 0, 0)
    const b64 = capture.toDataURL('image/jpeg', 0.88).split(',')[1]

    try {
      // Use the /scan/ endpoint which now returns both a best result AND faces[]
      const { data } = await recognitionAPI.scan({
        image:     b64,
        camera_id: assignedGateId,
      })

      // Multi-face data comes in data.faces[]
      const faces = data.faces || []

      // ── Per-face attempt gating ──────────────────────────────────────────
      // Build a stable face key using backend `person_key` when available,
      // otherwise fall back to digital_id, then a more robust bbox fingerprint
      // (center + size rounded) and reuse sticky face keys when nearby.
      const keyedFaces = faces.map(f => {
        const b = f.box
        let faceKey = null
        if (f.person_key) faceKey = f.person_key
        else if (f.digital_id) faceKey = f.digital_id
        else if (b) {
          // center and average size, round to 5px grid to tolerate small shifts
          const cx = Math.round(((b.left + b.right) / 2) / 5) * 5
          const cy = Math.round(((b.top  + b.bottom) / 2) / 5) * 5
          const sz = Math.round((((b.right - b.left) + (b.bottom - b.top)) / 2) / 5) * 5
          faceKey = `bbox_${cx}_${cy}_${sz}`
          // If there's an active sticky face close to this bbox, reuse its key
          try {
            for (const [k, v] of stickyFaces.current) {
              if (!v || !v.box) continue
              const dx = Math.abs((v.box.left + v.box.right) / 2 - (b.left + b.right) / 2)
              const dy = Math.abs((v.box.top  + v.box.bottom) / 2 - (b.top  + b.bottom) / 2)
              if (dx < 6 && dy < 6) { faceKey = k; break }
            }
          } catch (e) { /* ignore sticky lookup failures */ }
        } else {
          faceKey = `nobox_${f.name || 'unknown'}`
        }
        return { ...f, _faceKey: faceKey }
      })

      const now = Date.now()
      const BLOCK_MS = 15000

      // Filter: skip faces that are currently blocked (either unknown attemptMap
      // or processedMap for recognized/expired cooldowns)
      const gatedFaces = keyedFaces.filter(f => {
        const astate = attemptMap.current.get(f._faceKey)
        if (astate?.blockedUntil && astate.blockedUntil > now) return false
        const pstate = processedMap.current.get(f._faceKey)
        if (pstate?.blockedUntil && pstate.blockedUntil > now) return false
        return true
      })

      // Update attempt counters for UNKNOWN faces that passed the gate
      gatedFaces.forEach(f => {
        if (f.result === 'UNKNOWN') {
          const state = attemptMap.current.get(f._faceKey) || { attempts: 0, blockedUntil: null }
          state.attempts = (state.attempts || 0) + 1
          if (state.attempts >= 3) {
            state.blockedUntil = now + BLOCK_MS
            state.attempts = 0
            // Show countdown overlay
            setBlockCountdowns(prev => ({ ...prev, [f._faceKey]: 15 }))
            enqueueAnnouncement({ personKey: f.person_key || f._faceKey, bbox: f.box, digital_id: f.digital_id, buildMessage: () => getLockoutMessage(15), ok: false })
          }
          state.type = 'unknown'
          attemptMap.current.set(f._faceKey, state)
        } else if (f.result === 'ACCEPTED') {
          // Successful recognition: clear any unknown attempts and record a
          // processed cooldown in processedMap (do NOT show "too many attempts").
          attemptMap.current.delete(f._faceKey)
          try {
            setBlockCountdowns(prev => { const np = { ...prev }; delete np[f._faceKey]; return np })
          } catch (e) {}
          const lockMs = f.lock_ttl ? Math.round(Number(f.lock_ttl) * 1000) : PER_PERSON_COOLDOWN_MS
          processedMap.current.set(f._faceKey, { blockedUntil: now + lockMs, type: 'processed' })
        }
      })

      lastFaces.current = keyedFaces   // show ALL faces (including blocked — drawn in red)
      setFaceCount(faces.length)

      const accepted = gatedFaces.filter(f => f.result === 'ACCEPTED')
      const unknowns = gatedFaces.filter(f => f.result === 'UNKNOWN')
      const expired  = gatedFaces.filter(f => f.result === 'VISITOR_EXPIRED')

      // If no faces were returned, clear any pending announcements and skip
      if (faces.length === 0) {
        lastFaces.current = []
        setFaceCount(0)
        // cancel pending audio — nothing to announce when no person present
        clearAnnouncements()
        return
      }

      if (accepted.length > 0) {
        // Only play audio / show cards for faces that are not backend-ignored
        const playable = accepted.filter(f => !f.ignored)
        if (playable.length > 0) {
          // enqueue audio via our announcer — it will verify the person is
          // still visible when the audio begins to avoid stale announcements.
          const first = playable[0]
          const firstName = first.name?.split(' ')[0] || ''
          const message = playable.length === 1
            ? getWelcomeMessage(firstName)
            : 'እንኳን ወደ አሚኮ በደህና መጡ. የተገኙ ሰዎችን እናስተናግዳለን።'
          // prepare UI actions to run only when announcement actually plays
          const onPlay = () => {
            setFlash('ok')
            setTimeout(() => setFlash(null), CARD_MS)
            for (const f of playable) {
              pushCard({
                access_granted: true,
                name:           f.name,
                digital_id:     f.digital_id,
                role:           f.role,
                display_role:   f.display_role,
                position:       f.position,
                department:     f.department,
                phone:          f.phone,
                profile_image:  f.profile_image,
                valid_until:    f.valid_until,
                confidence:     f.confidence,
                gate:           f.gate,
              })
              onLog?.({ event: 'IN', userId: f.digital_id, name: f.name })
            }
          }

          enqueueAnnouncement({ personKey: first.person_key || first._faceKey, bbox: first.box, digital_id: first.digital_id, buildMessage: () => message, ok: true, onPlay })
        }
      }

      if (expired.length > 0) {
        const playableExpired = expired.filter(f => !f.ignored)
        if (playableExpired.length > 0) {
          const first = playableExpired[0]
          const onPlayExpired = () => {
            playableExpired.forEach(f =>
              toast(`⏰ ${f.name} — access EXPIRED`, {
                icon: '🚫',
                style: { background: '#1a1000', color: '#ffab00', border: '1px solid #ffab00' },
                duration: 5000,
              })
            )
          }
          enqueueAnnouncement({ personKey: first.person_key || first._faceKey, bbox: first.box, digital_id: first.digital_id, buildMessage: () => 'የጊዜ ገደቡ አልቋል።', ok: false, onPlay: onPlayExpired })
          // apply cooldown for expired faces to avoid repeated announcements
          // Use processedMap so expired (recognized) faces do not show "too many attempts"
          playableExpired.forEach(f => {
            const lockMs = f.lock_ttl ? Math.round(Number(f.lock_ttl) * 1000) : PER_PERSON_COOLDOWN_MS
            processedMap.current.set(f._faceKey, { blockedUntil: Date.now() + lockMs, type: 'processed' })
          })
        }
        // Show toast for expired faces when the announcement actually plays
        // (handled in the onPlay callback below)
      }

      if (unknowns.length > 0 && accepted.length === 0) {
        const playableUnknowns = unknowns.filter(f => !f.ignored)
        if (playableUnknowns.length > 0) {
          const first = playableUnknowns[0]
          const onPlayUnknowns = () => {
            toast.error(`⚠️ ${unknowns.length} unknown face${unknowns.length > 1 ? 's' : ''} detected`, {
              style: { background: '#110000', color: '#fff', border: '1px solid #ff1744' },
              duration: 3000,
            })
            onAlert?.({ kind: 'UNAUTHORIZED', reason: `${unknowns.length} unknown face(s) at ${assignedGateId}` })
            setFlash('deny')
            setTimeout(() => setFlash(null), 2500)
          }
          enqueueAnnouncement({ personKey: first.person_key || first._faceKey, bbox: first.box, digital_id: first.digital_id, buildMessage: () => 'የማይታወቅ ሰው።', ok: false, onPlay: onPlayUnknowns })
        }
        // Instead of immediate UI updates, run them when the announcement plays
      }

      // Backward-compat: single-result REJECTED from older endpoint
      if (faces.length === 0 && data.result === 'REJECTED') {
        const attLeft = data.attempts_left ?? 0
        if (attLeft === 0) {
          enqueueAnnouncement({ buildMessage: () => getLockoutMessage(data.seconds_remaining ?? 0), ok: false })
        } else {
          enqueueAnnouncement({ buildMessage: () => 'የማይታወቅ ሰው።', ok: false })
        }
        toast.error(`⚠️ Unknown face — ${attLeft} attempt(s) remaining`, {
          style: { background: '#110000', color: '#fff', border: '1px solid #ff1744' },
          duration: 3000,
        })
        onAlert?.({ kind: 'UNAUTHORIZED', reason: `Unrecognized at ${assignedGateId}` })
        setFlash('deny')
        setTimeout(() => setFlash(null), 2500)
      }

    } catch (err) {
      if (err?.response?.status !== 429) {
        console.warn('Recognition error:', err?.response?.data || err?.message)
      }
    } finally {
      setScanning(false)
      scanningRef.current = false
    }
  }, [running, displayOnly, assignedGateId, beep, speak, pushCard, onLog, onAlert])

  useEffect(() => {
    if (!running || displayOnly) return
    const iv = setInterval(scan, SCAN_MS)
    return () => clearInterval(iv)
  }, [running, displayOnly, scan])

  // ── Camera start / stop ───────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: 1280 },
          height:    { ideal: 720  },
          frameRate: { ideal: 30   },
          facingMode: 'user',
        },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setRunning(true)
      onStatusChange?.(true)
      toast.success('Camera started — multi-face detection active.')
    } catch {
      toast.error('Could not access camera. Check browser permissions.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    lastFaces.current = []
    cancelAnimationFrame(rafRef.current)
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d')
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
    }
    // clear queued announcements and currently-playing audio
    try { clearAnnouncements() } catch {}
    setRunning(false); setCards([]); setIdCard(null); setFlash(null); setFaceCount(0)
    onStatusChange?.(false)
    toast('Camera stopped.', { icon: '⏹️' })
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), [])
  useEffect(() => () => { try { clearAnnouncements() } catch {} }, [])

  // Border reflects last result
  const borderCol =
    flash === 'ok'   ? '#00e676' :
    flash === 'deny' ? '#ff1744' :
    scanning         ? '#2979ff' :
    running          ? '#cc000055' : '#1a1a1a'

  const wrapCls = isMax
    ? 'fixed inset-0 z-40 rounded-none overflow-hidden flex flex-col'
    : 'relative w-full rounded-[2rem] overflow-hidden flex flex-col'

  return (
    <>
      {/* Hidden JPEG capture canvas */}
      <canvas ref={captureRef} style={{ display: 'none' }} />

      {/* Full DigitalIDCard popup */}
      <AnimatePresence>
        {idCard && <DigitalIDCard person={idCard} onClose={() => setIdCard(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {!minimized ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1    }}
            exit={{    opacity: 0, scale: 0.95  }}
            className={wrapCls}
            style={{ background: '#000', boxShadow: '0 0 60px rgba(204,0,0,0.1)' }}
          >
            {/* ── Title bar ── */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0"
                 style={{ background: '#080808', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <Camera size={14} style={{ color: '#cc0000' }} />
                <span className="text-sm font-black text-white tracking-tight">AMECO Live Camera</span>

                {running && (
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: '#cc0000' }}>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                )}
                {scanning && !displayOnly && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase">
                    <Zap size={9} className="animate-pulse" /> Scanning
                  </span>
                )}
                {faceCount > 0 && running && (
                  <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
                    <Users size={9} /> {faceCount} face{faceCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {[
                  { col: 'text-amber-400', icon: <Minus size={12} />,      title: 'Minimize', fn: () => setMinimized(true) },
                  { col: 'text-green-400', icon: isMax ? <Minimize2 size={12} /> : <Maximize2 size={12} />,
                                           title: isMax ? 'Restore' : 'Maximize', fn: () => setIsMax(p => !p) },
                  { col: 'text-red-400',   icon: <X size={12} />,          title: 'Close',    fn: () => { stopCamera(); setMinimized(true) } },
                ].map(({ col, icon, title, fn }) => (
                  <button key={title} onClick={fn} title={title}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all ${col}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Video + canvas overlay ── */}
            <div className="relative flex-1 bg-[#050505] overflow-hidden"
                 style={{ border: `2px solid ${borderCol}`, transition: 'border-color 0.3s ease' }}>

              <video ref={videoRef} autoPlay playsInline muted
                     className="w-full h-full object-cover"
                     style={{ filter: running ? 'none' : 'grayscale(1) brightness(0.35)' }} />

              {/* Transparent canvas — exactly covers the video */}
              {running && (
                <canvas ref={overlayRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ objectFit: 'cover' }} />
              )}

              {/* Offline placeholder */}
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                     style={{ background: '#050505' }}>
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                       style={{ background: 'rgba(204,0,0,0.07)', border: '1px solid rgba(204,0,0,0.18)' }}>
                    <Camera size={34} style={{ color: '#cc000060' }} />
                  </div>
                  <p className="text-xs font-black text-white uppercase tracking-widest opacity-50">
                    Camera offline
                  </p>
                  <p className="text-[10px] opacity-25" style={{ color: '#888' }}>
                    Press Start to activate {displayOnly ? 'monitor' : 'multi-face scanner'}
                  </p>
                </div>
              )}

              {running && (
                <>
                  {/* Decorative scan-area brackets */}
                  <div className="absolute inset-[10%] pointer-events-none">
                    {[
                      'top-0 left-0 border-t-2 border-l-2 rounded-tl',
                      'top-0 right-0 border-t-2 border-r-2 rounded-tr',
                      'bottom-0 left-0 border-b-2 border-l-2 rounded-bl',
                      'bottom-0 right-0 border-b-2 border-r-2 rounded-br',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-9 h-9 ${cls}`}
                           style={{ borderColor: '#cc000080' }} />
                    ))}

                    {/* Animated scan line */}
                    {!displayOnly && (
                      <div className="absolute inset-0 overflow-hidden rounded">
                        <motion.div
                          animate={{ y: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                          className="h-0.5 rounded-full w-full"
                          style={{
                            background: scanning
                              ? 'linear-gradient(90deg,transparent,#2979ff,transparent)'
                              : 'linear-gradient(90deg,transparent,#cc000090,transparent)',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* LIVE badge — top left */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                       style={{ background: 'rgba(204,0,0,0.88)', backdropFilter: 'blur(6px)' }}>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-[9px] font-black uppercase tracking-wider">
                      {displayOnly ? 'Live Monitor' : 'Multi-Face Detection'}
                    </span>
                  </div>

                  {/* ── ID card stack — top right ── */}
                  {!displayOnly && (
                    <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 items-end"
                         style={{ maxHeight: 'calc(100% - 4rem)', overflowY: 'auto' }}>
                      <AnimatePresence mode="popLayout">
                        {cards.map(({ uid, person }) => (
                          <CompactIDOverlay
                            key={uid}
                            person={person}
                            displayMs={CARD_MS}
                            onClose={() => setCards(prev => prev.filter(c => c.uid !== uid))}
                            onExpand={() => setIdCard({ ...person, person_name: person.name })}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Gate label — bottom right */}
                  <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl"
                       style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
                    <p className="text-white text-[9px] font-black font-mono tracking-wider">
                      {assignedGateId}
                    </p>
                  </div>

                  {/* Ethiopian clock — bottom left */}
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl"
                       style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
                    <p className="text-white text-[9px] font-black font-mono">{clock}</p>
                  </div>

                  {/* Access Denied flash overlay */}
                  <AnimatePresence>
                    {flash === 'deny' && (
                      <motion.div key="deny"
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                  style={{ background: 'rgba(255,23,68,0.1)' }}>
                        <div className="px-8 py-4 rounded-2xl"
                             style={{ background: '#c62828', boxShadow: '0 0 50px rgba(0,0,0,0.7)' }}>
                          <p className="text-white font-black text-lg uppercase tracking-widest">
                            ✗ ACCESS DENIED
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Per-person block countdowns */}
                  <AnimatePresence>
                    {Object.entries(blockCountdowns).map(([key, secs]) => secs > 0 && (
                      <motion.div key={key}
                                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                                  className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
                             style={{ background: 'rgba(20,0,0,0.92)', border: '1px solid #ff1744', backdropFilter: 'blur(8px)' }}>
                          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#ff1744' }}>
                            Too many failed attempts
                          </p>
                          <p className="text-2xl font-black text-white">{secs}s</p>
                          <p className="text-[9px]" style={{ color: '#ff6666' }}>Please wait before retrying</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Controls */}
            {!displayOnly && (
              <div className="flex items-center justify-center gap-4 px-5 py-4 shrink-0"
                   style={{ background: '#080808', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {!running ? (
                  <button onClick={startCamera}
                          className="flex items-center gap-3 px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest text-white"
                          style={{ background: 'linear-gradient(135deg,#cc0000,#8b0000)', boxShadow: '0 4px 24px rgba(204,0,0,0.45)' }}>
                    <Play size={16} /> Start Camera
                  </button>
                ) : (
                  <button onClick={stopCamera}
                          className="flex items-center gap-3 px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest"
                          style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>
                    <StopCircle size={16} style={{ color: '#cc0000' }} /> Stop Camera
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          /* Minimised pill */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="fixed bottom-6 right-6 z-50">
            <button onClick={() => setMinimized(false)}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-sm text-white hover:scale-105 transition-transform"
                    style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              <Camera size={15} style={{ color: '#cc0000' }} />
              Camera{' '}
              {running
                ? <span style={{ color: '#00e676' }}>● Live</span>
                : <span style={{ color: '#444' }}>● Offline</span>}
              {running && faceCount > 0 && (
                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-black"
                      style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676' }}>
                  {faceCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}