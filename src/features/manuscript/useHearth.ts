import { useEffect, useRef, useState } from 'react'

export type HearthMode = 'off' | 'fire' | 'rain'

/**
 * The Hearth — ambient sound for Focus Mode, synthesized entirely with
 * WebAudio (no asset files): crackling fire or steady rain. Cycles
 * off → fire → rain. Everything torn down cleanly on unmount.
 */
export function useHearth() {
  const [mode, setMode] = useState<HearthMode>('off')
  const ctxRef = useRef<AudioContext | null>(null)
  const crackleTimer = useRef<number | null>(null)

  const stop = () => {
    if (crackleTimer.current) {
      window.clearInterval(crackleTimer.current)
      crackleTimer.current = null
    }
    void ctxRef.current?.close().catch(() => undefined)
    ctxRef.current = null
  }

  const noiseBuffer = (ctx: AudioContext, seconds = 2): AudioBuffer => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: integrate white noise for a warmer bed.
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    return buffer
  }

  const start = (kind: Exclude<HearthMode, 'off'>) => {
    stop()
    const ctx = new AudioContext()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    // Gentle fade-in so it never startles.
    master.gain.linearRampToValueAtTime(kind === 'rain' ? 0.14 : 0.1, ctx.currentTime + 1.5)

    const bed = ctx.createBufferSource()
    bed.buffer = noiseBuffer(ctx)
    bed.loop = true
    const bedFilter = ctx.createBiquadFilter()
    bedFilter.type = 'lowpass'
    bedFilter.frequency.value = kind === 'rain' ? 2400 : 420
    bed.connect(bedFilter)
    bedFilter.connect(master)
    bed.start()

    if (kind === 'rain') {
      // A hiss layer on top of the bed reads as rainfall.
      const hiss = ctx.createBufferSource()
      const hb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const hd = hb.getChannelData(0)
      for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * 0.35
      hiss.buffer = hb
      hiss.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1800
      const hg = ctx.createGain()
      hg.gain.value = 0.5
      hiss.connect(hp)
      hp.connect(hg)
      hg.connect(master)
      hiss.start()
    } else {
      // Random crackles: short bandpassed noise bursts with fast decay.
      crackleTimer.current = window.setInterval(() => {
        if (!ctxRef.current || Math.random() > 0.55) return
        const c = ctxRef.current
        const burst = c.createBufferSource()
        const len = 0.03 + Math.random() * 0.08
        const bb = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate)
        const bd = bb.getChannelData(0)
        for (let i = 0; i < bd.length; i++) {
          bd[i] = (Math.random() * 2 - 1) * (1 - i / bd.length)
        }
        burst.buffer = bb
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900 + Math.random() * 2600
        bp.Q.value = 1.2
        const bg = c.createGain()
        bg.gain.value = 0.25 + Math.random() * 0.5
        burst.connect(bp)
        bp.connect(bg)
        bg.connect(master)
        burst.start()
      }, 140)
    }
  }

  const cycle = () => {
    const next: HearthMode = mode === 'off' ? 'fire' : mode === 'fire' ? 'rain' : 'off'
    setMode(next)
    if (next === 'off') stop()
    else start(next)
  }

  useEffect(() => stop, [])

  return { mode, cycle }
}
