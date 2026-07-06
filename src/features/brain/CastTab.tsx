import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { CharacterCard, Project, StyleProfile } from '../../types'
import { uid } from '../../lib/id'
import { streamMessage, extractJsonBlock } from '../../lib/ai'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { EmptyState, ErrorBanner, Field, Modal } from '../../components/ui'
import RelationWeb from './RelationWeb'

const SYNC_KEYS = [
  'location', 'goal', 'secrets', 'injuries', 'relationships',
  'emotionalState', 'arcStage', 'lastAppearance', 'voiceNotes', 'forbidden',
] as const
type SyncKey = (typeof SYNC_KEYS)[number]

const CARD_FIELDS: { key: SyncKey; label: string; textarea?: boolean; hint?: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'goal', label: 'Goal' },
  { key: 'emotionalState', label: 'Emotional State' },
  { key: 'arcStage', label: 'Arc Stage' },
  { key: 'lastAppearance', label: 'Last Appearance' },
  { key: 'injuries', label: 'Injuries' },
  { key: 'secrets', label: 'Secrets', textarea: true },
  { key: 'relationships', label: 'Relationships', textarea: true },
  { key: 'voiceNotes', label: 'Voice Notes', textarea: true },
  { key: 'forbidden', label: 'Forbidden', textarea: true, hint: 'Things this character must never do or say.' },
]

export default function CastTab(props: { project: Project; styleProfile: StyleProfile | null }) {
  const { project, styleProfile } = props
  const updateProject = useStore((s) => s.updateProject)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [view, setView] = useState<'cards' | 'web'>('cards')

  const editing = project.characters.find((c) => c.id === editingId) ?? null

  const addCharacter = () => {
    const id = uid()
    updateProject(project.id, (d) => {
      d.characters.push({
        id,
        name: 'New Character',
        location: '', goal: '', secrets: '', injuries: '', relationships: '',
        emotionalState: '', arcStage: '', lastAppearance: '', voiceNotes: '', forbidden: '',
      })
    })
    setEditingId(id)
  }

  const syncFromManuscript = async (card: CharacterCard) => {
    setSyncingId(card.id)
    setSyncError(null)
    try {
      const currentState = Object.fromEntries(SYNC_KEYS.map((k) => [k, card[k]]))
      const full = await streamMessage({
        system: buildStoryContext(project, styleProfile, {
          recentText: tailOfManuscript(project, 8000),
          includeCast: false,
          taskDirective:
            `Update the character state card for "${card.name}" from the recent manuscript. ` +
            'Return ONLY a fenced ```json object with exactly these keys: ' +
            SYNC_KEYS.join(', ') +
            '. Every value must be a short string. Keep a field\'s current value unchanged when the manuscript shows no change. No prose outside the JSON block.',
        }),
        messages: [
          {
            role: 'user',
            content:
              `CURRENT CARD for ${card.name}:\n${JSON.stringify(currentState, null, 2)}\n\n` +
              `RECENT MANUSCRIPT:\n${tailOfManuscript(project, 8000) || '(manuscript is empty)'}\n\n` +
              'Return the updated JSON now.',
          },
        ],
        temperature: 0.2,
        maxTokens: 800,
      })
      const parsed = extractJsonBlock(full)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setSyncError(`Could not parse the AI response for "${card.name}" — no valid JSON block found. Try again.`)
        return
      }
      const obj = parsed as Record<string, unknown>
      updateProject(project.id, (d) => {
        const target = d.characters.find((c) => c.id === card.id)
        if (!target) return
        for (const key of SYNC_KEYS) {
          const value = obj[key]
          if (typeof value === 'string') target[key] = value
        }
      })
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <div className="rise">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="kicker">Cast · {project.characters.length}</span>
          <div className="br-viewtoggle">
            <button
              className={view === 'cards' ? 'br-active' : ''}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
            <button
              className={view === 'web' ? 'br-active' : ''}
              onClick={() => setView('web')}
            >
              Web
            </button>
          </div>
        </div>
        <button className="btn primary" onClick={addCharacter}>⊕ New Character</button>
      </div>

      <ErrorBanner error={syncError} />

      {view === 'web' ? (
        <RelationWeb project={project} styleProfile={styleProfile} />
      ) : project.characters.length === 0 ? (
        <EmptyState glyph="❦" title="No characters yet">
          The Cast Ledger tracks each character's live state — where they are, what they
          want, what they hide. Forge your first character above.
        </EmptyState>
      ) : (
        <div className="grid-cards">
          {project.characters.map((c) => (
            <div key={c.id} className="card interactive" onClick={() => setEditingId(c.id)}>
              <h3 style={{ marginBottom: 8 }}>{c.name || 'Unnamed'}</h3>
              <div className="stack" style={{ gap: 4 }}>
                <div className="br-snippet">
                  <span className="br-snippet-key">Feeling</span>
                  {c.emotionalState || '—'}
                </div>
                <div className="br-snippet">
                  <span className="br-snippet-key">At</span>
                  {c.location || '—'}
                </div>
                <div className="br-snippet">
                  <span className="br-snippet-key">Goal</span>
                  {c.goal || '—'}
                </div>
              </div>
              <div className="divider" style={{ margin: '12px 0' }} />
              <div className="row between">
                <button
                  className="btn small"
                  disabled={syncingId !== null}
                  onClick={(e) => {
                    e.stopPropagation()
                    void syncFromManuscript(c)
                  }}
                >
                  {syncingId === c.id ? <span className="spinner" /> : '⟳'} Sync from Manuscript
                </button>
                {c.injuries && <span className="tag red" title={c.injuries}>injured</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.name || 'Character'} onClose={() => setEditingId(null)}>
          <Field label="Name">
            <input
              type="text"
              value={editing.name}
              onChange={(e) =>
                updateProject(project.id, (d) => {
                  const t = d.characters.find((c) => c.id === editing.id)
                  if (t) t.name = e.target.value
                })
              }
            />
          </Field>
          {CARD_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {f.textarea ? (
                <textarea
                  rows={3}
                  value={editing[f.key]}
                  onChange={(e) =>
                    updateProject(project.id, (d) => {
                      const t = d.characters.find((c) => c.id === editing.id)
                      if (t) t[f.key] = e.target.value
                    })
                  }
                />
              ) : (
                <input
                  type="text"
                  value={editing[f.key]}
                  onChange={(e) =>
                    updateProject(project.id, (d) => {
                      const t = d.characters.find((c) => c.id === editing.id)
                      if (t) t[f.key] = e.target.value
                    })
                  }
                />
              )}
            </Field>
          ))}
          <div className="row between" style={{ marginTop: 6 }}>
            <button
              className="btn ghost danger"
              onClick={() => {
                updateProject(project.id, (d) => {
                  d.characters = d.characters.filter((c) => c.id !== editing.id)
                })
                setEditingId(null)
              }}
            >
              Delete Character
            </button>
            <button className="btn" onClick={() => setEditingId(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
