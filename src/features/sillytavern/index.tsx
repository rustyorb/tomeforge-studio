import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Project, STBookStored, STCardStored } from '../../types'
import { uid } from '../../lib/id'
import { EmptyState, ErrorBanner } from '../../components/ui'
import { parseSillyTavernFile } from '../../lib/import/sillytavern'
import { codexToWorldInfo } from '../../lib/export/worldInfo'
import { downloadText, slugify } from '../../lib/export/download'
import CardForge from './CardForge'

type LibraryItem = STCardStored | STBookStored

/** Add a library item's contents into a tome's Codex (+ Cast for cards). */
function addItemToProject(
  item: LibraryItem,
  project: Project,
  updateProject: (id: string, recipe: (d: Project) => void) => void,
): string {
  let codexAdded = 0
  let castAdded = 0
  let skipped = 0
  updateProject(project.id, (d) => {
    const codexNames = new Set(d.codex.map((e) => e.name.toLowerCase()))
    const castNames = new Set(d.characters.map((c) => c.name.toLowerCase()))
    const addCodex = (
      name: string,
      type: 'character' | 'other',
      content: string,
      aliases: string[],
      always: boolean,
    ) => {
      if (codexNames.has(name.toLowerCase())) {
        skipped++
        return
      }
      codexNames.add(name.toLowerCase())
      d.codex.push({
        id: uid(),
        name,
        type,
        aliases: aliases.filter((a) => a.toLowerCase() !== name.toLowerCase()).slice(0, 8),
        content,
        alwaysInclude: always,
        updatedAt: Date.now(),
      })
      codexAdded++
    }

    if (item.kind === 'card') {
      const sections = [
        item.description,
        item.personality && `Personality: ${item.personality}`,
        item.scenario && `Scenario: ${item.scenario}`,
      ].filter(Boolean)
      addCodex(item.name, 'character', sections.join('\n\n'), item.tags, false)
      if (!castNames.has(item.name.toLowerCase())) {
        d.characters.push({
          id: uid(),
          name: item.name,
          location: '',
          goal: '',
          secrets: '',
          injuries: '',
          relationships: '',
          emotionalState: '',
          arcStage: '',
          lastAppearance: 'Imported from SillyTavern card',
          voiceNotes: item.personality || item.mesExample.slice(0, 400),
          forbidden: '',
        })
        castAdded++
      }
      for (const e of item.book) addCodex(e.name, 'other', e.content, e.keys, e.constant)
    } else {
      for (const e of item.entries) addCodex(e.name, 'other', e.content, e.keys, e.constant)
    }
  })
  return (
    `Added ${codexAdded} codex entr${codexAdded === 1 ? 'y' : 'ies'}` +
    (castAdded ? ` + ${castAdded} cast card` : '') +
    (skipped ? ` (${skipped} skipped — already in that tome)` : '') +
    ` to "${project.name}".`
  )
}

