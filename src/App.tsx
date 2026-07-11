import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { STORAGE_EVENT, useActiveProject, useStore } from './store/useStore'
import { useSettings } from './store/useSettings'
import CommandPalette, { OPEN_PALETTE_EVENT } from './features/palette/CommandPalette'
import ShortcutsHelp from './features/palette/ShortcutsHelp'
import Welcome from './features/palette/Welcome'
import Dashboard from './features/dashboard'
import Manuscript from './features/manuscript'
import Brain from './features/brain'
import Forgebench from './features/forgebench'
import StoryQuest from './features/storyquest'
import Voiceprint from './features/voiceprint'
import SettingsPage from './features/settings'
import Exporter from './features/exporter'
import Insights from './features/insights'
import GoalRing from './features/goals/GoalRing'
import { APP_VERSION } from './version'
import SillyTavern from './features/sillytavern'
import Parlor from './features/parlor'
import Atlas from './features/atlas'
import WorkflowForge from './features/workflowforge'

function Nav() {
  const project = useActiveProject()
  const link = (to: string, glyph: string, label: string, disabled = false) =>
    disabled ? (
      <span className="nav-link" style={{ opacity: 0.35, cursor: 'not-allowed' }}>
        <span className="glyph">{glyph}</span> {label}
      </span>
    ) : (
      <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <span className="glyph">{glyph}</span> {label}
      </NavLink>
    )

  const needsProject = !project
  return (
    <nav className="sidebar">
      <div className="brand">
        Tome<span className="forge">Forge</span>
      </div>
      <div className="brand-sub">Studio · stories that remember · v{APP_VERSION}</div>

      {link('/', '◈', 'Projects')}

      <div className="nav-section">Workshop</div>
      {link('/write', '✒', 'Manuscript', needsProject)}
      {link('/brain', '⁂', 'Story Brain', needsProject)}
      {link('/forgebench', '⚒', 'Forgebench', needsProject)}
      {link('/quest', '⚔', 'StoryQuest', needsProject)}
      {link('/parlor', '❝', 'The Parlor', needsProject)}

      <div className="nav-section">The World</div>
      {link('/atlas', '🗺', 'The Atlas', needsProject)}

      <div className="nav-section">The Rig</div>
      {link('/workflowforge', '⛭', 'Workflow Forge')}

      <div className="nav-section">Voice</div>
      {link('/voiceprint', '❦', 'Voiceprint')}

      <div className="nav-section">Observatory</div>
      {link('/insights', '◍', 'Insights')}
      {link('/export', '⇲', 'Import & Export')}
      {link('/sillytavern', '❖', 'SillyTavern')}

      <div className="nav-section">System</div>
      {link('/settings', '⚙', 'Settings')}

      {project && (
        <div style={{ marginTop: 'auto', padding: '14px 10px 4px' }}>
          <div className="kicker">Active Tome</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginTop: 3 }}>
            {project.name}
          </div>
        </div>
      )}
      <div style={{ marginTop: project ? 0 : 'auto', padding: '0 10px' }}>
        <GoalRing />
      </div>
      <div style={{ marginTop: project ? 8 : 'auto', padding: '10px 10px 4px' }}>
        <button
          className="pal-side-hint"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
        >
          ⌘K — command deck
        </button>
      </div>
    </nav>
  )
}

/** Fixed warning shown while localStorage writes are failing (quota full). */
function StorageWarning() {
  const [failing, setFailing] = useState(false)
  useEffect(() => {
    const onEvent = (e: Event) => setFailing(!(e as CustomEvent<{ ok: boolean }>).detail.ok)
    window.addEventListener(STORAGE_EVENT, onEvent)
    return () => window.removeEventListener(STORAGE_EVENT, onEvent)
  }, [])
  if (!failing) return null
  return (
    <div
      className="error-banner"
      style={{ position: 'fixed', bottom: 14, right: 18, zIndex: 200, maxWidth: 420 }}
    >
      Browser storage is full — recent changes are <strong>not being saved</strong>. Copy your
      work out or delete an old project, then keep writing.
    </div>
  )
}

export default function App() {
  const project = useActiveProject()
  const theme = useSettings((s) => s.theme)
  const projects = useStore((s) => s.projects)
  const setActiveProject = useStore((s) => s.setActiveProject)

  // Themes override CSS custom properties via [data-theme] on <html>.
  // 'ember' is the :root default, so the attribute is redundant but harmless.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Auto-select the most recently touched tome whenever none is active (fresh
  // load, or after the active one was deleted). Without this the workshop nav
  // sits greyed out even though a project is right there. Only a truly empty
  // archive leaves the workshop disabled.
  useEffect(() => {
    if (!project && projects.length) {
      const mostRecent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      setActiveProject(mostRecent.id)
    }
  }, [project, projects, setActiveProject])

  return (
    <div className="app-shell">
      <Nav />
      <StorageWarning />
      <CommandPalette />
      <ShortcutsHelp />
      <Welcome />
      <main className="main-pane">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/write" element={project ? <Manuscript /> : <Navigate to="/" />} />
          <Route path="/brain" element={project ? <Brain /> : <Navigate to="/" />} />
          <Route path="/forgebench" element={project ? <Forgebench /> : <Navigate to="/" />} />
          <Route path="/quest" element={project ? <StoryQuest /> : <Navigate to="/" />} />
          <Route path="/parlor" element={project ? <Parlor /> : <Navigate to="/" />} />
          <Route path="/atlas" element={project ? <Atlas /> : <Navigate to="/" />} />
          <Route path="/workflowforge" element={<WorkflowForge />} />
          <Route path="/voiceprint" element={<Voiceprint />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/export" element={<Exporter />} />
          <Route path="/sillytavern" element={<SillyTavern />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
