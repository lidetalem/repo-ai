/**
 * audioManager.js — Centralized, queue-based audio for AMECO
 *
 * Rules enforced:
 *  • Only ONE sound ever plays at a time — no overlaps.
 *  • A new request cancels the current sound before starting.
 *  • TTS reuses a single <audio> element (easy to cancel).
 *  • Speech synthesis uses rate 1.35 — fast, professional, clear.
 *  • beepThenSpeak() plays the beep first, waits for it to finish,
 *    then plays speech — guaranteed sequential, zero overlap.
 */

let _ttsAudio = null

function getTTSAudio() {
  if (!_ttsAudio) {
    _ttsAudio = new Audio()
    _ttsAudio.preload = 'auto'
  }
  return _ttsAudio
}

let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

let _queue = []
let _running = false

export function cancelAll() {
  _queue = []
  _running = false
  try { window.speechSynthesis?.cancel() } catch {}
  try {
    const a = getTTSAudio()
    if (!a.paused) { a.pause(); a.currentTime = 0 }
  } catch {}
}

/** Play a short beep. Returns a Promise that resolves when beep ends. */
export function beep(ok = true) {
  return _enqueue(() => _doBeep(ok))
}

function _doBeep(ok = true) {
  return new Promise((resolve) => {
    try {
      const ctx  = getAudioCtx()
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
      resume.then(() => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        const t   = ctx.currentTime
        const dur = 0.45
        if (ok) {
          osc.type = 'sine'
          osc.frequency.setValueAtTime(880,  t)
          osc.frequency.linearRampToValueAtTime(1200, t + 0.12)
          gain.gain.setValueAtTime(0.32, t)
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
        } else {
          osc.type = 'square'
          osc.frequency.setValueAtTime(260, t)
          osc.frequency.setValueAtTime(200, t + 0.12)
          gain.gain.setValueAtTime(0.28,  t)
          gain.gain.setValueAtTime(0,     t + 0.11)
          gain.gain.setValueAtTime(0.24,  t + 0.21)
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
        }
        osc.start(t)
        osc.stop(t + dur)
        osc.onended = () => resolve()
      }).catch(() => resolve())
    } catch { resolve() }
  })
}

/** Web Speech API fallback (English or any lang). */
export function speakWeb(text, lang = 'en-US') {
  return _enqueue(() => _doSpeakWeb(text, lang))
}

function _doSpeakWeb(text, lang = 'en-US') {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) { resolve(); return }
      const u     = new SpeechSynthesisUtterance(text)
      u.lang      = lang
      u.rate      = 1.35   // comfortable professional speed
      u.pitch     = 1.0
      u.volume    = 1.0
      u.onend     = () => resolve()
      u.onerror   = () => resolve()
      synth.speak(u)
    } catch { resolve() }
  })
}

/** Backend TTS for Amharic. Falls back to Web Speech. */
export function speakAmharic(text) {
  return _enqueue(() => _doSpeakAmharic(text))
}

async function _doSpeakAmharic(text) {
  try {
    const resp = await fetch(`/api/tts/?text=${encodeURIComponent(text)}`)
    if (!resp.ok) throw new Error(`TTS ${resp.status}`)
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const a    = getTTSAudio()
    if (a.src?.startsWith('blob:')) URL.revokeObjectURL(a.src)
    a.src          = url
    a.playbackRate = 1.35
    await a.play()
    await new Promise(res => { a.onended = res; a.onerror = res })
  } catch {
    await _doSpeakWeb(text, 'am-ET')
  }
}

/**
 * Play beep, wait for it to finish, THEN speak — guaranteed no overlap.
 * @param {boolean} ok   - true = accept beep, false = deny beep
 * @param {string}  text - Amharic text to speak after beep
 */
export function beepThenSpeak(ok, text) {
  return _enqueue(async () => {
    await _doBeep(ok)
    await new Promise(r => setTimeout(r, 100))
    await _doSpeakAmharic(text)
  })
}

function _enqueue(fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ fn, resolve, reject })
    _runQueue()
  })
}

async function _runQueue() {
  if (_running) return
  _running = true
  while (_queue.length) {
    const item = _queue.shift()
    try {
      const r = await item.fn()
      item.resolve(r)
    } catch (err) {
      item.reject(err)
    }
  }
  _running = false
}

export default { beep, speakWeb, speakAmharic, beepThenSpeak, cancelAll }