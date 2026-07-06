import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { Project, TimelineEvent } from '../../types'
import { uid } from '../../lib/id'
import { EmptyState, Field } from '../../components/ui'

const EVENT_FIELDS: { key: Exclude<keyof TimelineEvent, 'id' | 'order' | 'notes'>; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Title', placeholder: 'The bridge burns' },
  { key: 'when', label: 'When', placeholder: 'Third night of frost' },
  { key: 'location', label: 'Location', placeholder: 'Kelder Crossing' },
  { key: 'characters', label: 'Characters', placeholder: 'Mara, the Ferryman' },
  { key: 'chapterRef', label: 'Chapter Ref', placeholder: 'Ch. 7' },
]

export default function ChronicleTab({ project }: { project: Project }) {
  const updateProject = useStore((s) => s.updateProject)

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
        <button className="btn primary" onClick={addEvent}>⊕ Add Event</button>
      </div>

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
