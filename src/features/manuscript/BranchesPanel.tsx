import { useState } from 'react'
import type { Branch, ID, Project } from '../../types'
import { uid } from '../../lib/id'
import { findScene, wordCount } from './helpers'

interface Props {
  project: Project
  /** Chapter that Insert as New Scene adds to. */
  currentChapterId: ID | null
  mutate: (recipe: (draft: Project) => void) => void
  onSelectScene: (id: ID) => void
}

export default function BranchesPanel(props: Props) {
  const [expandedId, setExpandedId] = useState<ID | null>(null)
  const branches = props.project.branches

  const insert = (b: Branch) => {
    const id = uid()
    props.mutate((d) => {
      const ch =
        d.chapters.find((c) => c.id === props.currentChapterId) ?? d.chapters[0]
      if (!ch) return
      ch.scenes.push({ id, title: b.name, content: b.content })
    })
    props.onSelectScene(id)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="kicker">Branch Vault</span>
        <span className="tag">{branches.length}</span>
      </div>
      <div className="panel-body">
        {branches.length === 0 ? (
          <div className="faint" style={{ fontSize: 13.5 }}>
            No branches yet. Save a generation as a branch to keep an alternate path
            without committing it to the manuscript.
          </div>
        ) : (
          <div className="stack">
            {branches.map((b) => {
              const source = findScene(props.project, b.sourceSceneId)
              const open = expandedId === b.id
              return (
                <div key={b.id} className="ms-branch">
                  <div className="row between wrap">
                    <button
                      className="ms-branch-toggle"
                      onClick={() => setExpandedId(open ? null : b.id)}
                    >
                      <span className="mono faint">{open ? '▾' : '▸'}</span> {b.name}
                    </button>
                    <span className="mono faint">
                      {source ? `from "${source.scene.title}" · ` : ''}
                      {wordCount(b.content).toLocaleString()} w ·{' '}
                      {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {b.note && (
                    <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {b.note}
                    </div>
                  )}
                  {open && (
                    <>
                      <div className="prose-block ms-scroll" style={{ marginTop: 10 }}>
                        {b.content}
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="btn small" onClick={() => insert(b)}>
                          Insert as New Scene
                        </button>
                        <button
                          className="btn small ghost danger"
                          onClick={() => {
                            if (confirm(`Delete branch "${b.name}"? This cannot be undone.`)) {
                              props.mutate((d) => {
                                d.branches = d.branches.filter((x) => x.id !== b.id)
                              })
                            }
                          }}
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
      </div>
    </div>
  )
}
