import React, { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Scan, X, CheckCircle, XCircle, AlertTriangle, ShieldAlert, Eye, Monitor } from 'lucide-react'
import { recognitionAPI } from '../services/api'
import { useLang } from '../context/LanguageContext'

const RESULT_COLORS = {
  ACCEPTED: '#22c55e',
  REJECTED: '#ef4444',
  SPOOF_DETECTED: '#f59e0b',
  ATTEMPT_LIMIT_REACHED: '#7c3aed',
  ERROR: '#ef4444',
}

const RESULT_ICONS = {
  ACCEPTED: CheckCircle,
  REJECTED: XCircle,
  SPOOF_DETECTED: AlertTriangle,
  ATTEMPT_LIMIT_REACHED: ShieldAlert,
}

// Face detection library loader
const loadFaceApi = async () => {
  if (window.faceapi) return window.faceapi
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/face-api.js/dist/face-api.min.js'
  script.async = true
  await new Promise((resolve, reject) => {
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return window.faceapi
}

export default function FaceScanOverlay({ cameraId, onClose }) {
  const { t } = useLang()
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)

  // Mode state
  const [mode, setMode] = useState('scanner') // 'scanner' or 'shower'

  // Scanner mode states
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [person, setPerson] = useState(null)
  const [scanLine, setScanLine] = useState(false)
  const [showIdCard, setShowIdCard] = useState(false)

  // Shower mode states
  const [trackedFaces, setTrackedFaces] = useState([])
  const [faceApiReady, setFaceApiReady] = useState(false)

  // Load face-api on mount
  useEffect(() => {
    loadFaceApi()
      .then(() => {
        setFaceApiReady(true)
      })
      .catch(() => console.warn('Face API failed to load, tracking disabled'))
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCANNER MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const doScan = useCallback(async () => {
    if (scanning) return
    const image = webcamRef.current?.getScreenshot()
    if (!image) return

    setScanning(true)
    setScanLine(true)
    try {
      const { data } = await recognitionAPI.scan({ image, camera_id: cameraId })
      setResult(data.result)
      if (data.result === 'ACCEPTED') {
        setPerson(data)
        setShowIdCard(true)
        clearInterval(intervalRef.current)
      }
    } catch (err) {
      setResult('ERROR')
    } finally {
      setScanning(false)
      setScanLine(false)
    }
  }, [scanning, cameraId])

  // Auto-scan in scanner mode
  useEffect(() => {
    if (mode !== 'scanner') {
      clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(doScan, 1500)
    return () => clearInterval(intervalRef.current)
  }, [doScan, mode])

  // Auto-clear result after 4 seconds
  useEffect(() => {
    if (mode !== 'scanner' || !result || result === 'ATTEMPT_LIMIT_REACHED') return

    const timer = setTimeout(() => {
      setResult(null)
      setPerson(null)
      setShowIdCard(false)
      intervalRef.current = setInterval(doScan, 1500)
    }, 4000)
    return () => clearTimeout(timer)
  }, [result, doScan, mode])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SHOWER MODE (SURVEILLANCE)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const detectAndTrackFaces = useCallback(async () => {
    if (!faceApiReady || mode !== 'shower') return

    const video = webcamRef.current?.video
    const canvas = canvasRef.current
    if (!video || !canvas) return

    try {
      // Detect all faces with landmarks
      const detections = await window.faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()

      if (detections.length === 0) {
        setTrackedFaces([])
        return
      }

      // Process detections and attempt recognition
      const facesData = await Promise.all(
        detections.map(async (detection, idx) => {
          const box = detection.detection.box
          const image = webcamRef.current?.getScreenshot()

          let person = null
          let isKnown = false

          if (image) {
            try {
              const { data } = await recognitionAPI.scan({
                image,
                camera_id: cameraId,
              })
              if (data.result === 'ACCEPTED') {
                person = data
                isKnown = true
              }
            } catch (_) {}
          }

          return {
            id: idx,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            person,
            isKnown,
            confidence: person?.confidence || 0,
          }
        })
      )

      setTrackedFaces(facesData)
    } catch (err) {
      console.error('Face detection error:', err)
    }
  }, [faceApiReady, mode, cameraId])

  // Face detection loop in shower mode
  useEffect(() => {
    if (mode !== 'shower' || !faceApiReady) return

    const interval = setInterval(detectAndTrackFaces, 500)
    return () => clearInterval(interval)
  }, [detectAndTrackFaces, mode, faceApiReady])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDERING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const ResultIcon = result ? RESULT_ICONS[result] || XCircle : null
  const resultColor = result ? RESULT_COLORS[result] : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)' }}>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full transition-all"
        style={{
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
        }}
        onMouseEnter={(e) => (e.target.style.background = 'rgba(204,0,0,0.3)')}
        onMouseLeave={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}>
        <X size={18} />
      </button>

      {/* Mode Toggle */}
      <div
        className="absolute top-6 left-6 z-50 flex gap-2 rounded-xl p-1"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(10px)',
        }}>
        {[
          { id: 'scanner', label: 'Scanner', icon: Scan },
          { id: 'shower', label: 'Surveillance', icon: Monitor },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setMode(id)
              setResult(null)
              setPerson(null)
              setTrackedFaces([])
              setShowIdCard(false)
            }}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all"
            style={{
              background: mode === id ? 'linear-gradient(135deg, #cc0000, #aa0000)' : 'transparent',
              color: 'white',
            }}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* SCANNER MODE */}
      {mode === 'scanner' && (
        <div className="w-full max-w-6xl mx-4 flex gap-6 items-stretch">
          {/* Main Scanner */}
          <div className="flex-1">
            <div
              className="relative rounded-3xl overflow-hidden aspect-square"
              style={{
                border: `3px solid ${resultColor || (scanning ? '#cc0000' : 'rgba(255,255,255,0.15)')}`,
                boxShadow: resultColor
                  ? `0 0 40px ${resultColor}88, inset 0 0 40px ${resultColor}22`
                  : scanning
                    ? '0 0 40px rgba(204,0,0,0.6), inset 0 0 30px rgba(204,0,0,0.2)'
                    : '0 0 30px rgba(255,255,255,0.1)',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>

              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.9}
                videoConstraints={{ facingMode: 'user', width: 500, height: 500 }}
                className="w-full h-full object-cover"
              />

              {/* Scan Line Animation */}
              {scanLine && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute left-0 right-0 h-1 animate-scan-line"
                    style={{
                      background: 'linear-gradient(90deg, transparent, #cc0000, transparent)',
                      boxShadow: '0 0 20px #cc0000',
                    }}
                  />
                </div>
              )}

              {/* Corner Brackets */}
              {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map(
                (pos, i) => (
                  <div
                    key={i}
                    className={`absolute ${pos} w-8 h-8`}
                    style={{
                      borderTop: i < 2 ? '3px solid #cc0000' : 'none',
                      borderBottom: i >= 2 ? '3px solid #cc0000' : 'none',
                      borderLeft: i % 2 === 0 ? '3px solid #cc0000' : 'none',
                      borderRight: i % 2 === 1 ? '3px solid #cc0000' : 'none',
                      boxShadow: '#cc0000 0 0 8px',
                    }}
                  />
                )
              )}

              {/* Result Overlay */}
              {result && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
                  style={{
                    background: `${resultColor}15`,
                    animation: 'fadeIn 0.3s ease-out',
                  }}>
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center mb-4 animate-pulse"
                    style={{
                      background: `${resultColor}25`,
                      border: `3px solid ${resultColor}`,
                      boxShadow: `0 0 30px ${resultColor}`,
                    }}>
                    {ResultIcon && <ResultIcon size={48} style={{ color: resultColor }} />}
                  </div>
                  <p className="text-2xl font-black" style={{ color: resultColor }}>
                    {t(
                      result === 'ACCEPTED'
                        ? 'accepted'
                        : result === 'REJECTED'
                          ? 'rejected'
                          : result === 'SPOOF_DETECTED'
                            ? 'spoofDetected'
                            : 'attemptLimit'
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div
              className="mt-4 rounded-xl px-4 py-3 flex items-center justify-center gap-3"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
              }}>
              {scanning ? (
                <>
                  <div
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: '#cc0000', boxShadow: '0 0 10px #cc0000' }}
                  />
                  <span className="text-sm text-white/70">{t('processing')}</span>
                </>
              ) : (
                <>
                  <Scan size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t('scanFace')} • {cameraId}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ID Card Panel */}
          {person && showIdCard && (
            <div
              className="w-80 rounded-2xl p-6 overflow-hidden flex flex-col gap-4"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))',
                border: '2px solid rgba(34,197,94,0.4)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 40px rgba(34,197,94,0.3), inset 0 0 30px rgba(34,197,94,0.1)',
                animation: 'slideInRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>

              {/* Header Badge */}
              <div
                className="text-xs font-bold px-3 py-1 rounded-full self-start"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'white',
                  boxShadow: '0 0 15px rgba(34,197,94,0.6)',
                }}>
                ✓ RECOGNIZED
              </div>

              {/* Profile Image */}
              {person.profile_image && (
                <div className="relative rounded-xl overflow-hidden aspect-square">
                  <img
                    src={person.profile_image}
                    alt={person.name}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'radial-gradient(circle at top, transparent 0%, rgba(0,0,0,0.3) 100%)',
                    }}
                  />
                </div>
              )}

              {/* Person Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Name</p>
                  <p className="text-lg font-bold text-white">{person.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Role</p>
                    <p className="text-sm font-semibold text-white/90">{person.role}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-1">ID</p>
                    <p className="text-sm font-mono text-white/90">{person.digital_id}</p>
                  </div>
                </div>

                {person.position && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Position</p>
                    <p className="text-sm text-white/80">{person.position}</p>
                  </div>
                )}

                <div
                  className="rounded-lg p-3 mt-4"
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}>
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${person.confidence}%`,
                          background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                          boxShadow: '0 0 15px rgba(34,197,94,0.6)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">{person.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Access Granted Badge */}
              <div
                className="rounded-lg py-3 text-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))',
                  border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e',
                  boxShadow: '0 0 20px rgba(34,197,94,0.3)',
                }}>
                ✓ ACCESS GRANTED
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHOWER MODE (SURVEILLANCE) */}
      {mode === 'shower' && (
        <div className="w-full h-full flex flex-col">
          {/* Main Surveillance Feed */}
          <div className="flex-1 relative overflow-hidden rounded-2xl" style={{ margin: '20px' }}>
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.9}
              videoConstraints={{ facingMode: 'user' }}
              className="w-full h-full object-cover"
              style={{
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '0 0 30px rgba(204,0,0,0.2), inset 0 0 30px rgba(0,0,0,0.3)',
              }}
            />

            {/* Face Tracking Overlays */}
            {trackedFaces.map((face) => (
              <div key={face.id}>
                {/* Tracking Rectangle */}
                <div
                  className="absolute"
                  style={{
                    left: `${(face.box.x / 640) * 100}%`,
                    top: `${(face.box.y / 480) * 100}%`,
                    width: `${(face.box.width / 640) * 100}%`,
                    height: `${(face.box.height / 480) * 100}%`,
                    border: `3px solid ${face.isKnown ? '#22c55e' : '#ef4444'}`,
                    boxShadow: `0 0 20px ${face.isKnown ? '#22c55e' : '#ef4444'}`,
                    transition: 'all 0.2s ease-out',
                  }}>
                  {/* Corner Brackets */}
                  {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map(
                    (pos, i) => (
                      <div
                        key={i}
                        className={`absolute ${pos} w-4 h-4`}
                        style={{
                          borderTop: i < 2 ? `2px solid ${face.isKnown ? '#22c55e' : '#ef4444'}` : 'none',
                          borderBottom: i >= 2 ? `2px solid ${face.isKnown ? '#22c55e' : '#ef4444'}` : 'none',
                          borderLeft: i % 2 === 0 ? `2px solid ${face.isKnown ? '#22c55e' : '#ef4444'}` : 'none',
                          borderRight:
                            i % 2 === 1 ? `2px solid ${face.isKnown ? '#22c55e' : '#ef4444'}` : 'none',
                        }}
                      />
                    )
                  )}
                </div>

                {/* Label Above Head */}
                <div
                  className="absolute transform -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-lg"
                  style={{
                    left: `${((face.box.x + face.box.width / 2) / 640) * 100}%`,
                    top: `${((face.box.y - 40) / 480) * 100}%`,
                    background: face.isKnown ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    border: `1px solid ${face.isKnown ? '#22c55e' : '#ef4444'}`,
                    color: face.isKnown ? '#22c55e' : '#ef4444',
                    backdropFilter: 'blur(10px)',
                    boxShadow: `0 0 15px ${face.isKnown ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                    animation: 'pulse 2s ease-in-out infinite',
                  }}>
                    {face.isKnown ? face.person?.name || 'IDENTIFIED' : 'UNKNOWN'}
                  </div>

                {/* Floating ID Card for Known Persons */}
                {face.isKnown && face.person && (
                  <div
                    className="absolute transform -translate-x-1/2 rounded-lg p-3 text-white text-xs"
                    style={{
                      left: `${((face.box.x + face.box.width / 2 + 120) / 640) * 100}%`,
                      top: `${((face.box.y + 20) / 480) * 100}%`,
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
                      border: '1px solid rgba(34,197,94,0.4)',
                      backdropFilter: 'blur(15px)',
                      boxShadow: '0 0 20px rgba(34,197,94,0.4)',
                      maxWidth: '200px',
                      animation: 'slideInRight 0.4s ease-out',
                    }}>
                    <p className="font-bold text-white">{face.person.name}</p>
                    <p className="text-white/70">{face.person.role}</p>
                    <p className="text-white/50 mt-1">ID: {face.person.digital_id}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-white/50">Confidence:</span>
                      <span className="text-green-400 font-bold">{face.confidence}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* HUD Corner Elements */}
            {[
              { pos: 'top-4 left-4', corner: 'tl' },
              { pos: 'top-4 right-4', corner: 'tr' },
              { pos: 'bottom-4 left-4', corner: 'bl' },
              { pos: 'bottom-4 right-4', corner: 'br' },
            ].map(({ pos, corner }) => (
              <div
                key={corner}
                className={`absolute ${pos} w-8 h-8`}
                style={{
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTop: corner.includes('t') ? '2px solid #cc0000' : 'none',
                  borderBottom: corner.includes('b') ? '2px solid #cc0000' : 'none',
                  borderLeft: corner.includes('l') ? '2px solid #cc0000' : 'none',
                  borderRight: corner.includes('r') ? '2px solid #cc0000' : 'none',
                  boxShadow: '#cc0000 0 0 10px',
                }}
              />
            ))}
          </div>

          {/* Surveillance Status Bar */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              background: 'rgba(0,0,0,0.5)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ background: '#cc0000', boxShadow: '0 0 10px #cc0000' }}
              />
              <span className="text-sm text-white/70">LIVE SURVEILLANCE</span>
            </div>
            <span className="text-sm font-mono text-white/50">
              {trackedFaces.length} {trackedFaces.length === 1 ? 'face' : 'faces'} detected
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .animate-scan-line {
          animation: scanLine 2s ease-in-out infinite;
        }

        @keyframes scanLine {
          0% {
            transform: translateY(-100%);
          }
          50% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(100%);
          }
        }
      `}</style>
    </div>
  )
}