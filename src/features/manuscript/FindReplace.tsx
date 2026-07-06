import { useMemo, useState } from 'react'
import type { Project } from '../../types'
import { useStore } from '../../store/useStore'
import { Modal } from '../../components/ui'

interface Match {
  chapterTitle: string
  sceneId: string
  sceneTitle: string
  index: number
  found: string
  before: string
  after: string
}

function findMatches(project: Project, query: string, caseSensitive: boolean): Match[] {
  if (query.length < 2) return []
  const out: Match[] = []
  const needle = caseSensitive ? query : query.toLowerCase()
  for (const ch of project.chapters) {
    for (const sc of ch.scenes) {
      const hay = caseSensitive ? sc.content : sc.content.toLowerCase()
      let from = 0
      while (out.length < 200) {
        const at = hay.indexOf(needle, from)
        if (at < 0) break
        out.push({
          chapterTitle: ch.title,
          sceneId: sc.id,
          sceneTitle: sc.title,
          index: at,
          found: sc.content.slice(at, at + query.length),
          before: sc.content.slice(Math.max(0, at - 32), at).replace(/\n+/g, ' '),
          after: sc.content.slice(at + query.length, at + query.length + 32).replace(/\n+/g, ' '),
        })
        from = at + Math.max(1, needle.length)
      }
    }
  }
  return out
}

export default function FindReplace(props: { project: Project; onClose: () => void }) {
  const { project } = props
  const updateProject = useStore((s) => s.updateProject)
  const snapshotScene = useStore((s) => s.snapshotScene)

  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const matches = useMemo(
    () => findMatches(project, query, caseSensitive),
    [project, query, caseSensitive],
  )

  /** Replace one match by exact position (checked against current content). */
  const replaceOne = (m: Match) => {
    updateProject(project.id, (d) => {
      for (const ch of d.chapters) {
        const sc = ch.scenes.find((s) => s.id === m.sceneId)
        if (!sc) continue
        // Guard: only replace if the text at that index still matches.
        if (sc.content.slice(m.index, m.index + m.found.length) === m.found) {
          snapshotDraft(sc)
          sc.content =
            sc.content.slice(0, m.index) + replacement + sc.content.slice(m.index + m.found.length)
        }
        return
      }
    })
  }

  // One snapshot per scene per find/replace session, so Replace All on a
  // 30-match scene doesn't burn 30 history slots.
  const snapshotted = useMemo(() => new Set<string>(), [query, replacement])
  const snapshotDraft = (sc: { id: string }) => {
    if (snapshotted.has(sc.id)) return
    snapshotted.add(sc.id)
    snapshotScene(project.id, sc.id, `Before replace: "${query.slice(0, 24)}"`)
  }

  const replaceAll = () => {
    const affected = new Set(matches.map((m) => m.sceneId))
    let count = 0
    updateProject(project.id, (d) => {
      for (const ch of d.chapters) {
        for (const sc of ch.scenes) {
          if (!affected.has(sc.id)) continue
          snapshotDraft(sc)
          if (caseSensitive) {
            count += sc.content.split(query).length - 1
            sc.content = sc.content.split(query).join(replacement)
          } else {
            // Case-insensitive: rebuild via regex with escaped pattern.
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            count += (sc.content.match(re) ?? []).length
            sc.content = sc.content.replace(re, () => replacement)
          }
        }
      }
    })
    setDone(`Replaced ${count} occurrence${count === 1 ? '' : 's'}. Snapshots saved per scene.`)
  }

  return (
    <Modal title="Find & Replace" onClose={props.onClose}>
      <div className="grid-2">
        <div className="field">
          <label>Find</label>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setDone(null)
            }}
            placeholder="at least 2 characters"
          />
        </div>
        <div className="field">
          <label>Replace with</label>
          <input
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </div>
      </div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <label className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Case sensitive
        </label>
        <div className="row">
          <span className="mono faint">{query.length >= 2 ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : ''}</span>
          <button className="btn small primary" disabled={!matches.length} onClick={replaceAll}>
            Replace All
          </button>
        </div>
      </div>
      {done && <div className="tag green" style={{ marginBottom: 10 }}>{done}</div>}
      <div style={{ maxHeight: '42vh', overflowY: 'auto' }} className="stack">
        {matches.slice(0, 60).map((m, i) => (
          <div key={`${m.sceneId}-${m.index}-${i}`} className="row between" style={{ gap: 10 }}>
            <div style={{ minWidth: 0, fontSize: 13 }}>
              <div className="mono faint" style={{ fontSize: 10 }}>
                {m.chapterTitle} · {m.sceneTitle}
              </div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span className="faint">…{m.before}</span>
                <span className="ember-text">{m.found}</span>
                <span className="faint">{m.after}…</span>
              </div>
            </div>
            <button className="btn ghost small" style={{ flexShrink: 0 }} onClick={() => replaceOne(m)}>
              Replace
            </button>
          </div>
        ))}
        {matches.length > 60 && (
          <div className="faint" style={{ fontSize: 12 }}>
            +{matches.length - 60} more — Replace All covers them too.
          </div>
        )}
      </div>
    </Modal>
  )
}
