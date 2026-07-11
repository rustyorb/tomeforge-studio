import { useEffect, useRef, useState } from 'react'
import { useActiveProject, useProjectStyle, useStore } from '../../store/useStore'
import type { CharacterCard, STCardStored } from '../../types'
import { streamMessage } from '../../lib/ai'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { EmptyState, ErrorBanner } from '../../components/ui'
import './parlor.css'

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

function guestSheet(g: STCardStored): string {
  const bits = [
    g.description && `About them: ${g.description}`,
    g.personality && `Personality: ${g.personality}`,
    g.scenario && `Their usual scenario: ${g.scenario}`,
    g.mesExample && `How they speak (examples): ${g.mesExample.slice(0, 600)}`,
  ].filter(Boolean)
  return `GUEST SHEET — ${g.name}\n${bits.join('\n')}`
}

function characterSheet(c: CharacterCard): string {
  const bits = [
    c.location && `Current location: ${c.location}`,
    c.goal && `Current goal: ${c.goal}`,
    c.emotionalState && `Emotional state: ${c.emotionalState}`,
    c.injuries && `Injuries: ${c.injuries}`,
    c.relationships && `Relationships: ${c.relationships}`,
    c.secrets && `Secrets they carry (they may guard these): ${c.secrets}`,
    c.arcStage && `Arc stage: ${c.arcStage}`,
    c.voiceNotes && `Voice: ${c.voiceNotes}`,
    c.forbidden && `They would NEVER: ${c.forbidden}`,
  ].filter(Boolean)
  return `CHARACTER SHEET — ${c.name}\n${bits.join('\n')}`
}

