import { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, RefreshCw, CheckCircle, X, CreditCard, ChevronRight } from 'lucide-react'

const FaceGuide = ({ angle = 'front', size = 120 }) => {
  const guides = {
    front: (
      <g transform={`translate(${size/2},${size/2})`}>
        {/* Head */}
        <ellipse cx="0" cy="-8" rx="32" ry="38" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="2" strokeDasharray="4 3"/>
        {/* Eyes */}
        <ellipse cx="-11" cy="-14" rx="5" ry="3.5" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <ellipse cx="11"  cy="-14" rx="5" ry="3.5" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        {/* Nose */}
        <path d="M-4,-6 L0,4 L4,-6" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Mouth */}
        <path d="M-10,12 Q0,18 10,12" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        {/* Ears */}
        <ellipse cx="-34" cy="-8" rx="4" ry="8" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <ellipse cx="34"  cy="-8" rx="4" ry="8" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        {/* Neck */}
        <line x1="-8" y1="30" x2="-8" y2="42" stroke="rgba(204,0,0,0.3)" strokeWidth="1.5"/>
        <line x1="8"  y1="30" x2="8"  y2="42" stroke="rgba(204,0,0,0.3)" strokeWidth="1.5"/>
      </g>
    ),
    left: (
      <g transform={`translate(${size/2 - 10},${size/2})`}>
        <path d="M 20,-35 Q -10,-38 -15,-8 Q -16,18 10,32" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="2" strokeDasharray="4 3"/>
        <ellipse cx="-2" cy="-14" rx="5" ry="3.5" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <path d="M -6,-6 L -2,4 L 2,-6" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <path d="M-8,12 Q2,18 10,14" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <ellipse cx="22" cy="-8" rx="4" ry="8" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <text x="-18" y="52" fill="rgba(204,0,0,0.6)" fontSize="9" fontWeight="bold">TURN LEFT</text>
      </g>
    ),
    right: (
      <g transform={`translate(${size/2 + 10},${size/2})`}>
        <path d="M -20,-35 Q 10,-38 15,-8 Q 16,18 -10,32" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="2" strokeDasharray="4 3"/>
        <ellipse cx="2"  cy="-14" rx="5" ry="3.5" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <path d="M -2,-6 L 2,4 L 6,-6" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <path d="M-10,12 Q2,18 8,14" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <ellipse cx="-22" cy="-8" rx="4" ry="8" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <text x="-22" y="52" fill="rgba(204,0,0,0.6)" fontSize="9" fontWeight="bold">TURN RIGHT</text>
      </g>
    ),
    down: (
      <g transform={`translate(${size/2},${size/2 + 8})`}>
        <ellipse cx="0" cy="-12" rx="32" ry="30" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="2" strokeDasharray="4 3"/>
        <ellipse cx="-11" cy="-8" rx="6" ry="4" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <ellipse cx="11"  cy="-8" rx="6" ry="4" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
        <path d="M-6,-2 Q0,6 6,-2" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5"/>
        <text x="-18" y="30" fill="rgba(204,0,0,0.6)" fontSize="9" fontWeight="bold">LOOK DOWN</text>
      </g>
    ),
    unusual: (
      <g transform={`translate(${size/2},${size/2})`}>
        {/* Head */}
        <ellipse cx="0" cy="-8" rx="32" ry="38" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="2" strokeDasharray="4 3"/>
        {/* Glasses */}
        <rect x="-22" y="-20" width="18" height="10" rx="4" fill="none" stroke="rgba(204,0,0,0.7)" strokeWidth="1.5"/>
        <rect x="4"   y="-20" width="18" height="10" rx="4" fill="none" stroke="rgba(204,0,0,0.7)" strokeWidth="1.5"/>
        <line x1="-4" y1="-15" x2="4" y2="-15" stroke="rgba(204,0,0,0.6)" strokeWidth="1.5"/>
        {/* Hat */}
        <rect x="-36" y="-52" width="72" height="10" rx="3" fill="none" stroke="rgba(204,0,0,0.7)" strokeWidth="1.5"/>
        <rect x="-24" y="-72" width="48" height="22" rx="4" fill="none" stroke="rgba(204,0,0,0.7)" strokeWidth="1.5"/>
        {/* Mouth */}
        <path d="M-10,12 Q0,18 10,12" fill="none" stroke="rgba(204,0,0,0.5)" strokeWidth="1.5"/>
      </g>
    ),
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
      {guides[angle] || guides.front}
    </svg>
  )
}

