import { useEffect, useRef, useState } from 'react'
import type { ID } from '../../types'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Chromium chokes on very long utterances — max chars per chunk. */
const CHUNK_MAX = 1400

/** Split the scene into paragraph chunks; oversized paragraphs by sentence. */
function chunkText(text: string): string[] {
  const paras = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const chunks: string[] = []
  for (const p of paras) {
    if (p.length <= CHUNK_MAX) {
      chunks.push(p)
      continue
    }
    let buf = ''
    for (const sentence of p.split(/(?<=[.!?…])\s+/)) {
      if (buf && buf.length + sentence.length + 1 > CHUNK_MAX) {
        chunks.push(buf)
        buf = sentence
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence
      }
    }
    if (buf) chunks.push(buf)
  }
  return chunks
}

/** English voices first, then alphabetical. */
function sortVoices(vs: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...vs].sort((a, b) => {
    const ae = a.lang.toLowerCase().startsWith('en') ? 0 : 1
    const be = b.lang.toLowerCase().startsWith('en') ? 0 : 1
    return ae - be || a.name.localeCompare(b.name)
  })
}

type Status = 'idle' | 'playing' | 'paused'

/**
 * '▷ Read' control: compact popover with play/pause/stop, voice picker and
 * rate slider. Queues paragraph utterances sequentially. Hidden entirely in
 * browsers without speechSynthesis.
 */
export default function ReadAloud(props: { text: string; sceneId: ID }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(1)

  // Session token invalidates stale onend callbacks after stop/cancel.
  const sessionRef = useRef(0)
  // Refs so queued utterances read the freshest voice/rate, not a stale closure.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const voiceRef = useRef('')
  const rateRef = useRef(1)

  useEffect(() => {
    if (!supported) return
    const load = () => {
      const vs = sortVoices(window.speechSynthesis.getVoices())
      voicesRef.current = vs
      setVoices(vs)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Cancel speech on scene switch and on unmount.
  useEffect(() => {
    if (!supported) return
    return () => {
      sessionRef.current++
      window.speechSynthesis.cancel()
      setStatus('idle')
    }
  }, [props.sceneId])

  if (!supported) return null

  const speakFrom = (chunks: string[], i: number, session: number) => {
    if (sessionRef.current !== session) return
    if (i >= chunks.length) {
      setStatus('idle')
      return
    }
    const u = new SpeechSynthesisUtterance(chunks[i])
    const v = voicesRef.current.find((x) => x.voiceURI === voiceRef.current)
    if (v) u.voice = v
    u.rate = rateRef.current
    u.onend = () => speakFrom(chunks, i + 1, session)
    u.onerror = () => {
      if (sessionRef.current === session) setStatus('idle')
    }
    window.speechSynthesis.speak(u)
  }

  const play = () => {
    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      return
    }
    const chunks = chunkText(props.text)
    if (chunks.length === 0) return
    sessionRef.current++
    window.speechSynthesis.cancel()
    setStatus('playing')
    speakFrom(chunks, 0, sessionRef.current)
  }

  const pause = () => {
    window.speechSynthesis.pause()
    setStatus('paused')
  }

  const stop = () => {
    sessionRef.current++
    window.speechSynthesis.cancel()
    setStatus('idle')
  }

  return (
    <div className="ms-menu-wrap">
      <button
        className={`btn ghost small ${status !== 'idle' ? 'ms-reading' : ''}`}
        title="Read scene aloud"
        onClick={() => setOpen((v) => !v)}
      >
        ▷ Read
      </button>
      {open && (
        <>
          <div className="ms-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="ms-popover rise">
            <div className="row">
              {status === 'playing' ? (
                <button className="btn small" onClick={pause}>
                  ❚❚ Pause
                </button>
              ) : (
                <button
                  className="btn small primary"
                  disabled={!props.text.trim()}
                  onClick={play}
                >
                  ▶ {status === 'paused' ? 'Resume' : 'Play'}
                </button>
              )}
              <button className="btn small ghost" disabled={status === 'idle'} onClick={stop}>
                ■ Stop
              </button>
              {status !== 'idle' && <span className="spinner" style={{ marginLeft: 'auto' }} />}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Voice</label>
              <select
                value={voiceURI}
                onChange={(e) => {
                  setVoiceURI(e.target.value)
                  voiceRef.current = e.target.value
                }}
              >
                <option value="">System default</option>
                {voices.map((v, i) => (
                  <option key={`${v.voiceURI}-${i}`} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>
                Rate <span className="ember-text">{rate.toFixed(2)}×</span>
              </label>
              <input
                type="range"
                min={0.7}
                max={1.4}
                step={0.05}
                value={rate}
                onChange={(e) => {
                  const r = Number(e.target.value)
                  setRate(r)
                  rateRef.current = r
                }}
              />
              <div className="hint">Voice and rate apply from the next paragraph.</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
