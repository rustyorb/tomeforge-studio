import { useMemo, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import type { Project } from '../../types'
import { Field, Modal } from '../../components/ui'
import { InspireButton } from '../../components/InspireButton'
import { Sparkline } from '../insights/Sparkline'
import {
  PALETTE,
  combinedDaily,
  currentStreak,
  dailyWordsForProject,
  hashString,
  lastNDays,
  projectTotalWords,
} from '../insights/stats'
import './dashboard.css'

/** Deterministic generative cover: project name → layered gradients. */
function coverStyle(name: string): React.CSSProperties {
  const h = hashString(name || 'untitled')
  const i1 = h % PALETTE.length
  let i2 = (h >> 3) % PALETTE.length
  if (i2 === i1) i2 = (i2 + 1) % PALETTE.length
  const c1 = PALETTE[i1]
  const c2 = PALETTE[i2]
  const angle = h % 360
  const px = 15 + ((h >> 7) % 70)
  const py = 10 + ((h >> 11) % 60)
  return {
    background:
      `radial-gradient(circle at ${px}% ${py}%, ${c2}cc, transparent 62%), ` +
      `linear-gradient(${angle}deg, ${c1}, ${c2} 135%)`,
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { projects, activeProjectId, setActiveProject, createProject, deleteProject } = useStore()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')

  const editingProject = projects.find((p) => p.id === editingId) ?? null
  const startEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setName(p.name)
    setGenre(p.genre)
    setLogline(p.logline)
    setEditingId(p.id)
  }
  const saveEdit = () => {
    if (!editingProject || !name.trim()) return
    useStore.getState().updateProject(editingProject.id, (d) => {
      d.name = name.trim()
      d.genre = genre.trim()
      d.logline = logline.trim()
    })
    setEditingId(null)
  }

  const daily = useMemo(() => combinedDaily(projects), [projects])
  const totalWords = projects.reduce((s, p) => s + projectTotalWords(p), 0)
  const streak = currentStreak(daily)

  const open = (id: string) => {
    setActiveProject(id)
    navigate('/write')
  }

  const duplicateTome = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    const cloneId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
    useStore.setState((s) => {
      const clone: Project = JSON.parse(JSON.stringify(p))
      clone.id = cloneId
      clone.name = `${p.name} (copy)`
      clone.createdAt = Date.now()
      clone.updatedAt = Date.now()
      clone.wordLog = {}
      clone.wordLogStart = projectTotalWords(p)
      return { projects: [...s.projects, clone] }
    })
  }

  const continueWriting = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setActiveProject(p.id)
    // Deep-link to the last scene of the last chapter (skipping empty chapters).
    const lastChapter = [...p.chapters].reverse().find((c) => c.scenes.length > 0)
    const lastScene = lastChapter?.scenes[lastChapter.scenes.length - 1]
    if (lastScene) sessionStorage.setItem('tf-select-scene', lastScene.id)
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

      <div className="db-stats rise">
        <div className="db-stat">
          <b>{projects.length}</b>
          <span>tome{projects.length === 1 ? '' : 's'}</span>
        </div>
        <div className="db-stat">
          <b>{totalWords.toLocaleString()}</b>
          <span>total words</span>
        </div>
        <div className="db-stat">
          <b>{streak}</b>
          <span>day streak</span>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        <button
          className="btn primary"
          onClick={() => {
            setName('')
            setGenre('')
            setLogline('')
            setCreating(true)
          }}
        >
          ⊕ Forge New Tome
        </button>
      </div>

      <div className="grid-cards rise-1">
        {projects.map((p) => {
          const words = projectTotalWords(p)
          const spark = lastNDays(dailyWordsForProject(p), 14)
          return (
            <div
              key={p.id}
              className="card interactive db-card"
              onClick={() => open(p.id)}
              style={p.id === activeProjectId ? { borderColor: 'var(--ember)' } : undefined}
            >
              <div className="db-cover" style={coverStyle(p.name)}>
                <span className="db-cover-initials">{initials(p.name)}</span>
              </div>
              <div className="db-card-body">
                <div className="row between">
                  <span className="tag brass">{p.genre || 'fiction'}</span>
                  {p.id === activeProjectId && <span className="tag ember">active</span>}
                </div>
                <h3 style={{ margin: '10px 0 6px' }}>{p.name}</h3>
                <p className="muted" style={{ fontSize: 13.5, minHeight: 40 }}>
                  {p.logline || 'No logline yet.'}
                </p>
                <div className="db-spark-row">
                  <Sparkline values={spark} />
                  <span className="mono faint">
                    {p.chapters.length} ch · {words.toLocaleString()} words
                  </span>
                </div>
                <div className="divider" style={{ margin: '14px 0 12px' }} />
                <div className="row between">
                  <button className="btn small" onClick={(e) => continueWriting(e, p)}>
                    Continue writing →
                  </button>
                  <button
                    className="btn ghost small"
                    title="Edit title, genre, and logline"
                    onClick={(e) => startEdit(e, p)}
                  >
                    ✎
                  </button>
                  <button
                    className="btn ghost small"
                    title="Duplicate this tome — a full copy for experiments"
                    onClick={(e) => duplicateTome(e, p)}
                  >
                    ⧉
                  </button>
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
            </div>
          )
        })}
      </div>

      {editingProject && (
        <Modal title={`Edit "${editingProject.name}"`} onClose={() => setEditingId(null)}>
          <Field label="Title">
            <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Genre">
            <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} />
          </Field>
          <Field label="Logline">
            <textarea value={logline} onChange={(e) => setLogline(e.target.value)} />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={!name.trim()} onClick={saveEdit}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {creating && (
        <Modal title="Forge New Tome" onClose={() => setCreating(false)}>
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
            <InspireButton
              title="Stuck? Let the AI invent a title, genre, and logline"
              build={() => ({
                system:
                  'You invent striking, original novel concepts. Output EXACTLY three lines:\n' +
                  'TITLE: <the title>\nGENRE: <2-4 word genre>\nLOGLINE: <one-sentence logline with protagonist, conflict, stakes, hook>\n' +
                  'Nothing else. Avoid clichés and anything resembling existing famous works.',
                user:
                  name.trim() || genre.trim() || logline.trim()
                    ? `Build on what I have so far — title: "${name}", genre: "${genre}", logline: "${logline}". Fill or improve the rest.`
                    : 'Invent something I would never think of. Surprise me.',
                temperature: 1.05,
                maxTokens: 200,
              })}
              onText={(text) => {
                const grab = (label: string) =>
                  text.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'))?.[1]?.trim() ?? ''
                const t = grab('TITLE')
                const g = grab('GENRE')
                const l = grab('LOGLINE')
                if (t) setName(t)
                if (g) setGenre(g)
                if (l) setLogline(l)
              }}
            />
          </div>
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
