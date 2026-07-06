import { useState } from 'react'
import type { ID, Project } from '../../types'
import { uid } from '../../lib/id'

interface Props {
  project: Project
  selectedSceneId: ID | null
  onSelect: (id: ID) => void
  mutate: (recipe: (draft: Project) => void) => void
}

export default function SceneTree(props: Props) {
  const [editingId, setEditingId] = useState<ID | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = (id: ID, title: string) => {
    setEditingId(id)
    setDraft(title)
  }

  const commitEdit = () => {
    const id = editingId
    const title = draft.trim()
    setEditingId(null)
    if (!id || !title) return
    props.mutate((d) => {
      for (const ch of d.chapters) {
        if (ch.id === id) {
          ch.title = title
          return
        }
        const sc = ch.scenes.find((s) => s.id === id)
        if (sc) {
          sc.title = title
          return
        }
      }
    })
  }

  const renameInput = (
    <input
      className="ms-rename-input"
      type="text"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitEdit()
        if (e.key === 'Escape') setEditingId(null)
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )

  const addChapter = () => {
    props.mutate((d) => {
      d.chapters.push({
        id: uid(),
        title: `Chapter ${d.chapters.length + 1}`,
        scenes: [],
      })
    })
  }

  const addScene = (chapterId: ID) => {
    const id = uid()
    props.mutate((d) => {
      const ch = d.chapters.find((c) => c.id === chapterId)
      if (!ch) return
      ch.scenes.push({ id, title: `Scene ${ch.scenes.length + 1}`, content: '' })
    })
    props.onSelect(id)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="kicker">Outline</span>
        <button className="btn ghost small" onClick={addChapter}>
          ⊕ Chapter
        </button>
      </div>
      <div className="panel-body" style={{ padding: 10 }}>
        {props.project.chapters.length === 0 && (
          <div className="faint" style={{ fontSize: 13, padding: 6 }}>
            No chapters yet. Forge one to begin.
          </div>
        )}
        {props.project.chapters.map((ch) => (
          <div key={ch.id} className="ms-chapter">
            <div className="ms-chapter-head">
              {editingId === ch.id ? (
                renameInput
              ) : (
                <span className="ms-chapter-title" title={ch.title}>
                  {ch.title}
                </span>
              )}
              <button
                className="ms-icon-btn"
                title="Rename chapter"
                onClick={() => startEdit(ch.id, ch.title)}
              >
                ✎
              </button>
              <button className="ms-icon-btn" title="Add scene" onClick={() => addScene(ch.id)}>
                ⊕
              </button>
              <button
                className="ms-icon-btn"
                title="Delete chapter"
                onClick={() => {
                  if (
                    confirm(
                      `Delete chapter "${ch.title}" and its ${ch.scenes.length} scene(s)? This cannot be undone.`,
                    )
                  ) {
                    props.mutate((d) => {
                      d.chapters = d.chapters.filter((x) => x.id !== ch.id)
                    })
                  }
                }}
              >
                ✕
              </button>
            </div>
            {ch.scenes.map((sc) => (
              <div
                key={sc.id}
                className={`ms-scene ${sc.id === props.selectedSceneId ? 'active' : ''}`}
                onClick={() => props.onSelect(sc.id)}
              >
                {editingId === sc.id ? (
                  renameInput
                ) : (
                  <span className="ms-scene-title" title={sc.title}>
                    {sc.title}
                  </span>
                )}
                <button
                  className="ms-icon-btn"
                  title="Rename scene"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(sc.id, sc.title)
                  }}
                >
                  ✎
                </button>
                <button
                  className="ms-icon-btn"
                  title="Delete scene"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete scene "${sc.title}"? This cannot be undone.`)) {
                      props.mutate((d) => {
                        const c = d.chapters.find((x) => x.id === ch.id)
                        if (c) c.scenes = c.scenes.filter((s) => s.id !== sc.id)
                      })
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {ch.scenes.length === 0 && (
              <div className="faint" style={{ fontSize: 12, padding: '2px 14px' }}>
                No scenes.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