export default function SillyTavernPage() {
  const { projects, activeProjectId, stLibrary, addToSTLibrary, removeFromSTLibrary, updateProject } =
    useStore()
  const library = stLibrary ?? []

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const target = projects.find((p) => p.id === (targetId ?? activeProjectId)) ?? projects[0] ?? null

  const onFiles = async (files: FileList | null) => {
    setError(null)
    setNotice(null)
    if (!files?.length) return
    const items: LibraryItem[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseSillyTavernFile(file)
        items.push(
          parsed.kind === 'card'
            ? {
                id: uid(),
                kind: 'card',
                name: parsed.name,
                description: parsed.description,
                personality: parsed.personality,
                scenario: parsed.scenario,
                mesExample: parsed.mesExample,
                tags: parsed.tags,
                book: parsed.book,
                importedAt: Date.now(),
              }
            : {
                id: uid(),
                kind: 'lorebook',
                name: parsed.name,
                entries: parsed.entries,
                importedAt: Date.now(),
              },
        )
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    if (items.length) {
      addToSTLibrary(items)
      setNotice(`${items.length} item${items.length === 1 ? '' : 's'} added to the library.`)
    }
    if (errors.length) setError(errors.join(' · '))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">Outside Worlds</div>
        <h1>SillyTavern</h1>
        <p className="sub">
          Import character cards (V1/V2/V3 — .json or card .png) and lorebooks/world info once;
          they live here permanently. Then add any of them into any tome's Story Brain whenever
          a narrative needs them. Greetings and chat prompts are skipped — TomeForge is a
          manuscript, not a chat.
        </p>
      </header>

      <CardForge />

      <div className="card rise-1" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 260 }}>
            <label>Import files</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.png,application/json,image/png"
              multiple
              onChange={(e) => void onFiles(e.target.files)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Target tome (for “Add to tome”)</label>
            <select
              value={target?.id ?? ''}
              onChange={(e) => setTargetId(e.target.value || null)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            style={{ alignSelf: 'flex-end' }}
            disabled={!target || !target.codex.length}
            title="Export this tome's entire Codex as a SillyTavern World Info lorebook"
            onClick={() =>
              target &&
              downloadText(
                `${slugify(target.name)}-worldinfo.json`,
                codexToWorldInfo(target),
                'application/json',
              )
            }
          >
            ⬆ Codex → World Info
          </button>
        </div>
        <ErrorBanner error={error} />
        {notice && <div className="tag green" style={{ marginTop: 10 }}>✓ {notice}</div>}
      </div>

      {library.length === 0 ? (
        <EmptyState glyph="❖" title="The library is empty">
          Drop in your SillyTavern collection — cards and lorebooks imported here can be reused
          across every tome you ever forge.
        </EmptyState>
      ) : (
        <div className="stack rise-2">
          {library.map((item) => (
            <div key={item.id} className="card" style={{ padding: '14px 18px' }}>
              <div className="row between wrap" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
                    {item.kind === 'card' ? '☙' : '⁂'} {item.name}
                  </span>
                  <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                    {item.kind === 'card'
                      ? `character card${item.book.length ? ` · ${item.book.length} lore entries` : ''}${item.tags.length ? ` · ${item.tags.slice(0, 4).join(', ')}` : ''}`
                      : `lorebook · ${item.entries.length} entries`}
                    {' · '}imported {new Date(item.importedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <button
                    className="btn ghost small"
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  >
                    {openId === item.id ? 'Hide' : 'View'}
                  </button>
                  <button
                    className="btn small primary"
                    disabled={!target}
                    onClick={() => {
                      if (!target) return
                      setNotice(addItemToProject(item, target, updateProject))
                      setError(null)
                    }}
                  >
                    ＋ Add to tome
                  </button>
                  <button
                    className="btn ghost small danger"
                    onClick={() => {
                      if (confirm(`Remove "${item.name}" from the library? (Tomes it was added to keep their copies.)`)) {
                        removeFromSTLibrary(item.id)
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {openId === item.id && (
                <div style={{ marginTop: 12 }} className="stack">
                  {item.kind === 'card' ? (
                    <>
                      {item.description && (
                        <div className="prose-block" style={{ fontSize: 13.5 }}>
                          {item.description.slice(0, 900)}
                          {item.description.length > 900 && '…'}
                        </div>
                      )}
                      {item.personality && (
                        <div className="faint" style={{ fontSize: 12.5 }}>
                          <b>Personality:</b> {item.personality.slice(0, 300)}
                        </div>
                      )}
                      {item.scenario && (
                        <div className="faint" style={{ fontSize: 12.5 }}>
                          <b>Scenario:</b> {item.scenario.slice(0, 300)}
                        </div>
                      )}
                      {item.book.map((e, i) => (
                        <div key={i} className="faint" style={{ fontSize: 12.5 }}>
                          <b>{e.name}</b> <span className="mono">[{e.keys.slice(0, 5).join(', ')}]</span> —{' '}
                          {e.content.slice(0, 160)}…
                        </div>
                      ))}
                    </>
                  ) : (
                    item.entries.slice(0, 30).map((e, i) => (
                      <div key={i} className="faint" style={{ fontSize: 12.5 }}>
                        <b>{e.name}</b>{' '}
                        <span className="mono">[{e.keys.slice(0, 5).join(', ')}]</span>
                        {e.constant && <span className="tag ember" style={{ marginLeft: 6 }}>always</span>} —{' '}
                        {e.content.slice(0, 160)}…
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
