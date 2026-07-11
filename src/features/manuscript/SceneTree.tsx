import { useRef, useState } from 'react'
import type { ID, Project, Scene } from '../../types'
import { uid } from '../../lib/id'
import { Modal } from '../../components/ui'

const TRASH_CAP = 30

/** Move scenes into the project's trash (newest first, capped). */
function trashScenes(d: Project, chapterTitle: string, scenes: Scene[]) {
  if (!d.trashedScenes) d.trashedScenes = []
  for (const scene of scenes) {
    if (!scene.content.trim() && !scene.snapshots?.length) continue // blanks aren't worth keeping
    d.trashedScenes.unshift({ scene, chapterTitle, deletedAt: Date.now() })
  }
  if (d.trashedScenes.length > TRASH_CAP) d.trashedScenes.length = TRASH_CAP
}

interface Props {
  project: Project
  selectedSceneId: ID | null
  onSelect: (id: ID) => void
  mutate: (recipe: (draft: Project) => void) => void
}

type DragPayload =
  | { kind: 'scene'; id: ID; fromChapter: ID }
  | { kind: 'chapter'; id: ID }

export default function SceneTree(props: Props) {
  const [editingId, setEditingId] = useState<ID | null>(null)
  const [draft, setDraft] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const trash = props.project.trashedScenes ?? []

  const restoreScene = (deletedAt: number) => {
    props.mutate((d) => {
      const idx = (d.trashedScenes ?? []).findIndex((t) => t.deletedAt === deletedAt)
      if (idx < 0) return
      const [item] = d.trashedScenes!.splice(idx, 1)
      const home =
        d.chapters.find((c) => c.title === item.chapterTitle) ?? d.chapters[d.chapters.length - 1]
      if (home) home.scenes.push(item.scene)
      else d.chapters.push({ id: uid(), title: item.chapterTitle, scenes: [item.scene] })
    })
  }
  // dataTransfer payloads aren't readable during dragover, so the payload
  // lives in a ref for the duration of the drag.
  const dragRef = useRef<DragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

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

  // ---------- drag & drop ----------

  const endDrag = () => {
    dragRef.current = null
    setDropTarget(null)
  }

  /** Move a scene before targetSceneId, or append to targetChapterId. */
  const dropScene = (payload: Extract<DragPayload, { kind: 'scene' }>, target:
    | { beforeScene: ID; inChapter: ID }
    | { appendToChapter: ID }) => {
    props.mutate((d) => {
      const from = d.chapters.find((c) => c.id === payload.fromChapter)
      if (!from) return
      const idx = from.scenes.findIndex((s) => s.id === payload.id)
      if (idx < 0) return
      const [scene] = from.scenes.splice(idx, 1)
      if ('appendToChapter' in target) {
        const to = d.chapters.find((c) => c.id === target.appendToChapter)
        if (to) to.scenes.push(scene)
        else from.scenes.splice(idx, 0, scene) // target vanished — restore
      } else {
        const to = d.chapters.find((c) => c.id === target.inChapter)
        const at = to?.scenes.findIndex((s) => s.id === target.beforeScene) ?? -1
        if (to && at >= 0) to.scenes.splice(at, 0, scene)
        else from.scenes.splice(idx, 0, scene)
      }
    })
  }

  const dropChapter = (chapterId: ID, beforeChapterId: ID) => {
    if (chapterId === beforeChapterId) return
    props.mutate((d) => {
      const idx = d.chapters.findIndex((c) => c.id === chapterId)
      if (idx < 0) return
      const [ch] = d.chapters.splice(idx, 1)
      const at = d.chapters.findIndex((c) => c.id === beforeChapterId)
      if (at >= 0) d.chapters.splice(at, 0, ch)
      else d.chapters.splice(idx, 0, ch)
    })
  }

  const onDropAt = (targetKey: string, ch: { id: ID }, sc?: { id: ID }) => {
    const payload = dragRef.current
    endDrag()
    if (!payload) return
    if (payload.kind === 'scene') {
      if (sc) {
        if (sc.id !== payload.id) {
          dropScene(payload, { beforeScene: sc.id, inChapter: ch.id })
        }
      } else {
        dropScene(payload, { appendToChapter: ch.id })
      }
    } else if (payload.kind === 'chapter' && !sc) {
      dropChapter(payload.id, ch.id)
    }
  }

  const dragProps = (key: string, accepts: (p: DragPayload) => boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      const p = dragRef.current
      if (p && accepts(p)) {
        e.preventDefault()
        setDropTarget(key)
      }
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
  })

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="kicker">Outline</span>
        <span className="row" style={{ gap: 4 }}>
          {trash.length > 0 && (
            <button
              className="btn ghost small"
              title={`Trash — ${trash.length} deleted scene${trash.length === 1 ? '' : 's'}, restorable`}
              onClick={() => setTrashOpen(true)}
            >
              🗑 {trash.length}
            </button>
          )}
          <button className="btn ghost small" onClick={addChapter}>
            ⊕ Chapter
          </button>
        </span>
      </div>
      {trashOpen && (
        <Modal title="Scene Trash" onClose={() => setTrashOpen(false)}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Deleted scenes wait here (newest first, last {30} kept). Restore puts a scene back
            into its old chapter — or the last chapter if that one's gone.
          </p>
          <div className="stack">
            {trash.map((t) => (
              <div key={t.deletedAt + t.scene.id} className="row between" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{t.scene.title}</div>
                  <div className="mono faint" style={{ fontSize: 10 }}>
                    from "{t.chapterTitle}" · {new Date(t.deletedAt).toLocaleString()} ·{' '}
                    {t.scene.content.trim().split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <button className="btn small" onClick={() => restoreScene(t.deletedAt)}>
                    Restore
                  </button>
                  <button
                    className="btn ghost small danger"
                    title="Delete forever"
                    onClick={() =>
                      props.mutate((d) => {
                        d.trashedScenes = (d.trashedScenes ?? []).filter(
                          (x) => x.deletedAt !== t.deletedAt,
                        )
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {trash.length === 0 && <p className="faint">The trash is empty.</p>}
          </div>
        </Modal>
      )}
      <div className="panel-body" style={{ padding: 10 }}>
        {props.project.chapters.length === 0 && (
          <div className="faint" style={{ fontSize: 13, padding: 6 }}>
            No chapters yet. Forge one to begin.
          </div>
        )}
        {props.project.chapters.map((ch) => (
          <div key={ch.id} className="ms-chapter">
            <div
              className={`ms-chapter-head ${dropTarget === `ch:${ch.id}` ? 'ms-drop-over' : ''}`}
              draggable={editingId !== ch.id}
              onDragStart={(e) => {
                dragRef.current = { kind: 'chapter', id: ch.id }
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={endDrag}
              {...dragProps(`ch:${ch.id}`, () => true)}
              onDrop={() => onDropAt(`ch:${ch.id}`, ch)}
              title="Drag to reorder chapters · drop a scene here to move it into this chapter"
            >
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
                      `Delete chapter "${ch.title}" and its ${ch.scenes.length} scene(s)? Written scenes go to the trash.`,
                    )
                  ) {
                    props.mutate((d) => {
                      const target = d.chapters.find((x) => x.id === ch.id)
                      if (target) trashScenes(d, target.title, target.scenes)
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
                className={`ms-scene ${sc.id === props.selectedSceneId ? 'active' : ''} ${
                  dropTarget === `sc:${sc.id}` ? 'ms-drop-over' : ''
                }`}
                onClick={() => props.onSelect(sc.id)}
                draggable={editingId !== sc.id}
                onDragStart={(e) => {
                  dragRef.current = { kind: 'scene', id: sc.id, fromChapter: ch.id }
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={endDrag}
                {...dragProps(`sc:${sc.id}`, (p) => p.kind === 'scene')}
                onDrop={() => onDropAt(`sc:${sc.id}`, ch, sc)}
                title="Drag to reorder · drop before another scene or onto a chapter"
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
                    if (confirm(`Delete scene "${sc.title}"? It goes to the trash, restorable.`)) {
                      props.mutate((d) => {
                        const c = d.chapters.find((x) => x.id === ch.id)
                        if (!c) return
                        const target = c.scenes.find((s) => s.id === sc.id)
                        if (target) trashScenes(d, c.title, [target])
                        c.scenes = c.scenes.filter((s) => s.id !== sc.id)
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
