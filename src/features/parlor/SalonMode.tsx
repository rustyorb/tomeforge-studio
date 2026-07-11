import { useEffect, useRef, useState } from 'react'
import type { CharacterCard, Project, STCardStored, StyleProfile } from '../../types'
import { useStore } from '../../store/useStore'
import { streamMessage } from '../../lib/ai'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { applyMacros } from '../../lib/stMacros'
import { ErrorBanner, Field } from '../../components/ui'
import { chatToProseScene } from './convert'

type Speaker = { key: string; name: string; sheet: string }

interface Beat {
  speaker: string
  text: string
}

function castSheet(c: CharacterCard): string {
  const bits = [
    c.goal && `Goal: ${c.goal}`,
    c.emotionalState && `Feeling: ${c.emotionalState}`,
    c.relationships && `Relationships: ${c.relationships}`,
    c.secrets && `Secrets (guarded): ${c.secrets}`,
    c.voiceNotes && `Voice: ${c.voiceNotes}`,
    c.forbidden && `NEVER: ${c.forbidden}`,
  ].filter(Boolean)
  return `${c.name}:\n${bits.join('\n')}`
}

function guestSheetShort(g: STCardStored): string {
  const bits = [
    g.description && applyMacros(g.description.slice(0, 800), g.name),
    g.personality && `Personality: ${applyMacros(g.personality, g.name)}`,
  ].filter(Boolean)
  return `${g.name} (visiting from outside this story):\n${bits.join('\n')}`
}

/**
 * The Salon — two characters converse with each other while the author
 * moderates: seat any pair (cast or library guests), set the situation,
 * and deal the conversation beat by beat. Chemistry testing for fiction.
 */
