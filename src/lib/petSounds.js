// Pet sound effects, synthesized with the Web Audio API (no audio files to load).
// Browsers only allow audio after a tap, so a sound that fires before the first
// interaction is silently skipped.

const MUTE_KEY = 'pet-sounds-muted'

let ctx = null
let muted = false
try { muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* storage unavailable */ }

export const isMuted = () => muted

export function setMuted(value) {
  muted = value
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0') } catch { /* ignore */ }
}

function audio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

// One note: frequency can glide to `slide` over its length
function tone(c, { freq, at = 0, dur = 0.15, type = 'sine', gain = 0.18, slide = null }) {
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

// A short burst of filtered noise (crunches, splashes)
function noise(c, { at = 0, dur = 0.08, freq = 1200, q = 1, gain = 0.2, type = 'bandpass' }) {
  const t = c.currentTime + at
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(c.destination)
  src.start(t)
}

const notes = (c, freqs, { step = 0.1, dur = 0.16, type = 'triangle', gain = 0.16, at = 0 } = {}) =>
  freqs.forEach((freq, i) => tone(c, { freq, at: at + i * step, dur, type, gain }))

const SOUNDS = {
  // Happy "woof woof"
  bark: (c) => {
    tone(c, { freq: 380, slide: 180, dur: 0.14, type: 'sawtooth', gain: 0.13 })
    noise(c, { dur: 0.1, freq: 900, q: 0.8, gain: 0.08 })
    tone(c, { freq: 420, slide: 200, at: 0.2, dur: 0.14, type: 'sawtooth', gain: 0.13 })
    noise(c, { at: 0.2, dur: 0.1, freq: 900, q: 0.8, gain: 0.08 })
  },
  // Cheerful "tweet-tweet"
  tweet: (c) => {
    tone(c, { freq: 1500, slide: 2400, dur: 0.07, type: 'sine', gain: 0.1 })
    tone(c, { freq: 2300, slide: 1700, at: 0.09, dur: 0.07, type: 'sine', gain: 0.1 })
    tone(c, { freq: 1700, slide: 2600, at: 0.22, dur: 0.09, type: 'sine', gain: 0.1 })
  },
  // "Ribbit"
  ribbit: (c) => {
    tone(c, { freq: 140, slide: 220, dur: 0.12, type: 'sawtooth', gain: 0.1 })
    tone(c, { freq: 200, slide: 120, at: 0.13, dur: 0.14, type: 'sawtooth', gain: 0.1 })
  },
  // A tiny squeak for lizards, turtles, hedgehogs and axolotls
  squeak: (c) => {
    tone(c, { freq: 900, slide: 1500, dur: 0.1, type: 'triangle', gain: 0.1 })
    tone(c, { freq: 1300, slide: 800, at: 0.12, dur: 0.12, type: 'triangle', gain: 0.1 })
  },
  levelup: (c) => {
    notes(c, [523, 659, 784, 1047, 1319], { step: 0.1, dur: 0.18, type: 'triangle', gain: 0.15 })
    tone(c, { freq: 1568, at: 0.55, dur: 0.6, type: 'triangle', gain: 0.14 })
    tone(c, { freq: 2093, at: 0.55, dur: 0.6, type: 'sine', gain: 0.06 })
  },
  // "Mee-ow"
  meow: (c) => {
    tone(c, { freq: 520, slide: 880, dur: 0.18, type: 'triangle', gain: 0.16 })
    tone(c, { freq: 880, slide: 420, at: 0.18, dur: 0.3, type: 'triangle', gain: 0.16 })
  },
  eat: (c) => {
    for (let i = 0; i < 5; i++) noise(c, { at: i * 0.11, dur: 0.06, freq: 1800 + (i % 2) * 700, q: 2, gain: 0.22 })
    tone(c, { freq: 660, at: 0.6, dur: 0.12, gain: 0.1 })
    tone(c, { freq: 880, at: 0.7, dur: 0.18, gain: 0.1 })
  },
  treat: (c) => {
    noise(c, { dur: 0.05, freq: 2500, q: 3, gain: 0.2 })
    noise(c, { at: 0.08, dur: 0.05, freq: 2200, q: 3, gain: 0.2 })
    notes(c, [784, 988, 1175], { step: 0.09, at: 0.2 })
  },
  toy: (c) => {
    tone(c, { freq: 900, slide: 1500, dur: 0.09, type: 'square', gain: 0.07 })
    tone(c, { freq: 1100, slide: 1800, at: 0.14, dur: 0.09, type: 'square', gain: 0.07 })
    tone(c, { freq: 800, slide: 1400, at: 0.28, dur: 0.12, type: 'square', gain: 0.07 })
  },
  groom: (c) => {
    noise(c, { dur: 0.5, freq: 2500, q: 0.6, gain: 0.12, type: 'highpass' })
    for (let i = 0; i < 4; i++) tone(c, { freq: 500 + i * 200, slide: 1200 + i * 200, at: 0.1 + i * 0.12, dur: 0.07, gain: 0.08 })
  },
  // Soft lullaby
  sleep: (c) => notes(c, [523, 440, 392, 330], { step: 0.24, dur: 0.4, type: 'sine', gain: 0.12 }),
  purr: (c) => {
    for (let i = 0; i < 14; i++) tone(c, { freq: 70, at: i * 0.05, dur: 0.05, type: 'sawtooth', gain: 0.12 })
    notes(c, [659, 784], { step: 0.18, dur: 0.3, type: 'sine', gain: 0.1 })
  },
  // Coin "ka-ching"
  buy: (c) => {
    tone(c, { freq: 988, dur: 0.09, type: 'square', gain: 0.08 })
    tone(c, { freq: 1319, at: 0.09, dur: 0.35, type: 'square', gain: 0.08 })
  },
  sparkle: (c) => notes(c, [1047, 1319, 1568, 2093], { step: 0.07, dur: 0.14, type: 'sine', gain: 0.1 }),
  take: (c) => tone(c, { freq: 700, slide: 400, dur: 0.12, type: 'sine', gain: 0.1 }),
  // Adoption fanfare
  adopt: (c) => {
    notes(c, [523, 659, 784, 1047], { step: 0.12, dur: 0.2, type: 'triangle', gain: 0.16 })
    tone(c, { freq: 1047, at: 0.5, dur: 0.5, type: 'triangle', gain: 0.16 })
    tone(c, { freq: 1319, at: 0.5, dur: 0.5, type: 'triangle', gain: 0.1 })
  },
  save: (c) => notes(c, [784, 1047], { step: 0.09, dur: 0.12, type: 'sine', gain: 0.12 }),
  error: (c) => tone(c, { freq: 220, slide: 150, dur: 0.22, type: 'square', gain: 0.07 }),
  tap: (c) => tone(c, { freq: 600, dur: 0.05, type: 'sine', gain: 0.08 }),
}

// play('eat'), play('greet', 'dog'), ...
export function playSound(name, kind = 'dog') {
  if (muted) return
  const GREETING = { dog: 'bark', cat: 'meow', bird: 'tweet', frog: 'ribbit' }
  const key = name === 'greet' ? (GREETING[kind] || 'squeak') : name
  const fn = SOUNDS[key]
  const c = fn && audio()
  if (!c) return
  try { fn(c) } catch { /* never let a sound break the app */ }
}
