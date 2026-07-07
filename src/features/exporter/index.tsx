import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { EmptyState, ErrorBanner, Field } from '../../components/ui'
import { downloadBlob, downloadText, slugify } from '../../lib/export/download'
import {
  countWords,
  projectToMarkdown,
  projectToText,
  projectWordCount,
  storyBibleToMarkdown,
} from '../../lib/export/markdown'
import { projectToHtml } from '../../lib/export/html'
import { projectToRtf } from '../../lib/export/rtf'
import { projectToEpub } from '../../lib/export/epub'
import { fullBackup, parseBackup, projectBackup } from '../../lib/export/backup'
import type { BackupPayload } from '../../lib/export/backup'
import type { Project } from '../../types'
import './exporter.css'

/** YYYYMMDD stamp for backup filenames. */
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

/** Replace collided ids, append new ones, never drop existing items. */
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  // Map dedupes incoming ids too (last wins), so a backup that repeats an id
  // can't insert two items with the same id.
  const incomingById = new Map(incoming.map((item) => [item.id, item]))
  const existingIds = new Set(existing.map((item) => item.id))
  const merged = existing.map((item) => incomingById.get(item.id) ?? item)
  for (const [id, item] of incomingById) {
    if (!existingIds.has(id)) merged.push(item)
  }
  return merged
}

/** Word count that tolerates imported data with odd scene content. */
function importedWordCount(project: Project): number {
  return project.chapters.reduce(
    (sum, ch) =>
      sum +
      ch.scenes.reduce(
        (s, sc) => s + (typeof sc.content === 'string' ? countWords(sc.content) : 0),
        0,
      ),
    0,
  )
}

function ExportCard(props: {
  title: string
  ext: string
  desc: string
  busy?: boolean
  onDownload: () => void
}) {
  return (
    <div className="card ex-card">
      <div className="row between">
        <h3 style={{ fontSize: 15 }}>{props.title}</h3>
        <span className="tag brass">{props.ext}</span>
      </div>
      <p className="muted ex-desc">{props.desc}</p>
      <button className="btn primary small" disabled={props.busy} onClick={props.onDownload}>
        {props.busy ? (
          <>
            <span className="spinner" /> Binding…
          </>
        ) : (
          'Download'
        )}
      </button>
    </div>
  )
}

