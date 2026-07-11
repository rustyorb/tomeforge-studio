import { useRef, useState } from 'react'
import type { Project } from '../../types'
import { useStore } from '../../store/useStore'
import { uid } from '../../lib/id'
import { ErrorBanner } from '../../components/ui'
import { parseManuscript } from '../../lib/import/manuscript'
import type { ParsedManuscript } from '../../lib/import/manuscript'

/**
 * Import an existing manuscript (.txt / .md) — split into chapters on
 * headings and scenes on *** breaks, then land it as a new tome or append
 * to an existing one.
 */
export default function ManuscriptImport(props: { project: Project | null }) {
  const { projects, updateProject } = useStore()
  const [parsed, setParsed] = useState<ParsedManuscript | null>(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState<'new' | 'append'>('new')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    setError(null)
    setDone(null)
    setParsed(null)
    if (!file) return
    try {
      const text = await file.text()
      if (!text.trim()) throw new Error('The file is empty.')
      setFileName(file.name)
      setParsed(parseManuscript(text, file.name.replace(/\.(txt|md|markdown)$/i, '')))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const reset = () => {
    setParsed(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const apply = () => {
    if (!parsed) return
    const chapters = parsed.chapters.map((ch) => ({
      id: uid(),
      title: ch.title,
      scenes: ch.scenes.map((sc) => ({ id: uid(), title: sc.title, content: sc.content })),
    }))
    if (mode === 'new') {
      const name = parsed.title || fileName.replace(/\.(txt|md|markdown)$/i, '') || 'Imported Manuscript'
      const now = Date.now()
      useStore.setState((s) => ({
        projects: [
          ...s.projects,
          {
            id: uid(),
            name,
            genre: '',
            logline: '',
            createdAt: now,
            updatedAt: now,
            chapters,
            memory: '',
            authorNote: '',
            canonMode: 'guided' as const,
            codex: [],
            characters: [],
            threads: [],
            timeline: [],
            notes: '',
            styleProfileId: null,
            presetId: 'clean-continuation',
            quest: null,
            branches: [],
            wordLog: {},
            wordLogStart: parsed.words,
          },
        ],
      }))
      setDone(`Forged "${name}" — ${chapters.length} chapters, ${parsed.words.toLocaleString()} words. Tip: run the Story Brain's Discover buttons next.`)
    } else {
      if (!props.project) return
      updateProject(props.project.id, (d) => {
        d.chapters.push(...chapters)
      })
      setDone(`Appended ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} to "${props.project.name}".`)
    }
    reset()
  }

  return (
    <section style={{ marginTop: 28 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Manuscript In</div>
      <div className="card">
        <div className="row between wrap">
          <div>
            <h3 style={{ fontSize: 15 }}>Import an existing manuscript</h3>
            <p className="muted ex-desc" style={{ maxWidth: 540 }}>
              Bring work written elsewhere: .txt or .md. Chapters split on headings
              (# Markdown, "Chapter 3", "Prologue"…), scenes split on *** breaks. You'll see
              the shape before anything is written.
            </p>
          </div>
          <span className="tag brass">.txt / .md</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <ErrorBanner error={error} />
        {done && <div className="ex-success">✓ {done}</div>}

        {parsed && (
          <div style={{ marginTop: 14 }}>
            <div className="row wrap" style={{ gap: 14, marginBottom: 10 }}>
              <span className="tag green">
                {parsed.chapters.length} chapter{parsed.chapters.length === 1 ? '' : 's'} ·{' '}
                {parsed.chapters.reduce((n, c) => n + c.scenes.length, 0)} scenes ·{' '}
                {parsed.words.toLocaleString()} words
              </span>
              {parsed.title && <span className="tag brass">title: {parsed.title}</span>}
            </div>
            <div className="ex-preview-list" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {parsed.chapters.slice(0, 20).map((ch, i) => (
                <div key={i} className="ex-preview-row">
                  <span>{ch.title}</span>
                  <span className="mono faint">{ch.scenes.length} scene{ch.scenes.length === 1 ? '' : 's'}</span>
                </div>
              ))}
              {parsed.chapters.length > 20 && (
                <div className="faint" style={{ fontSize: 12 }}>+{parsed.chapters.length - 20} more…</div>
              )}
            </div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                <input
                  type="radio"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  style={{ width: 'auto' }}
                />
                Forge as a new tome
              </label>
              <label
                className="row"
                style={{ gap: 6, cursor: 'pointer', fontSize: 13.5, opacity: props.project ? 1 : 0.5 }}
              >
                <input
                  type="radio"
                  checked={mode === 'append'}
                  disabled={!props.project}
                  onChange={() => setMode('append')}
                  style={{ width: 'auto' }}
                />
                Append to "{props.project?.name ?? '—'}"
              </label>
              <span style={{ marginLeft: 'auto' }} className="row">
                <button className="btn ghost small" onClick={reset}>Cancel</button>
                <button className="btn primary" onClick={apply}>Import</button>
              </span>
            </div>
          </div>
        )}
        {projects.length === 0 && !parsed && (
          <p className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
            No tomes yet — the import will create your first one.
          </p>
        )}
      </div>
    </section>
  )
}
