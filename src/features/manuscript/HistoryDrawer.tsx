import { useState } from 'react'
import type { ID, Project, Scene, SceneSnapshot } from '../../types'
import { Modal } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { sceneDraft, wordCount } from './helpers'

const PREVIEW_CHARS = 700

function relTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

/**
 * Scene Time Machine: '⧗ History' button (with count badge) opening a modal
 * that lists the scene's snapshots newest-first, with preview / restore /
 * delete per snapshot and a manual 'Snapshot now'.
 */
export default function HistoryDrawer(props: {
  projectId: ID
  scene: Scene
  mutate: (recipe: (draft: Project) => void) => void
}) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<ID | null>(null)
  const [showAll, setShowAll] = useState(false)
  const snapshots = props.scene.snapshots ?? []
  const sceneId = props.scene.id

  const snapshotNow = () =>
    useStore.getState().snapshotScene(props.projectId, sceneId, 'Manual snapshot')

  const restore = (snap: SceneSnapshot) => {
    // Snapshot the current text FIRST so a restore is itself reversible.
    useStore.getState().snapshotScene(props.projectId, sceneId, 'Before restore')
    props.mutate((d) => {
      const sc = sceneDraft(d, sceneId)
      if (sc) sc.content = snap.content
    })
  }

  const remove = (snapId: ID) => {
    props.mutate((d) => {
      const sc = sceneDraft(d, sceneId)
      if (sc?.snapshots) sc.snapshots = sc.snapshots.filter((x) => x.id !== snapId)
    })
  }

  return (
    <>
      <button className="btn ghost small" title="Scene history" onClick={() => setOpen(true)}>
        ⧗ History
        {snapshots.length > 0 && <span className="tag ember">{snapshots.length}</span>}
      </button>

      {open && (
        <Modal title="Scene Time Machine" onClose={() => setOpen(false)}>
          <div className="row between wrap" style={{ marginBottom: 14 }}>
            <span className="muted" style={{ fontSize: 13, maxWidth: 340 }}>
              Snapshots are taken automatically before AI applies. Restoring first
              snapshots the current text, so nothing is ever lost.
            </span>
            <button className="btn small" onClick={snapshotNow}>
              ⊕ Snapshot now
            </button>
          </div>

          {snapshots.length === 0 ? (
            <div className="empty-state">
              <div className="glyph">⧗</div>
              <h3 style={{ marginBottom: 6 }}>No snapshots yet</h3>
              <div>
                Accept a generation, apply a rewrite, or take a manual snapshot to
                start this scene's timeline.
              </div>
            </div>
          ) : (
            <div className="stack">
              {snapshots.map((snap) => {
                const isOpen = expandedId === snap.id
                const truncated = snap.content.length > PREVIEW_CHARS
                const preview =
                  isOpen && truncated && !showAll
                    ? `${snap.content.slice(0, PREVIEW_CHARS)}…`
                    : snap.content
                return (
                  <div key={snap.id} className="ms-snap">
                    <div className="row between wrap">
                      <button
                        className="ms-branch-toggle"
                        onClick={() => {
                          setExpandedId(isOpen ? null : snap.id)
                          setShowAll(false)
                        }}
                      >
                        <span className="mono faint">{isOpen ? '▾' : '▸'}</span> {snap.label}
                      </button>
                      <span className="mono faint" title={new Date(snap.createdAt).toLocaleString()}>
                        {relTime(snap.createdAt)} · {wordCount(snap.content).toLocaleString()} w
                      </span>
                    </div>
                    {isOpen && (
                      <>
                        <div className="prose-block ms-scroll ms-snap-preview">
                          {snap.content ? preview : <span className="faint">(empty scene)</span>}
                        </div>
                        <div className="row wrap" style={{ marginTop: 10 }}>
                          {truncated && !showAll && (
                            <button className="btn small ghost" onClick={() => setShowAll(true)}>
                              Show all
                            </button>
                          )}
                          <button className="btn small primary" onClick={() => restore(snap)}>
                            Restore
                          </button>
                          <button
                            className="btn small ghost danger"
                            onClick={() => remove(snap.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