export default function SalonMode(props: {
  project: Project
  styleProfile: StyleProfile | null
  guests: STCardStored[]
}) {
  const { project, styleProfile, guests } = props
  const updateProject = useStore((s) => s.updateProject)

  const speakers: Speaker[] = [
    ...project.characters.map((c) => ({ key: `cast:${c.id}`, name: c.name, sheet: castSheet(c) })),
    ...guests.map((g) => ({ key: `guest:${g.id}`, name: `❖ ${g.name}`, sheet: guestSheetShort(g) })),
  ]

  const [aKey, setAKey] = useState('')
  const [bKey, setBKey] = useState('')
  const [situation, setSituation] = useState('')
  const [beats, setBeats] = useState<Beat[]>([])
  const [stream, setStream] = useState('')
  const [busy, setBusy] = useState(false)
  const [converting, setConverting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [beats.length, stream])

  useEffect(() => () => abortRef.current?.abort(), [])

  const A = speakers.find((s) => s.key === aKey) ?? null
  const B = speakers.find((s) => s.key === bKey) ?? null
  const ready = A && B && A.key !== B.key && situation.trim()

  const cleanName = (n: string) => n.replace(/^❖\s*/, '')

  const nextBeat = async () => {
    if (!A || !B || busy) return
    const speaker = beats.length % 2 === 0 ? A : B
    const other = speaker === A ? B : A
    setBusy(true)
    setError(null)
    setStream('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const transcript = beats
        .map((b) => `${b.speaker}: ${b.text}`)
        .join('\n\n')
      const text = await streamMessage({
        system: buildStoryContext(project, styleProfile, {
          recentText: tailOfManuscript(project, 3000),
          includeCast: false,
          taskDirective:
            `Two characters are in conversation.\n\nSHEET — ${speaker.sheet}\n\nSHEET — ${other.sheet}\n\n` +
            `You write ONLY ${cleanName(speaker.name)}'s next turn: their spoken words plus brief physical ` +
            'beats in *asterisks*. 40-140 words. Stay ruthlessly in their voice; let them pursue their own ' +
            'agenda, mishear, interrupt, or deflect like real people. Never write the other character\'s ' +
            'words or reactions. Output only the turn.',
        }),
        messages: [
          {
            role: 'user',
            content:
              `SITUATION: ${situation.trim()}\n\n` +
              (transcript ? `CONVERSATION SO FAR:\n${transcript}\n\n` : '') +
              `Write ${cleanName(speaker.name)}'s ${beats.length === 0 ? 'opening' : 'next'} turn now.`,
          },
        ],
        temperature: 0.95,
        maxTokens: 350,
        signal: controller.signal,
        onDelta: (d) => setStream((s) => s + d),
      })
      setBeats((prev) => [...prev, { speaker: cleanName(speaker.name), text: text.trim() }])
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
      setStream('')
      abortRef.current = null
    }
  }

  const saveToNotes = () => {
    if (!beats.length) return
    const block =
      `\n\n## Salon — ${beats[0].speaker} & ${beats[1]?.speaker ?? '…'}, ${new Date().toLocaleString()}\n` +
      `Situation: ${situation.trim()}\n\n` +
      beats.map((b) => `${b.speaker.toUpperCase()}: ${b.text}`).join('\n\n')
    updateProject(project.id, (d) => {
      d.notes += block
    })
    setNotice('Transcript saved to Project Notes.')
  }

  const convert = async () => {
    if (!beats.length || converting) return
    setConverting(true)
    setError(null)
    try {
      const transcript =
        `Situation: ${situation.trim()}\n\n` +
        beats.map((b) => `${b.speaker}: ${b.text}`).join('\n\n')
      const title = await chatToProseScene(project, styleProfile, transcript, 'From the Salon')
      setNotice(`Scene written — new chapter "${title}" added to the manuscript.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="rise-1">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label>First chair</label>
            <select value={aKey} onChange={(e) => { setAKey(e.target.value); setBeats([]) }}>
              <option value="">Choose…</option>
              {speakers.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label>Second chair</label>
            <select value={bKey} onChange={(e) => { setBKey(e.target.value); setBeats([]) }}>
              <option value="">Choose…</option>
              {speakers.filter((s) => s.key !== aKey).map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
            <label>Situation</label>
            <input
              type="text"
              value={situation}
              placeholder="They meet at the shoreline the morning after the storm…"
              onChange={(e) => setSituation(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="pl-room">
        <div className="pl-log" ref={logRef}>
          {beats.length === 0 && !busy && (
            <div className="faint pl-hint" style={{ fontStyle: 'italic' }}>
              Seat two characters, set the scene, and deal the first beat. They'll pursue their
              own agendas — you just watch the chemistry (or the wreckage).
            </div>
          )}
          {beats.map((b, i) => (
            <div key={i} className="pl-turn-char prose-block">
              <span className="tag brass" style={{ marginRight: 8 }}>{b.speaker}</span>
              {b.text}
            </div>
          ))}
          {busy && (
            <div className="pl-turn-char prose-block gen-stream">
              {stream}
              <span className="gen-cursor" />
            </div>
          )}
          <ErrorBanner error={error} />
          {notice && <div className="tag green">✓ {notice}</div>}
        </div>

        <div className="row wrap" style={{ marginTop: 10 }}>
          {busy ? (
            <button className="btn danger" onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button className="btn primary" disabled={!ready} onClick={() => void nextBeat()}>
              ⚭ {beats.length === 0 ? 'Open the scene' : `Next beat (${cleanName((beats.length % 2 === 0 ? A : B)?.name ?? '')})`}
            </button>
          )}
          <button className="btn ghost small" disabled={!beats.length || busy} onClick={() => { setBeats([]); setNotice(null) }}>
            Clear
          </button>
          <span style={{ marginLeft: 'auto' }} className="row">
            <button className="btn small" disabled={!beats.length || busy} onClick={saveToNotes}>
              ⇲ Save to Notes
            </button>
            <button className="btn small" disabled={!beats.length || busy || converting} onClick={() => void convert()}>
              {converting ? (<><span className="spinner" /> Writing…</>) : '✒ Convert to prose scene'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
