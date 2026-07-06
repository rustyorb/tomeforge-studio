import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { CodexEntry, CodexType, Project, StyleProfile } from '../../types'
import { CODEX_TYPES } from '../../types'
import { uid } from '../../lib/id'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { EmptyState, ErrorBanner, Field, StreamView } from '../../components/ui'
import { useStreamTask } from './useStreamTask'

export default function CodexTab(props: { project: Project; styleProfile: StyleProfile | null }) {
  const { project, styleProfile } = props
  const updateProject = useStore((s) => s.updateProject)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CodexType>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return project.codex.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q)) ||
        e.content.toLowerCase().includes(q)
      )
    })
  }, [project.codex, search, typeFilter])

  const selected = project.codex.find((e) => e.id === selectedId) ?? null

  const addEntry = () => {
    const id = uid()
    updateProject(project.id, (d) => {
      d.codex.push({
        id,
        name: 'New Entry',
        type: 'other',
        aliases: [],
        content: '',
        alwaysInclude: false,
        updatedAt: Date.now(),
      })
    })
    setSelectedId(id)
  }

  return (
    <div className="br-split rise">
      <div className="panel">
        <div className="panel-head">
          <span className="kicker">Entries · {project.codex.length}</span>
          <button className="btn small primary" onClick={addEntry}>⊕ New Entry</button>
        </div>
        <div className="panel-body">
          <div className="field">
            <input
              type="text"
              placeholder="Search name, alias, content…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | CodexType)}
            >
              <option value="all">all types</option>
              {CODEX_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="br-list">
            {filtered.map((entry) => (
              <button
                key={entry.id}
                className={`br-list-item ${entry.id === selectedId ? 'br-active' : ''}`}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="br-item-name">
                  {entry.alwaysInclude && <span className="br-pin" title="Always in AI context">◈ </span>}
                  {entry.name || 'Untitled'}
                </span>
                <span className="tag brass">{entry.type}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="faint" style={{ padding: '12px 4px', fontSize: 13 }}>
                {project.codex.length === 0 ? 'No entries yet.' : 'No entries match.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected ? (
        <CodexEditor
          key={selected.id}
          entry={selected}
          project={project}
          styleProfile={styleProfile}
          onDelete={() => {
            updateProject(project.id, (d) => {
              d.codex = d.codex.filter((e) => e.id !== selected.id)
            })
            setSelectedId(null)
          }}
        />
      ) : (
        <EmptyState glyph="✦" title="The Codex">
          Established canon lives here — people, places, rules, secrets. Select an entry to
          edit it, or forge a new one. Entries are injected into the AI context when their
          name or alias appears in recent text.
        </EmptyState>
      )}
    </div>
  )
}

function CodexEditor(props: {
  entry: CodexEntry
  project: Project
  styleProfile: StyleProfile | null
  onDelete: () => void
}) {
  const { entry, project, styleProfile, onDelete } = props
  const updateProject = useStore((s) => s.updateProject)
  const [aliasesRaw, setAliasesRaw] = useState(entry.aliases.join(', '))
  const draft = useStreamTask()

  const edit = (recipe: (e: CodexEntry) => void) =>
    updateProject(project.id, (d) => {
      const target = d.codex.find((e) => e.id === entry.id)
      if (!target) return
      recipe(target)
      target.updatedAt = Date.now()
    })

  const draftWithAI = async () => {
    const seed = entry.content.trim()
    await draft.run({
      system: buildStoryContext(project, styleProfile, {
        recentText: tailOfManuscript(project, 4000),
        taskDirective: `Write a codex entry (120-200 words) for "${entry.name}" (${entry.type}) consistent with all established canon. Output only the entry body.`,
      }),
      messages: [
        {
          role: 'user',
          content: seed
            ? `Existing notes to build on:\n${seed}\n\nWrite the codex entry now.`
            : 'Write the codex entry now.',
        },
      ],
      temperature: 0.7,
      maxTokens: 600,
    })
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="kicker">Edit Entry</span>
        <div className="row">
          {draft.busy ? (
            <button className="btn small" onClick={draft.stop}>■ Stop</button>
          ) : (
            <button className="btn small" onClick={draftWithAI}>✦ Draft with AI</button>
          )}
          <button className="btn small ghost danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div className="panel-body">
        <ErrorBanner error={draft.error} />
        <div className="grid-2">
          <Field label="Name">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => edit((en) => { en.name = e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              value={entry.type}
              onChange={(e) => edit((en) => { en.type = e.target.value as CodexType })}
            >
              {CODEX_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Aliases" hint="Comma-separated. Any of these trigger context injection.">
          <input
            type="text"
            value={aliasesRaw}
            placeholder="The Pale King, His Grace, Aldric"
            onChange={(e) => {
              setAliasesRaw(e.target.value)
              const parsed = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              edit((en) => { en.aliases = parsed })
            }}
          />
        </Field>
        <Field label="Content">
          <textarea
            rows={9}
            value={entry.content}
            onChange={(e) => edit((en) => { en.content = e.target.value })}
          />
        </Field>
        <label className="br-check">
          <input
            type="checkbox"
            checked={entry.alwaysInclude}
            onChange={(e) => edit((en) => { en.alwaysInclude = e.target.checked })}
          />
          Always in AI context (◈ pinned — injected even without a keyword match)
        </label>

        {(draft.busy || draft.text) && (
          <>
            <div className="divider" />
            <div className="kicker" style={{ marginBottom: 8 }}>AI Draft</div>
            <StreamView text={draft.text} busy={draft.busy} />
            {!draft.busy && draft.text && (
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn small primary"
                  onClick={() => {
                    const text = draft.text
                    edit((en) => { en.content = text })
                    draft.setText('')
                  }}
                >
                  ✓ Accept — replace content
                </button>
                <button className="btn small ghost" onClick={() => draft.setText('')}>Discard</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
