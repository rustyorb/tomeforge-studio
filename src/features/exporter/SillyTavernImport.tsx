import { useRef, useState } from 'react'
import type { Project } from '../../types'
import { useStore } from '../../store/useStore'
import { uid } from '../../lib/id'
import { ErrorBanner } from '../../components/ui'
import { parseSillyTavernFile } from '../../lib/import/sillytavern'
import type { STImport } from '../../lib/import/sillytavern'

/**
 * Import SillyTavern character cards (v1/v2/v3, .json or .png-embedded) and
 * lorebooks / world info into the active tome's Codex + Cast Ledger.
 */
export default function SillyTavernImport(props: { project: Project | null }) {
  const { project } = props
  const updateProject = useStore((s) => s.updateProject)
  const [parsed, setParsed] = useState<STImport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFiles = async (files: FileList | null) => {
    setError(null)
    setDone(null)
    setParsed([])
    if (!files?.length) return
    const results: STImport[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        results.push(await parseSillyTavernFile(file))
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    setParsed(results)
    if (errors.length) setError(errors.join(' · '))
  }

  const applyImport = () => {
    if (!project) return
    let codexAdded = 0
    let castAdded = 0
    let skipped = 0
    updateProject(project.id, (d) => {
      const existingCodex = new Set(d.codex.map((e) => e.name.toLowerCase()))
      const existingCast = new Set(d.characters.map((c) => c.name.toLowerCase()))

      const addCodex = (name: string, type: 'character' | 'other', content: string, aliases: string[], always: boolean) => {
        if (existingCodex.has(name.toLowerCase())) {
          skipped++
          return
        }
        existingCodex.add(name.toLowerCase())
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

      for (const item of parsed) {
        if (item.kind === 'card') {
          const sections = [
            item.description,
            item.personality && `Personality: ${item.personality}`,
            item.scenario && `Scenario: ${item.scenario}`,
          ].filter(Boolean)
          addCodex(item.name, 'character', sections.join('\n\n'), item.tags, false)
          if (!existingCast.has(item.name.toLowerCase())) {
            existingCast.add(item.name.toLowerCase())
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
          for (const entry of item.book) {
            addCodex(entry.name, 'other', entry.content, entry.keys, entry.constant)
          }
        } else {
          for (const entry of item.entries) {
            addCodex(entry.name, 'other', entry.content, entry.keys, entry.constant)
          }
        }
      }
    })
    setParsed([])
    if (fileRef.current) fileRef.current.value = ''
    setDone(
      `Imported ${codexAdded} codex entr${codexAdded === 1 ? 'y' : 'ies'}` +
        (castAdded ? ` and ${castAdded} cast card${castAdded === 1 ? '' : 's'}` : '') +
        (skipped ? ` · ${skipped} skipped (name already in the Codex)` : '') +
        '.',
    )
  }

  const totalEntries = parsed.reduce(
    (n, p) => n + (p.kind === 'card' ? 1 + p.book.length : p.entries.length),
    0,
  )

  return (
    <section style={{ marginTop: 28 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Outside Worlds</div>
      <div className="card">
        <div className="row between wrap">
          <div>
            <h3 style={{ fontSize: 15 }}>Import from SillyTavern</h3>
            <p className="muted ex-desc" style={{ maxWidth: 520 }}>
              Character cards (V1/V2/V3 — .json or card .png with embedded data) become Codex
              entries + Cast Ledger cards; lorebooks and world info become Codex entries with
              their trigger keys as aliases. Greetings and chat prompts are skipped — TomeForge
              is a manuscript, not a chat.
            </p>
          </div>
          <span className="tag brass">.json / .png</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.png,application/json,image/png"
          multiple
          disabled={!project}
          onChange={(e) => void onFiles(e.target.files)}
        />
        {!project && (
          <p className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
            Select a tome above first — imports land in its Story Brain.
          </p>
        )}
        <ErrorBanner error={error} />
        {done && <div className="ex-success">✓ {done}</div>}

        {parsed.length > 0 && project && (
          <div style={{ marginTop: 12 }}>
            <div className="ex-preview-list">
              {parsed.map((p, i) => (
                <div key={i} className="ex-preview-row">
                  <span>
                    {p.kind === 'card' ? '☙' : '⁂'} {p.name}{' '}
                    <span className="mono faint">
                      {p.kind === 'card'
                        ? `character card${p.book.length ? ` + ${p.book.length} lore entries` : ''}`
                        : `lorebook · ${p.entries.length} entries`}
                    </span>
                  </span>
                  <span className="tag green">ready</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                className="btn ghost small"
                onClick={() => {
                  setParsed([])
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Cancel
              </button>
              <button className="btn primary" onClick={applyImport}>
                Import {totalEntries} entr{totalEntries === 1 ? 'y' : 'ies'} into "{project.name}"
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
