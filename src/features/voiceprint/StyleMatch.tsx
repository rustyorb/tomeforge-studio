import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { PACINGS } from '../../types'
import type { Pacing, StyleControls } from '../../types'
import { streamMessage } from '../../lib/ai'
import { looseJson } from '../../lib/looseJson'
import { ErrorBanner, Field, Modal } from '../../components/ui'

const DIAL_KEYS = [
  'proseDensity', 'vocabulary', 'dialogueFrequency', 'interiorMonologue',
  'humor', 'darkness', 'romance', 'violence', 'surrealism',
] as const

/**
 * Style Match — paste a prose sample (yours, or any author you want to write
 * like) and the AI reverse-engineers it into a full Voiceprint: dials, pacing,
 * POV/tense locks, and voice notes.
 */
export default function StyleMatch(props: { onClose: () => void; onCreated: (id: string) => void }) {
  const createStyleProfile = useStore((s) => s.createStyleProfile)
  const updateStyleProfile = useStore((s) => s.updateStyleProfile)
  const [sample, setSample] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const match = async () => {
    if (sample.trim().split(/\s+/).length < 80) {
      setError('Paste at least ~80 words — the dials need enough prose to read.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const full = await streamMessage({
        system:
          'You are a prose-style analyst for a fiction studio. Respond with ONLY a fenced ```json ' +
          'object — no commentary. Analyze the writing sample and return exactly: ' +
          '{"description": "2-3 clipped lines describing the voice, in the register of \'Dense but readable prose. Slow dread. Dialogue carries subtext.\'", ' +
          '"dials": {"proseDensity":0-10,"vocabulary":0-10,"dialogueFrequency":0-10,"interiorMonologue":0-10,"humor":0-10,"darkness":0-10,"romance":0-10,"violence":0-10,"surrealism":0-10}, ' +
          `"pacing": one of [${PACINGS.map((p) => `"${p}"`).join(',')}], ` +
          '"povLock": "e.g. first person / third person limited / omniscient — as observed, else empty string", ' +
          '"tenseLock": "past tense / present tense as observed, else empty string", ' +
          '"voiceNotes": "3-5 concrete imitation notes: sentence rhythm, signature moves, what to avoid"}',
        messages: [{ role: 'user', content: `WRITING SAMPLE:\n${sample.slice(0, 9000)}\n\nReturn the JSON now.` }],
        temperature: 0.3,
        maxTokens: 600,
      })
      const raw = looseJson(full)
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`Could not read the analysis. Model said: "${full.trim().slice(0, 140)}…"`)
      }
      const o = raw as Record<string, unknown>
      const dials = (o.dials ?? {}) as Record<string, unknown>
      const id = createStyleProfile(name.trim() || 'Matched Voice')
      updateStyleProfile(id, (d) => {
        if (typeof o.description === 'string') d.description = o.description
        for (const k of DIAL_KEYS) {
          const v = dials[k]
          if (typeof v === 'number' && Number.isFinite(v)) {
            ;(d.controls as StyleControls)[k] = Math.max(0, Math.min(10, Math.round(v)))
          }
        }
        if (typeof o.pacing === 'string' && (PACINGS as readonly string[]).includes(o.pacing)) {
          d.controls.pacing = o.pacing as Pacing
        }
        if (typeof o.povLock === 'string') d.povLock = o.povLock
        if (typeof o.tenseLock === 'string') d.tenseLock = o.tenseLock
        if (typeof o.voiceNotes === 'string') d.voiceNotes = o.voiceNotes
      })
      props.onCreated(id)
      props.onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="🧬 Style Match" onClose={props.onClose}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Paste a few paragraphs — your own best pages, or any voice you want to write toward —
        and the analyst reverse-engineers it into a complete Voiceprint: all nine dials, pacing,
        POV/tense locks, and imitation notes.
      </p>
      <Field label="Profile name">
        <input
          type="text"
          value={name}
          placeholder="e.g. My Novel Voice, McCarthy-ish, Early Drafts"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Writing sample" hint="At least ~80 words; more is better (capped at ~9k characters).">
        <textarea
          rows={9}
          value={sample}
          placeholder="Paste the prose here…"
          onChange={(e) => setSample(e.target.value)}
        />
      </Field>
      <ErrorBanner error={error} />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost small" onClick={props.onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !sample.trim()} onClick={() => void match()}>
          {busy ? (<><span className="spinner" /> Reading the voice…</>) : '🧬 Match this voice'}
        </button>
      </div>
    </Modal>
  )
}