// ── ID Card frame guide ───────────────────────────────────────────────────────
const IDCardGuide = ({ width = 240, height = 150 }) => (
  <div style={{
    position:'absolute', top:'50%', left:'50%',
    transform:'translate(-50%,-50%)',
    width, height,
    border:'2px dashed rgba(204,0,0,0.7)',
    borderRadius:'12px',
    pointerEvents:'none',
  }}>
    {/* Corner accents */}
    {[
      { top:'-2px', left:'-2px', borderTop:'3px solid #cc0000', borderLeft:'3px solid #cc0000' },
      { top:'-2px', right:'-2px', borderTop:'3px solid #cc0000', borderRight:'3px solid #cc0000' },
      { bottom:'-2px', left:'-2px', borderBottom:'3px solid #cc0000', borderLeft:'3px solid #cc0000' },
      { bottom:'-2px', right:'-2px', borderBottom:'3px solid #cc0000', borderRight:'3px solid #cc0000' },
    ].map((style, i) => (
      <div key={i} style={{ position:'absolute', width:'18px', height:'18px', ...style }} />
    ))}
    {/* Animated laser line */}
    <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:'10px' }}>
      <motion.div
        animate={{ y: ['0%', '100%', '0%'] }}
        transition={{ duration:2, repeat:Infinity, ease:'linear' }}
        style={{ height:'2px', background:'linear-gradient(90deg,transparent,#cc0000,transparent)', opacity:0.8 }}
      />
    </div>
    <p style={{
      position:'absolute', bottom:'-24px', left:'50%', transform:'translateX(-50%)',
      color:'rgba(204,0,0,0.8)', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap',
    }}>
      Position ID card inside the frame
    </p>
  </div>
)

