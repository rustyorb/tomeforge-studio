import { useRef, useState } from 'react'
import type { ID, Project } from '../../types'
import { wordCount } from './helpers'

/**
 * Corkboard — every scene as a pinned card, grouped by chapter. Click a card
 * to open it in the editor; drag cards to reorder (drop on a card = insert
 * before it, drop on a chapter header = append to that chapter).
 */
export default function Corkboard(props: {
  project: Project
  onOpen: (sceneId: ID) => void
  mutate: (recipe: (draft: Project) => void) => void
}) {
  const dragRef = useRef<{ sceneId: ID; fromChapter: ID } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const endDrag = () => {
    dragRef.current = null
    setDropTarget(null)
  }

  const moveScene = (target: { beforeScene: ID; inChapter: ID } | { appendToChapter: ID }) => {
    const payload = dragRef.current
    endDrag()
    if (!payload) return
    props.mutate((d) => {
      const from = d.chapters.find((c) => c.id === payload.fromChapter)
      if (!from) return
      const idx = from.scenes.findIndex((s) => s.id === payload.sceneId)
      if (idx < 0) return
      const [scene] = from.scenes.splice(idx, 1)
      if ('appendToChapter' in target) {
        const to = d.chapters.find((c) => c.id === target.appendToChapter)
        if (to) to.scenes.push(scene)
        else from.scenes.splice(idx, 0, scene)
      } else {
        const to = d.chapters.find((c) => c.id === target.inChapter)
        const at = to?.scenes.findIndex((s) => s.id === target.beforeScene) ?? -1
        if (to && at >= 0 && target.beforeScene !== scene.id) to.scenes.splice(at, 0, scene)
        else from.scenes.splice(idx, 0, scene)
      }
    })
  }

  const over = (key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dragRef.current) {
        e.preventDefault()
        setDropTarget(key)
      }
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
  })

  return (
    <div className="ms-cork rise-1">
      {props.project.chapters.map((ch) => (
        <section key={ch.id} className="ms-cork-chapter">
          <div
            className={`ms-cork-chapter-head ${dropTarget === `ch:${ch.id}` ? 'ms-drop-over' : ''}`}
            {...over(`ch:${ch.id}`)}
            onDrop={() => moveScene({ appendToChapter: ch.id })}
          >
            <span className="kicker">{ch.title}</span>
            <span className="mono faint">
              {ch.scenes.length} scene{ch.scenes.length === 1 ? '' : 's'} ·{' '}
              {ch.scenes.reduce((s, sc) => s + wordCount(sc.content), 0).toLocaleString()} words
            </span>
          </div>
          <div className="ms-cork-grid">
            {ch.scenes.map((sc) => (
              <div
                key={sc.id}
                className={`ms-cork-card ms-cork-${sc.status ?? 'draft'} ${dropTarget === `sc:${sc.id}` ? 'ms-drop-over' : ''}`}
                draggable
                onDragStart={(e) => {
                  dragRef.current = { sceneId: sc.id, fromChapter: ch.id }
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={endDrag}
                {...over(`sc:${sc.id}`)}
                onDrop={() => moveScene({ beforeScene: sc.id, inChapter: ch.id })}
                onClick={() => props.onOpen(sc.id)}
                title="Click to open in the editor · drag to reorder"
              >
                <div className="ms-cork-title">{sc.title}</div>
                <div className="ms-cork-body">
                  {sc.summary?.trim() || sc.content.trim().slice(0, 150) || (
                    <span className="faint">Blank page — nothing inked yet.</span>
                  )}
                </div>
                <div className="ms-cork-meta mono">
                  {wordCount(sc.content).toLocaleString()} w
                  {sc.summary && <span title="Has an Archivist summary"> · ⁂</span>}
                  {(sc.snapshots?.length ?? 0) > 0 && <span title="Has snapshots"> · ⧗{sc.snapshots!.length}</span>}
                </div>
              </div>
            ))}
            {ch.scenes.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>Empty chapter — drop a card here.</div>}
          </div>
        </section>
      ))}
    </div>
  )
}
