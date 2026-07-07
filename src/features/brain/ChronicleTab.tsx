import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Project, TimelineEvent } from '../../types'
import { uid } from '../../lib/id'
import { EmptyState, ErrorBanner, Field } from '../../components/ui'
import { discoverArray, str } from './discover'

const EVENT_FIELDS: { key: Exclude<keyof TimelineEvent, 'id' | 'order' | 'notes'>; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Title', placeholder: 'The bridge burns' },
  { key: 'when', label: 'When', placeholder: 'Third night of frost' },
  { key: 'location', label: 'Location', placeholder: 'Kelder Crossing' },
  { key: 'characters', label: 'Characters', placeholder: 'Mara, the Ferryman' },
  { key: 'chapterRef', label: 'Chapter Ref', placeholder: 'Ch. 7' },
]

export default function ChronicleTab({ project }: { project: Project }) {
  const updateProject = useStore((s) => s.updateProject)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const extractTimeline = async () => {
    setScanning(true)
    setScanError(null)
    setScanNote(null)
    try {
      const existing = project.timeline.map((e) => e.title).join('; ') || '(none yet)'
      const rows = await discoverArray(
        project,
        null,
        'You are the story chronicler. From the manuscript excerpt, extract every significant EVENT in the order it happened ' +
          `(story-time order, not necessarily narration order) — EXCEPT events already tracked: ${existing}. ` +
          'Output ONLY a fenced ```json array; each element has string keys: ' +
          '"title" (five-word event name), "when" (in-story time as the text implies it), "location", ' +
          '"characters" (comma-separated names), "chapterRef", "notes" (one sentence, only facts the text establishes). ' +
          'Empty string when unknown. Include only events that actually occur or are firmly established as having occurred.',
      )
      let added = 0
      updateProject(project.id, (d) => {
        const titles = new Set(d.timeline.map((e) => e.title.toLowerCase()))
        let order = d.timeline.reduce((m, e) => Math.max(m, e.order), -1) + 1
        for (const row of rows) {
          const title = str(row.title, 120).trim()
          if (!title || titles.has(title.toLowerCase())) continue
          titles.add(title.toLowerCase())
          d.timeline.push({
            id: uid(),
            title,
            when: str(row.when, 120),
            location: str(row.location, 120),
            characters: str(row.characters, 200),
            chapterRef: str(row.chapterRef, 60),
            notes: str(row.notes, 300),
            order: order++,
          })
          added++
        }
      })
      setScanNote(
        added
          ? `Extracted ${added} event${added === 1 ? '' : 's'} from the manuscript — reorder as needed.`
          : 'No new events found — the timeline already covers the manuscript.',
      )
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  const sorted = useMemo(
    () => [...project.timeline].sort((a, b) => a.order - b.order),
    [project.timeline],
  )

  const edit = (id: string, recipe: (e: TimelineEvent) => void) =>
    updateProject(project.id, (d) => {
      const target = d.timeline.find((e) => e.id === id)
      if (target) recipe(target)
    })

  const addEvent = () => {
    updateProject(project.id, (d) => {
      const maxOrder = d.timeline.reduce((m, e) => Math.max(m, e.order), 0)
      d.timeline.push({
        id: uid(),
        title: 'New event',
        when: '',
        location: '',
        characters: '',
        chapterRef: '',
        notes: '',
        order: maxOrder + 1,
      })
    })
  }

  /** Swap the event at sorted position `index` with its neighbor, normalizing order values. */
  const move = (index: number, dir: -1 | 1) => {
    const ids = sorted.map((e) => e.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const a = ids[index]
    ids[index] = ids[j]
    ids[j] = a
    updateProject(project.id, (d) => {
      ids.forEach((id, i) => {
        const target = d.timeline.find((e) => e.id === id)
        if (target) target.order = i
      })
    })
  }

  return (
    <div className="rise">
      <div className="row between" style={{ marginBottom: 16 }}>
        <span className="kicker">Timeline · {project.timeline.length} events</span>
        <div className="row">
          <button
            className="btn"
            disabled={scanning}
            title="Scan the manuscript and extract events into the timeline"
            onClick={() => void extractTimeline()}
          >
            {scanning ? (<><span className="spinner" /> Reading…</>) : '⌛ Extract from manuscript'}
          </button>
          <button className="btn primary" onClick={addEvent}>⊕ Add Event</button>
        </div>
      </div>
      {scanNote && <div className="tag green" style={{ marginBottom: 12 }}>✓ {scanNote}</div>}
      <ErrorBanner error={scanError} />

      {sorted.length === 0 ? (
        <EmptyState glyph="⧗" title="No events chronicled">
          Pin down what happened when. A clean chronology is the first defense against
          timeline breaks.
        </EmptyState>
      ) : (
        <div className="stack">
          {sorted.map((ev, i) => (
            <div key={ev.id} className="card">
              <div className="br-chron-row">
                <div className="br-order-btns">
                  <button
                    className="btn small ghost"
                    disabled={i === 0}
                    title="Move earlier"
                    onClick={() => move(i, -1)}
                  >
                    ▲
                  </button>
                  <button
                    className="btn small ghost"
                    disabled={i === sorted.length - 1}
                    title="Move later"
                    onClick={() => move(i, 1)}
                  >
                    ▼
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="br-chron-grid">
                    {EVENT_FIELDS.map((f) => (
                      <Field key={f.key} label={f.label}>
                        <input
                          type="text"
                          value={ev[f.key]}
                          placeholder={f.placeholder}
                          onChange={(e) => edit(ev.id, (t) => { t[f.key] = e.target.value })}
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label="Notes">
                    <textarea
                      rows={2}
                      value={ev.notes}
                      onChange={(e) => edit(ev.id, (t) => { t.notes = e.target.value })}
                    />
                  </Field>
                  <div className="row between">
                    <span className="mono faint">№ {i + 1}</span>
                    <button
                      className="btn small ghost danger"
                      onClick={() =>
                        updateProject(project.id, (d) => {
                          d.timeline = d.timeline.filter((e) => e.id !== ev.id)
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