// ── Unusual Wear pre-animation ────────────────────────────────────────────────
function UnusualWearIntro({ onContinue }) {
  const [step, setStep] = useState(0) // 0=glasses, 1=hat, 2=ready

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 2000)
    const t2 = setTimeout(() => setStep(2), 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-6 text-center"
         style={{ background:'var(--color-card-main)', borderRadius:'1.5rem', maxWidth:'340px', margin:'0 auto' }}>
      <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
           style={{ background:'rgba(204,0,0,0.1)' }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="glasses" initial={{ opacity:0,scale:0.5 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:0.5 }}>
              <svg width="60" height="30" viewBox="0 0 60 30">
                <rect x="0"  y="4" width="24" height="16" rx="6" fill="none" stroke="#cc0000" strokeWidth="2.5"/>
                <rect x="36" y="4" width="24" height="16" rx="6" fill="none" stroke="#cc0000" strokeWidth="2.5"/>
                <line x1="24" y1="12" x2="36" y2="12" stroke="#cc0000" strokeWidth="2"/>
              </svg>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="hat" initial={{ opacity:0,y:-20 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}>
              <svg width="60" height="60" viewBox="0 0 60 60">
                <rect x="5" y="38" width="50" height="10" rx="4" fill="none" stroke="#cc0000" strokeWidth="2.5"/>
                <rect x="16" y="14" width="28" height="26" rx="6" fill="none" stroke="#cc0000" strokeWidth="2.5"/>
              </svg>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="ready" initial={{ opacity:0,scale:0.5 }} animate={{ opacity:1,scale:1 }}>
              <CheckCircle size={40} style={{ color:'#22c55e' }}/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <p className="font-black text-sm" style={{ color:'var(--color-text-main)' }}>
          {step === 0 && 'Put on your glasses'}
          {step === 1 && 'Now put on a hat or head covering'}
          {step === 2 && 'Ready for your final scan!'}
        </p>
        <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
          {step < 2
            ? 'Please put on any glasses, hat, scarf, or accessory you normally wear.'
            : 'Click Continue to open the camera for your unusual wear scan.'
          }
        </p>
      </div>

      {step === 2 && (
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm"
          style={{ background:'linear-gradient(135deg,#cc0000,#aa0000)' }}>
          Continue to Final Scan <ChevronRight size={16}/>
        </button>
      )}
    </div>
  )
}

function CaptureModal({ slot, onCapture, onClose }) {
  const webcamRef    = useRef(null)
  const [countdown, setCountdown] = useState(3)
  const [ready, setReady]         = useState(false)
  const [showIntro, setShowIntro] = useState(slot.key === 'unusual')

  // countdown
  useEffect(() => {
    if (showIntro || !ready) return
    if (countdown <= 0) {
      handleCapture()
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, ready, showIntro])

  // start countdown 1s after modal opens (not unusual intro)
  useEffect(() => {
    if (showIntro) return
    const t = setTimeout(() => setReady(true), 800)
    return () => clearTimeout(t)
  }, [showIntro])

  const handleCapture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot()
    if (img) {
      onCapture(img); 
      onClose()
    }
  }, [onCapture, onClose])

  const isIDSlot      = slot.key === 'id_front' || slot.key === 'id_back'
  const isProfileSlot = slot.key === 'profile'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
         style={{ background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)' }}>
      <div className="relative w-full max-w-md mx-4 rounded-3xl overflow-hidden"
           style={{ background:'#0a0a0a', border:'1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
             style={{ borderColor:'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-white font-black text-sm">{slot.label}</p>
            <p className="text-xs" style={{ color:'#666' }}>{slot.instruction}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
                  style={{ background:'rgba(255,255,255,0.08)', color:'white' }}>
            <X size={14}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {showIntro ? (
            <UnusualWearIntro onContinue={() => setShowIntro(false)}/>
          ) : (
            <div className="relative rounded-2xl overflow-hidden"
                 style={{ aspectRatio: isIDSlot ? '4/2.5' : '1/1', background:'#000' }}>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.85}
                videoConstraints={{ facingMode:'user', width:480, height: isIDSlot ? 300 : 480 }}
                className="w-full h-full object-cover"
                style={{ filter:'brightness(1.05)' }}
              />

              {/* Guide overlay */}
              {isIDSlot && <IDCardGuide/>}
              {isProfileSlot && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <FaceGuide angle="front" size={200}/>
                </div>
              )}
              {!isIDSlot && !isProfileSlot && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <FaceGuide angle={slot.key} size={200}/>
                </div>
              )}

              {/* Countdown overlay */}
              {ready && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    key={countdown}
                    initial={{ scale:1.5, opacity:0 }}
                    animate={{ scale:1, opacity:1 }}
                    exit={{ opacity:0 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background:'rgba(204,0,0,0.7)', border:'3px solid #cc0000' }}>
                    <span className="text-white text-3xl font-black">{countdown}</span>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        {!showIntro && (
          <div className="flex items-center justify-center gap-3 px-5 pb-5">
            <button
              onClick={handleCapture}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl text-white font-black text-sm"
              style={{ background:'linear-gradient(135deg,#cc0000,#aa0000)' }}>
              <Camera size={16}/> Capture Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single slot card ──────────────────────────────────────────────────────────
function SlotCard({ slot, value, onCapture }) {
  const [showModal, setShowModal] = useState(false)
  const [hovered,   setHovered]   = useState(false)
  const filled = !!value

  return (
    <>
      <div
        className="flex flex-col items-center gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Slot visual */}
        <div
          className="relative cursor-pointer transition-all duration-200 overflow-hidden"
          style={{
            width:  slot.wide ? '160px' : '110px',
            height: slot.wide ? '100px' : '110px',
            borderRadius:'16px',
            border: filled
              ? '2.5px solid #22c55e'
              : '2px dashed rgba(204,0,0,0.4)',
            boxShadow: filled
              ? '0 0 18px rgba(34,197,94,0.4)'
              : hovered ? '0 0 12px rgba(204,0,0,0.3)' : 'none',
            background: 'var(--color-bg-secondary)',
            transition: 'all 0.25s ease',
          }}
          onClick={() => setShowModal(true)}
        >
          {filled ? (
            <>
              <img src={value} alt="" className="w-full h-full object-cover"/>
              {/* Retake overlay on hover */}
              {hovered && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                     style={{ background:'rgba(0,0,0,0.65)' }}>
                  <RefreshCw size={18} color="white"/>
                  <span className="text-white text-[10px] font-black">Retake</span>
                </div>
              )}
              {/* Green check */}
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                   style={{ background:'#22c55e' }}>
                <CheckCircle size={12} color="white"/>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
              <slot.EmptyIcon/>
              <span className="text-[10px] font-semibold text-center"
                    style={{ color:'var(--color-text-muted)' }}>
                {slot.emptyText}
              </span>
            </div>
          )}
        </div>

        {/* Label */}
        <p className="text-[11px] font-bold uppercase tracking-wide text-center"
           style={{ color: filled ? '#22c55e' : 'var(--color-text-muted)', maxWidth:'110px' }}>
          {slot.label}
        </p>
      </div>

      {/* Webcam Modal */}
      {showModal && (
        <CaptureModal
          slot={slot}
          onCapture={(img) => { onCapture(slot.key, img); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

// ── Main CaptureSystem export ─────────────────────────────────────────────────
export default function CaptureSystem({ values = {}, onChange }) {
  const handleCapture = (key, img) => {
    onChange({ ...values, [key]: img })
  }

  const SLOTS = [
    // Profile photo
    {
      key:'profile', label:'Profile Photo', wide:false,
      instruction:'Align your face with the guide',
      emptyText:'Tap to capture',
      EmptyIcon: () => (
        <svg width="40" height="40" viewBox="0 0 40 40">
          <ellipse cx="20" cy="14" rx="10" ry="12" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
          <ellipse cx="20" cy="34" rx="14" ry="8" fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
        </svg>
      ),
    },
    // ID Front
    {
      key:'id_front', label:'ID Card — Front', wide:true,
      instruction:'Place ID card inside the dashed frame',
      emptyText:'Tap to capture',
      EmptyIcon: () => <CreditCard size={28} style={{ color:'rgba(204,0,0,0.4)' }}/>,
    },
    // ID Back
    {
      key:'id_back', label:'ID Card — Back', wide:true,
      instruction:'Flip ID card, place inside frame',
      emptyText:'Tap to capture',
      EmptyIcon: () => <CreditCard size={28} style={{ color:'rgba(204,0,0,0.4)', transform:'scaleX(-1)' }}/>,
    },
  ]

  const FACE_SLOTS = [
    { key:'front',   label:'Face — Front',   instruction:'Look directly at the camera',      emptyText:'Front angle' },
    { key:'left',    label:'Face — Left',    instruction:'Turn your head to the LEFT',        emptyText:'Left angle'  },
    { key:'right',   label:'Face — Right',   instruction:'Turn your head to the RIGHT',       emptyText:'Right angle' },
    { key:'down',    label:'Face — Down',    instruction:'Tilt your head DOWN toward chest',  emptyText:'Down angle'  },
    { key:'unusual', label:'Unusual Wear',   instruction:'With glasses/hat — put them on first', emptyText:'With accessories' },
  ].map(s => ({
    ...s,
    wide: false,
    EmptyIcon: () => <FaceGuide angle={s.key} size={60}/>,
  }))

  const allSlots  = [...SLOTS, ...FACE_SLOTS]
  const filledCount = allSlots.filter(s => values[s.key]).length

  return (
    <div className="space-y-6">

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--color-text-muted)' }}>
            Biometric Capture
          </p>
          <p className="text-xs font-bold" style={{ color: filledCount === allSlots.length ? '#22c55e' : 'var(--color-text-muted)' }}>
            {filledCount}/{allSlots.length} captured
          </p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--color-border-main)' }}>
          <motion.div
            animate={{ width:`${(filledCount/allSlots.length)*100}%` }}
            transition={{ duration:0.4 }}
            className="h-full rounded-full"
            style={{ background:'linear-gradient(90deg,#cc0000,#22c55e)' }}
          />
        </div>
      </div>

      {/* Profile + ID Cards */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest mb-3"
           style={{ color:'#cc0000' }}>
          Profile & ID Cards
        </p>
        <div className="flex flex-wrap gap-5 items-start">
          {SLOTS.map(slot => (
            <SlotCard key={slot.key} slot={slot} value={values[slot.key]} onCapture={handleCapture}/>
          ))}
        </div>
      </div>

      {/* Face scan angles */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest mb-3"
           style={{ color:'#cc0000' }}>
          Face Scan — 5 Angles
        </p>
        <div className="flex flex-wrap gap-5 items-start">
          {FACE_SLOTS.map(slot => (
            <SlotCard key={slot.key} slot={slot} value={values[slot.key]} onCapture={handleCapture}/>
          ))}
        </div>
      </div>
    </div>
  )
}