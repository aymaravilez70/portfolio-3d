// Web Audio API Synthesizer for in-game interactive feedback

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Play a high, crystal-clear chime arpeggio when collecting a star.
 */
export function playStarCollectSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  // 3-tone ascending pleasant chord (E6, G#6, B6)
  const notes = [1318.51, 1661.22, 1975.53]

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + idx * 0.06)

    // Quick volume envelope
    gain.gain.setValueAtTime(0.0001, now + idx * 0.06)
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.06 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.32)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + idx * 0.06)
    osc.stop(now + idx * 0.06 + 0.35)
  })
}

/**
 * Play an celebratory fanfare chord when completing the collection.
 */
export function playCompletionSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const chords = [
    { freq: 523.25, time: 0 },    // C5
    { freq: 659.25, time: 0.1 },  // E5
    { freq: 783.99, time: 0.2 },  // G5
    { freq: 1046.50, time: 0.32 } // C6
  ]

  chords.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now + time)

    gain.gain.setValueAtTime(0.0001, now + time)
    gain.gain.exponentialRampToValueAtTime(0.24, now + time + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.6)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + time)
    osc.stop(now + time + 0.65)
  })
}

let lastBumpTime = 0

/**
 * Play a low, tactile thud/bump when colliding with obstacles.
 */
export function playBumpSound(intensity = 1) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  if (now - lastBumpTime < 0.2) return
  lastBumpTime = now

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(115, now)
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.12)

  const vol = Math.min(0.24, 0.08 + intensity * 0.14)
  gain.gain.setValueAtTime(vol, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.15)
}

let lastCrashTime = 0

/**
 * Play a resonant, crisp wooden/stone crash sound when a 3D letter is knocked down.
 */
export function playLetterCrashSound(pitch = 1) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  if (now - lastCrashTime < 0.08) return
  lastCrashTime = now

  // Punchy impact oscillator
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  const startFreq = 240 * pitch
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.22)

  gain.gain.setValueAtTime(0.26, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.25)

  // Subtle wooden clack / overtone
  const clack = ctx.createOscillator()
  const clackGain = ctx.createGain()
  clack.type = 'sine'
  clack.frequency.setValueAtTime(580 * pitch, now)
  clack.frequency.exponentialRampToValueAtTime(180, now + 0.08)

  clackGain.gain.setValueAtTime(0.18, now)
  clackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

  clack.connect(clackGain)
  clackGain.connect(ctx.destination)

  clack.start(now)
  clack.stop(now + 0.1)
}

/**
 * Play an uplifting whoosh/bell chime when the letters spring back upright.
 */
export function playLetterRebuildSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const notes = [440, 554.37, 659.25, 880] // A major ascending

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + idx * 0.04)

    gain.gain.setValueAtTime(0.001, now + idx * 0.04)
    gain.gain.exponentialRampToValueAtTime(0.15, now + idx * 0.04 + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.28)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + idx * 0.04)
    osc.stop(now + idx * 0.04 + 0.3)
  })
}

/**
 * Play a solid mechanical click/door thud when entering or exiting the vehicle.
 */
export function playVehicleDoorSound(isEntering: boolean) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = isEntering ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(isEntering ? 180 : 260, now)
  osc.frequency.exponentialRampToValueAtTime(isEntering ? 80 : 120, now + 0.12)

  gain.gain.setValueAtTime(0.24, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.14)
}
