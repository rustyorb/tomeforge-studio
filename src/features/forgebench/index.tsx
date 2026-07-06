import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useActiveProject, useProjectStyle } from '../../store/useStore'
import { streamMessage } from '../../lib/ai'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { uid } from '../../lib/id'
import { CODEX_TYPES } from '../../types'
import type { CodexType } from '../../types'
import {
  CopyButton, EmptyState, ErrorBanner, Field, Modal, StreamView, Tabs,
} from '../../components/ui'
import type { ForgeTool, ToolCategory } from './tools'
import { FORGE_TOOLS, TOOL_CATEGORIES } from './tools'
import './forgebench.css'

/** Initial field values for a tool: selects default to their first option. */
function initialValues(tool: ForgeTool): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of tool.fields) {
    values[f.id] = f.type === 'select' ? (f.options?.[0] ?? '') : ''
  }
  return values
}

export default function ForgebenchPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)
  const updateProject = useStore((s) => s.updateProject)

  const [category, setCategory] = useState<ToolCategory>('idea')
  const [search, setSearch] = useState('')
  const [toolId, setToolId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesSaved, setNotesSaved] = useState(false)

  const [codexOpen, setCodexOpen] = useState(false)
  const [codexName, setCodexName] = useState('')
  const [codexType, setCodexType] = useState<CodexType>('other')
  const [codexContent, setCodexContent] = useState('')
  const [codexSaved, setCodexSaved] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const runnerRef = useRef<HTMLDivElement | null>(null)

  const tool = useMemo(
    () => FORGE_TOOLS.find((t) => t.id === toolId) ?? null,
    [toolId],
  )

  // Deep-link contract: the command palette opens a tool via sessionStorage
  // 'tf-open-tool' (page not yet mounted) or a 'tf-open-tool' window event.
  useEffect(() => {
    const open = (id: string | null) => {
      const t = FORGE_TOOLS.find((x) => x.id === id)
      if (!t) return
      setCategory(t.category)
      setToolId(t.id)
      setValues(initialValues(t))
      setOutput('')
      setError(null)
      setSearch('')
    }
    const stored = sessionStorage.getItem('tf-open-tool')
    if (stored) {
      sessionStorage.removeItem('tf-open-tool')
      open(stored)
    }
    const onEvent = (e: Event) => {
      // Consume the storage copy too — dispatchers write both, and a stale
      // key would replay the old deep link on the next mount.
      sessionStorage.removeItem('tf-open-tool')
      open((e as CustomEvent<string>).detail)
    }
    window.addEventListener('tf-open-tool', onEvent)
    return () => window.removeEventListener('tf-open-tool', onEvent)
  }, [])

  const visibleTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q) {
      return FORGE_TOOLS.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.includes(q),
      )
    }
    return FORGE_TOOLS.filter((t) => t.category === category)
  }, [search, category])

  if (!project) {
    return (
      <div className="page">
        <header className="page-header rise">
          <div className="kicker">The Workshop</div>
          <h1>Forgebench</h1>
        </header>
        <EmptyState glyph="⚒" title="No tome on the anvil">
          Open a project from the Archive to put the forge tools to work.
        </EmptyState>
      </div>
    )
  }

  const selectTool = (t: ForgeTool) => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setToolId(t.id)
    setValues(initialValues(t))
    setOutput('')
    setError(null)
    setNotesSaved(false)
    setCodexSaved(false)
    setTimeout(() => runnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }

  const generate = async (t: ForgeTool) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(true)
    setError(null)
    setOutput('')
    setNotesSaved(false)
    setCodexSaved(false)
    try {
      const system = buildStoryContext(project, styleProfile, {
        recentText: tailOfManuscript(project),
        taskDirective: t.buildDirective(values),
      })
      const parts: string[] = []
      for (const f of t.fields) {
        const v = (values[f.id] ?? '').trim()
        if (v) parts.push(`${f.label.toUpperCase()}:\n${v}`)
      }
      if (t.projectPayload) parts.push(t.projectPayload(project))
      const user = parts.length ? parts.join('\n\n') : 'Proceed with the task as directed.'

      let acc = ''
      const full = await streamMessage({
        system,
        messages: [{ role: 'user', content: user }],
        temperature: t.temperature,
        signal: ctrl.signal,
        onDelta: (text) => {
          acc += text
          setOutput(acc)
        },
      })
      setOutput(full)
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') {
        setError(
          err.name === 'AIKeyMissingError'
            ? `${err.message} Open Settings to add one.`
            : err.message,
        )
      }
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  const appendToNotes = (t: ForgeTool) => {
    updateProject(project.id, (draft) => {
      draft.notes += `\n\n## ${t.name} — ${new Date().toLocaleString()}\n${output}`
    })
    setNotesSaved(true)
  }

  const openCodexForm = (t: ForgeTool) => {
    setCodexName('')
    setCodexType(t.codexType ?? 'other')
    setCodexContent(output)
    setCodexSaved(false)
    setCodexOpen(true)
  }

  const saveCodexEntry = () => {
    updateProject(project.id, (draft) => {
      draft.codex.push({
        id: uid(),
        name: codexName.trim(),
        type: codexType,
        aliases: [],
        content: codexContent,
        alwaysInclude: false,
        updatedAt: Date.now(),
      })
    })
    setCodexOpen(false)
    setCodexSaved(true)
  }

  const done = !busy && output.length > 0

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Workshop</div>
        <h1>Forgebench</h1>
        <p className="sub">
          A wall of implements for every stage of the craft — sparks, skeletons, souls,
          voices, worlds, whetstones, and wax seals. Every tool works inside the Story
          Brain of <span className="ember-text">{project.name}</span>.
        </p>
      </header>

      <div className="fb-toolbar rise-1">
        <input
          type="text"
          className="fb-search"
          placeholder="Search all tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="fb-count">
          {visibleTools.length} tool{visibleTools.length === 1 ? '' : 's'}
          {search.trim() ? ' found' : ''}
        </span>
      </div>

      {!search.trim() && (
        <Tabs
          tabs={TOOL_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
          active={category}
          onSelect={(id) => setCategory(id as ToolCategory)}
        />
      )}

      {visibleTools.length === 0 ? (
        <EmptyState glyph="⌕" title="No tools match">
          Try a different word — or clear the search to browse by category.
        </EmptyState>
      ) : (
        <div className="fb-grid rise-1">
          {visibleTools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`fb-tool-card ${t.id === toolId ? 'active' : ''}`}
              onClick={() => selectTool(t)}
            >
              <span className="fb-glyph">{t.glyph}</span>
              <span className="fb-tool-name">{t.name}</span>
              <span className="fb-tool-desc">{t.description}</span>
              <span className="fb-tool-cat">{t.category}</span>
            </button>
          ))}
        </div>
      )}

      {tool && (
        <div className="panel fb-runner rise" ref={runnerRef}>
          <div className="panel-head">
            <div className="row">
              <span className="fb-runner-glyph">{tool.glyph}</span>
              <div className="fb-runner-title">
                <h2>{tool.name}</h2>
                <div className="fb-tool-desc">{tool.description}</div>
              </div>
            </div>
            <span className="tag brass">{tool.category}</span>
          </div>
          <div className="panel-body">
            <div className="fb-fields">
              {tool.fields.map((f) => (
                <Field key={f.id} label={f.label}>
                  {f.type === 'text' && (
                    <input
                      type="text"
                      value={values[f.id] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    />
                  )}
                  {f.type === 'textarea' && (
                    <>
                      <textarea
                        value={values[f.id] ?? ''}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      />
                      {f.useCurrentScene && (
                        <div className="fb-fill-row">
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() =>
                              setValues((v) => ({ ...v, [f.id]: tailOfManuscript(project, 4000) }))
                            }
                          >
                            ⤓ use manuscript tail
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {f.type === 'select' && (
                    <select
                      value={values[f.id] ?? f.options?.[0] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    >
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
            </div>

            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn primary" disabled={busy} onClick={() => generate(tool)}>
                {busy ? <span className="spinner" /> : '⚒'} {busy ? 'Forging…' : 'Generate'}
              </button>
              {busy && (
                <button className="btn danger" onClick={stop}>
                  ◼ Stop
                </button>
              )}
            </div>

            <ErrorBanner error={error} />

            {(output || busy) && <div className="divider" />}
            {busy && <StreamView text={output} busy={busy} />}
            {done && <div className="prose-block">{output}</div>}

            {done && (
              <div className="fb-output-actions">
                <CopyButton text={output} />
                <button className="btn small" disabled={notesSaved} onClick={() => appendToNotes(tool)}>
                  {notesSaved ? '✓ Appended' : '→ Append to Project Notes'}
                </button>
                {tool.category === 'world' && (
                  <button className="btn small" onClick={() => openCodexForm(tool)}>
                    → Save to Codex
                  </button>
                )}
                {codexSaved && <span className="fb-saved-note">✓ saved to codex</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {codexOpen && (
        <Modal title="Save to Codex" onClose={() => setCodexOpen(false)}>
          <Field label="Entry name">
            <input
              type="text"
              value={codexName}
              autoFocus
              placeholder="The name this entry is known by"
              onChange={(e) => setCodexName(e.target.value)}
            />
          </Field>
          <Field label="Type">
            <select value={codexType} onChange={(e) => setCodexType(e.target.value as CodexType)}>
              {CODEX_TYPES.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </Field>
          <Field label="Content">
            <textarea
              value={codexContent}
              style={{ minHeight: 160 }}
              onChange={(e) => setCodexContent(e.target.value)}
            />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={!codexName.trim()} onClick={saveCodexEntry}>
              Seal It Into Canon
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
