import { useState } from 'react'
import { useActiveProject, useStore } from '../../store/useStore'
import { EmptyState } from '../../components/ui'
import { ProfileEditor } from './ProfileEditor'

export default function VoiceprintPage() {
  const styleProfiles = useStore((s) => s.styleProfiles)
  const createStyleProfile = useStore((s) => s.createStyleProfile)
  const updateProject = useStore((s) => s.updateProject)
  const project = useActiveProject()

  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = styleProfiles.find((p) => p.id === editingId) ?? null

  const newProfile = () => {
    const id = createStyleProfile('New Voiceprint')
    setEditingId(id)
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">Voiceprint</div>
        <h1>Style Profiles</h1>
        <p className="sub">
          A voiceprint is a reusable fingerprint of prose style — density, diction, pacing,
          POV, and voice notes. Assign one to a project and every generation obeys it.
        </p>
      </header>

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn primary" onClick={newProfile}>
          ⊕ New Profile
        </button>
        {project && (
          <span className="mono faint">Assigning for: {project.name}</span>
        )}
      </div>

      {styleProfiles.length === 0 ? (
        <EmptyState glyph="❦" title="No voiceprints yet">
          Create a profile to capture a prose style you can reuse across projects.
        </EmptyState>
      ) : (
        <div className="grid-cards rise-1">
          {styleProfiles.map((p) => {
            const assigned = project?.styleProfileId === p.id
            return (
              <div
                key={p.id}
                className="card"
                style={assigned ? { borderColor: 'var(--ember)' } : undefined}
              >
                <div className="row between wrap">
                  <span className="tag brass">{p.controls.pacing}</span>
                  {assigned && <span className="tag ember">active</span>}
                </div>
                <h3 style={{ margin: '10px 0 6px' }}>{p.name}</h3>
                <p className="muted" style={{ fontSize: 13.5, minHeight: 40 }}>
                  {p.description || 'No description yet.'}
                </p>
                <div className="row wrap" style={{ marginBottom: 4 }}>
                  {p.povLock && <span className="tag">{p.povLock}</span>}
                  {p.tenseLock && <span className="tag">{p.tenseLock}</span>}
                </div>
                <div className="divider" />
                <div className="row between wrap">
                  <button className="btn small" onClick={() => setEditingId(p.id)}>
                    Edit
                  </button>
                  {project &&
                    (assigned ? (
                      <button
                        className="btn ghost small"
                        onClick={() =>
                          updateProject(project.id, (d) => {
                            d.styleProfileId = null
                          })
                        }
                      >
                        Detach
                      </button>
                    ) : (
                      <button
                        className="btn small"
                        onClick={() =>
                          updateProject(project.id, (d) => {
                            d.styleProfileId = p.id
                          })
                        }
                      >
                        Use for {project.name}
                      </button>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && <ProfileEditor profile={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}
