import React, { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Camera, RefreshCw, CheckCircle } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

export default function CameraCapture({ label, onCapture, captured = false }) {
  const { t } = useLang()
  const webcamRef = useRef(null)
  const [active, setActive]     = useState(false)
  const [preview, setPreview]   = useState(null)

  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot()
    if (img) {
      setPreview(img)
      setActive(false)
      onCapture(img)
    }
  }, [onCapture])

  const recapture = () => {
    setPreview(null)
    setActive(true)
    onCapture(null)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-center"
         style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>

      <div
        className="relative w-28 h-28 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
        style={{
          background: 'var(--color-bg-secondary)',
          border: captured
            ? '2px solid #22c55e'
            : active
              ? '2px solid var(--color-ameco-red)'
              : '2px dashed var(--color-border-hover)',
        }}
        onClick={() => { if (!active && !preview) setActive(true) }}>

        {preview ? (
          <img src={preview} alt="captured" className="w-full h-full object-cover" />
        ) : active ? (
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.8}
            videoConstraints={{ width: 112, height: 112, facingMode: 'user' }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <Camera size={24} />
            <span className="text-xs">{t('capture')}</span>
          </div>
        )}

        {captured && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
               style={{ background: '#22c55e' }}>
            <CheckCircle size={12} color="white" />
          </div>
        )}
      </div>

      <div className="flex gap-1">
        {active && (
          <button
            type="button"
            onClick={capture}
            className="text-xs px-3 py-1 rounded-lg font-semibold text-white"
            style={{ background: 'var(--color-ameco-red)' }}>
            {t('capture')}
          </button>
        )}
        {preview && (
          <button
            type="button"
            onClick={recapture}
            className="text-xs px-3 py-1 rounded-lg font-semibold flex items-center gap-1"
            style={{
              background: 'var(--color-card-hover)',
              border: '1px solid var(--color-border-main)',
              color: 'var(--color-text-muted)',
            }}>
            <RefreshCw size={10} /> {t('recapture')}
          </button>
        )}
      </div>
    </div>
  )
}