export default function ExporterPage() {
  const { projects, styleProfiles, activeProjectId } = useStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [author, setAuthor] = useState('')
  const [epubBusy, setEpubBusy] = useState(false)
  const [epubError, setEpubError] = useState<string | null>(null)

  const [importPreview, setImportPreview] = useState<BackupPayload | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project =
    projects.find((p) => p.id === selectedId) ??
    projects.find((p) => p.id === activeProjectId) ??
    projects[0] ??
    null
  const words = project ? projectWordCount(project) : 0
  const slug = project ? slugify(project.name) : 'untitled'
  const styleProfile = project
    ? styleProfiles.find((sp) => sp.id === project.styleProfileId) ?? null
    : null

  const doEpub = async () => {
    if (!project) return
    setEpubBusy(true)
    setEpubError(null)
    try {
      const blob = await projectToEpub(project, { author })
      downloadBlob(`${slug}.epub`, blob)
    } catch (e) {
      setEpubError(e instanceof Error ? e.message : String(e))
    } finally {
      setEpubBusy(false)
    }
  }

  const onImportFile = async (file: File | undefined) => {
    setImportError(null)
    setImportDone(null)
    setImportPreview(null)
    if (!file) return
    try {
      setImportPreview(parseBackup(await file.text()))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    }
  }

  const applyImport = () => {
    if (!importPreview) return
    const incoming = importPreview
    useStore.setState((s) => ({
      projects: mergeById(s.projects, incoming.projects),
      styleProfiles: mergeById(s.styleProfiles, incoming.styleProfiles),
    }))
    setImportPreview(null)
    setImportDone(
      `Imported ${incoming.projects.length} project${incoming.projects.length === 1 ? '' : 's'}` +
        ` and ${incoming.styleProfiles.length} style profile${incoming.styleProfiles.length === 1 ? '' : 's'}.`,
    )
    if (fileRef.current) fileRef.current.value = ''
  }

  const existingProjectIds = new Set(projects.map((p) => p.id))
  const existingProfileIds = new Set(styleProfiles.map((sp) => sp.id))

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Bindery</div>
        <h1>Import &amp; Export</h1>
        <p className="sub">
          Bind your manuscript into an e-book, a printable page, or plain files — and keep the
          whole forge safe with portable JSON backups that restore on any machine.
        </p>
      </header>

      {/* ---------- Bound Editions ---------- */}
      <section className="rise-1" style={{ marginBottom: 30 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Bound Editions</div>
        {projects.length === 0 ? (
          <EmptyState glyph="📕" title="Nothing to bind yet">
            Forge a project first — then return here to press it into a book.
          </EmptyState>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ex-controls">
                <Field label="Tome">
                  <select
                    value={project?.id ?? ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Author name" hint="Printed on the title page and in e-book metadata.">
                  <input
                    type="text"
                    value={author}
                    placeholder="Your pen name…"
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </Field>
              </div>
              {project && (
                <div className="mono faint">
                  {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'} ·{' '}
                  {words.toLocaleString()} words
                </div>
              )}
            </div>

            <ErrorBanner error={epubError} />

            {project && (
              <div className="grid-cards">
                <ExportCard
                  title="EPUB"
                  ext=".epub"
                  desc="A real e-book for Kindle, Kobo, Apple Books, or Calibre."
                  busy={epubBusy}
                  onDownload={doEpub}
                />
                <ExportCard
                  title="Book HTML"
                  ext=".html"
                  desc="A single styled page — read it anywhere, print it as a book."
                  onDownload={() =>
                    downloadText(`${slug}.html`, projectToHtml(project, { author }), 'text/html')
                  }
                />
                <ExportCard
                  title="Markdown"
                  ext=".md"
                  desc="Portable prose with chapter headings and scene breaks."
                  onDownload={() =>
                    downloadText(
                      `${slug}.md`,
                      projectToMarkdown(project, { author, includeSynopsis: false }),
                      'text/markdown',
                    )
                  }
                />
                <ExportCard
                  title="Plain Text"
                  ext=".txt"
                  desc="Just the words, nothing else. Pastes cleanly anywhere."
                  onDownload={() =>
                    downloadText(`${slug}.txt`, projectToText(project), 'text/plain')
                  }
                />
                <ExportCard
                  title="Word / RTF"
                  ext=".rtf"
                  desc="Rich Text — opens directly in Word, LibreOffice, and Google Docs."
                  onDownload={() =>
                    downloadText(`${slug}.rtf`, projectToRtf(project, { author }), 'application/rtf')
                  }
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------- Story Bible ---------- */}
      <section className="rise-2" style={{ marginBottom: 30 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Story Bible</div>
        {project ? (
          <div className="grid-cards">
            <div className="card ex-card">
              <div className="row between">
                <h3 style={{ fontSize: 15 }}>Complete Story Bible</h3>
                <span className="tag brass">.md</span>
              </div>
              <p className="muted ex-desc">
                Continuity core, director&#39;s note, codex, cast ledger, threadmap, chronicle,
                notes, and the assigned style profile — one Markdown dossier.
              </p>
              <button
                className="btn primary small"
                onClick={() =>
                  downloadText(
                    `${slug}-story-bible.md`,
                    storyBibleToMarkdown(project, styleProfile),
                    'text/markdown',
                  )
                }
              >
                Download
              </button>
            </div>
          </div>
        ) : (
          <EmptyState glyph="⁂" title="No tome selected">
            The Story Bible compiles everything a tome remembers.
          </EmptyState>
        )}
      </section>

      {/* ---------- The Vault ---------- */}
      <section className="rise-3">
        <div className="kicker" style={{ marginBottom: 10 }}>The Vault</div>
        <div className="grid-cards">
          <div className="card ex-card">
            <div className="row between">
              <h3 style={{ fontSize: 15 }}>Full Backup</h3>
              <span className="tag brass">.json</span>
            </div>
            <p className="muted ex-desc">
              Every project and style profile ({projects.length} tome
              {projects.length === 1 ? '' : 's'}, {styleProfiles.length} profile
              {styleProfiles.length === 1 ? '' : 's'}) in one restorable file.
            </p>
            <button
              className="btn primary small"
              onClick={() =>
                downloadText(
                  `tomeforge-backup-${dateStamp()}.json`,
                  fullBackup(projects, styleProfiles),
                  'application/json',
                )
              }
            >
              Download
            </button>
          </div>

          <div className="card ex-card">
            <div className="row between">
              <h3 style={{ fontSize: 15 }}>Single Tome Backup</h3>
              <span className="tag brass">.json</span>
            </div>
            <p className="muted ex-desc">
              {project
                ? `Just "${project.name}" — hand a single story to another machine.`
                : 'Select a tome above to back it up on its own.'}
            </p>
            <button
              className="btn primary small"
              disabled={!project}
              onClick={() =>
                project &&
                downloadText(
                  `${slug}-backup-${dateStamp()}.json`,
                  projectBackup(project),
                  'application/json',
                )
              }
            >
              Download
            </button>
          </div>

          <div className="card ex-card">
            <div className="row between">
              <h3 style={{ fontSize: 15 }}>Import Backup</h3>
              <span className="tag">restore</span>
            </div>
            <p className="muted ex-desc">
              Load a TomeForge backup file. You&#39;ll see exactly what it contains before
              anything is written.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void onImportFile(e.target.files?.[0])}
            />
            {importDone && <div className="ex-success">✓ {importDone}</div>}
          </div>
        </div>

        <ErrorBanner error={importError} />

        {importPreview && (
          <div className="card ex-preview" style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Ready to import</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              {importPreview.projects.length} project
              {importPreview.projects.length === 1 ? '' : 's'} ·{' '}
              {importPreview.styleProfiles.length} style profile
              {importPreview.styleProfiles.length === 1 ? '' : 's'}. Existing tomes not listed
              here are untouched.
            </p>

            {importPreview.projects.length > 0 && (
              <div className="ex-preview-list">
                {importPreview.projects.map((p) => (
                  <div key={p.id} className="ex-preview-row">
                    <span>
                      {p.name || <em>Untitled</em>}{' '}
                      <span className="mono faint">
                        {importedWordCount(p).toLocaleString()} words
                      </span>
                    </span>
                    {existingProjectIds.has(p.id) ? (
                      <span className="tag red">replaces existing</span>
                    ) : (
                      <span className="tag green">new</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {importPreview.styleProfiles.length > 0 && (
              <div className="ex-preview-list">
                {importPreview.styleProfiles.map((sp) => (
                  <div key={sp.id} className="ex-preview-row">
                    <span>
                      {sp.name || <em>Untitled profile</em>}{' '}
                      <span className="mono faint">style profile</span>
                    </span>
                    {existingProfileIds.has(sp.id) ? (
                      <span className="tag red">replaces existing</span>
                    ) : (
                      <span className="tag green">new</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                className="btn ghost small"
                onClick={() => {
                  setImportPreview(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Cancel
              </button>
              <button className="btn primary" onClick={applyImport}>
                Confirm Import
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
