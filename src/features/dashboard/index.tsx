import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Field, Modal } from '../../components/ui'

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { projects, activeProjectId, setActiveProject, createProject, deleteProject } = useStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')

  const open = (id: string) => {
    setActiveProject(id)
    navigate('/write')
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Archive</div>
        <h1>Projects</h1>
        <p className="sub">
          Every tome keeps its own brain — canon, cast, threads, and voice. Open one to enter
          the workshop, or forge a new story from a single spark.
        </p>
      </header>

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>
          ⊕ Forge New Tome
        </button>
      </div>

      <div className="grid-cards rise-1">
        {projects.map((p) => {
          const words = p.chapters.reduce(
            (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + wordCount(sc.content), 0),
            0,
          )
          return (
            <div
              key={p.id}
              className="card interactive"
              onClick={() => open(p.id)}
              style={p.id === activeProjectId ? { borderColor: 'var(--ember)' } : undefined}
            >
              <div className="row between">
                <span className="tag brass">{p.genre || 'fiction'}</span>
                {p.id === activeProjectId && <span className="tag ember">active</span>}
              </div>
              <h3 style={{ margin: '10px 0 6px' }}>{p.name}</h3>
              <p className="muted" style={{ fontSize: 13.5, minHeight: 40 }}>
                {p.logline || 'No logline yet.'}
              </p>
              <div className="divider" />
              <div className="row between mono faint">
                <span>
                  {p.chapters.length} ch · {words.toLocaleString()} words
                </span>
                <button
                  className="btn ghost small danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${p.name}" forever? This cannot be undone.`)) {
                      deleteProject(p.id)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {creating && (
        <Modal title="Forge New Tome" onClose={() => setCreating(false)}>
          <Field label="Title">
            <input
              type="text"
              value={name}
              autoFocus
              placeholder="The Drowned Observatory"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Genre">
            <input
              type="text"
              value={genre}
              placeholder="Dark Fantasy, Noir, Space Opera…"
              onChange={(e) => setGenre(e.target.value)}
            />
          </Field>
          <Field label="Logline" hint="One sentence. What is this story about?">
            <textarea value={logline} onChange={(e) => setLogline(e.target.value)} />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn primary"
              disabled={!name.trim()}
              onClick={() => {
                createProject(name.trim(), genre.trim(), logline.trim())
                setCreating(false)
                navigate('/write')
              }}
            >
              Forge It
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