export default function ParlorPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)
  const stLibrary = useStore((s) => s.stLibrary ?? [])
  const guests = stLibrary.filter((x): x is STCardStored => x.kind === 'card')

  const [charId, setCharId] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, stream])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!project) {
    return (
      <div className="page">
        <EmptyState glyph="❝" title="No tome open">
          The Parlor needs a story — open a project from the Archive first.
        </EmptyState>
      </div>
    )
  }

  const character = project.characters.find((c) => c.id === charId) ?? null
  const guest = guests.find((g) => g.id === guestId) ?? null
  const speaker = character ?? guest

  const pick = (kind: 'cast' | 'guest', id: string) => {
    abortRef.current?.abort()
    setCharId(kind === 'cast' ? id : null)
    setGuestId(kind === 'guest' ? id : null)
    setTurns([])
    setStream('')
    setError(null)
  }

  const send = async () => {
    if (!speaker || busy) return
    const text = input.trim()
    if (!text) return
    const history = [...turns, { role: 'user' as const, text }]
    setTurns(history)
    setInput('')
    setBusy(true)
    setError(null)
    setStream('')
    const controller = new AbortController()
    abortRef.current = controller

    const sheet = character ? characterSheet(character) : guestSheet(guest!)
    const framing = character
      ? `You ARE ${speaker.name}, sitting across from the author in a quiet parlor outside the story. ` +
        'You know only what the character knows at this point in the story — guard your secrets unless skillfully drawn out; ' +
        'never reveal facts the character has no way of knowing.'
      : `You ARE ${speaker.name}, a guest visiting the author's parlor from outside this story. ` +
        'You do NOT know this manuscript\'s events unless the author tells you — react to them fresh, fully in your own character.'

    try {
      const full = await streamMessage({
        system: buildStoryContext(project, styleProfile, {
          recentText: tailOfManuscript(project, 5000),
          includeCast: false,
          taskDirective:
            `${sheet}\n\n${framing} ` +
            'Speak only as this character, first person, in their exact voice. Physical beats in *asterisks*. ' +
            'Stay in character absolutely: no AI talk, no meta-commentary. ' +
            'Answers are conversational — usually 1-2 paragraphs, longer only when the question deserves it.',
        }),
        messages: history.map((t) => ({ role: t.role, content: t.text })),
        temperature: 0.9,
        maxTokens: 600,
        signal: controller.signal,
        onDelta: (d) => setStream((s) => s + d),
      })
      setTurns((prev) => [...prev, { role: 'assistant', text: full }])
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

  const saveTranscript = () => {
    if (!speaker || !turns.length) return
    const block =
      `\n\n## Parlor — ${speaker.name}, ${new Date().toLocaleString()}\n` +
      turns.map((t) => `${t.role === 'user' ? 'AUTHOR' : speaker.name.toUpperCase()}: ${t.text}`).join('\n\n')
    useStore.getState().updateProject(project.id, (d) => {
      d.notes += block
    })
  }

  const nobodyToSeat = project.characters.length === 0 && guests.length === 0

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Parlor</div>
        <h1>Talk to your characters</h1>
        <p className="sub">
          Pull up a chair with anyone from the Cast Ledger — they answer in their own voice,
          know only what they know, and guard their secrets. SillyTavern library cards can
          visit too. Conversations are off the record (session only) unless you save the transcript.
        </p>
      </header>

      {nobodyToSeat ? (
        <EmptyState glyph="☙" title="The parlor is empty">
          Add characters to the Cast Ledger (Story Brain → Cast Ledger) or import some into the
          SillyTavern library, and they'll take a seat here.
        </EmptyState>
      ) : (
        <div className="pl-layout rise-1">
          <aside className="pl-cast">
            {project.characters.length > 0 && (
              <>
                <div className="kicker" style={{ marginBottom: 8 }}>From this tome</div>
                {project.characters.map((c) => (
                  <button
                    key={c.id}
                    className={`pl-seat ${c.id === charId ? 'active' : ''}`}
                    onClick={() => pick('cast', c.id)}
                  >
                    <span className="pl-seat-name">{c.name}</span>
                    {c.emotionalState && <span className="pl-seat-mood">{c.emotionalState}</span>}
                  </button>
                ))}
              </>
            )}
            {guests.length > 0 && (
              <>
                <div className="kicker" style={{ margin: '10px 0 8px' }}>Library guests</div>
                {guests.map((g) => (
                  <button
                    key={g.id}
                    className={`pl-seat ${g.id === guestId ? 'active' : ''}`}
                    onClick={() => pick('guest', g.id)}
                  >
                    <span className="pl-seat-name">❖ {g.name}</span>
                    {g.tags.length > 0 && <span className="pl-seat-mood">{g.tags.slice(0, 3).join(', ')}</span>}
                  </button>
                ))}
              </>
            )}
          </aside>

          <section className="pl-room">
            {!speaker ? (
              <EmptyState glyph="❝" title="Choose a character">
                Pick someone from the cast — or a library guest — to begin the conversation.
              </EmptyState>
            ) : (
              <>
                <div className="pl-log" ref={logRef}>
                  {turns.length === 0 && !busy && (
                    <div className="pl-hint">
                      <div className="faint" style={{ fontStyle: 'italic', marginBottom: 12 }}>
                        *{speaker.name} settles into the chair across from you.*
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {[
                          'What do you want more than anything?',
                          'What are you not telling me?',
                          'What do you make of the others?',
                          'Where does it hurt?',
                        ].map((q) => (
                          <button key={q} className="btn ghost small" onClick={() => setInput(q)}>
                            ❝ {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {turns.map((t, i) =>
                    t.role === 'user' ? (
                      <div key={i} className="pl-turn-author">
                        <span className="tag brass">you</span> {t.text}
                      </div>
                    ) : (
                      <div key={i} className="pl-turn-char prose-block">{t.text}</div>
                    ),
                  )}
                  {busy && (
                    <div className="pl-turn-char prose-block gen-stream">
                      {stream}
                      <span className="gen-cursor" />
                    </div>
                  )}
                  <ErrorBanner error={error} />
                </div>

                <div className="pl-bar">
                  <input
                    type="text"
                    value={input}
                    disabled={busy}
                    placeholder={`Say something to ${speaker.name}…`}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void send()
                    }}
                  />
                  {busy ? (
                    <button className="btn danger" onClick={() => abortRef.current?.abort()}>Stop</button>
                  ) : (
                    <button className="btn primary" disabled={!input.trim()} onClick={() => void send()}>
                      Speak
                    </button>
                  )}
                </div>

                <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                  <button
                    className="btn ghost small"
                    disabled={!turns.length}
                    onClick={() => {
                      setTurns([])
                      setError(null)
                    }}
                  >
                    Clear conversation
                  </button>
                  <button className="btn small" disabled={!turns.length} onClick={saveTranscript}>
                    ⇲ Save transcript to Project Notes
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
