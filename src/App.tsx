import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useActiveProject } from './store/useStore'
import Dashboard from './features/dashboard'
import Manuscript from './features/manuscript'
import Brain from './features/brain'
import Forgebench from './features/forgebench'
import StoryQuest from './features/storyquest'
import Voiceprint from './features/voiceprint'
import SettingsPage from './features/settings'

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
      <div className="brand-sub">Studio · stories that remember</div>

      {link('/', '◈', 'Projects')}

      <div className="nav-section">Workshop</div>
      {link('/write', '✒', 'Manuscript', needsProject)}
      {link('/brain', '⁂', 'Story Brain', needsProject)}
      {link('/forgebench', '⚒', 'Forgebench', needsProject)}
      {link('/quest', '⚔', 'StoryQuest', needsProject)}

      <div className="nav-section">Voice</div>
      {link('/voiceprint', '❦', 'Voiceprint')}

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
    </nav>
  )
}

export default function App() {
  const project = useActiveProject()
  return (
    <div className="app-shell">
      <Nav />
      <main className="main-pane">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/write" element={project ? <Manuscript /> : <Navigate to="/" />} />
          <Route path="/brain" element={project ? <Brain /> : <Navigate to="/" />} />
          <Route path="/forgebench" element={project ? <Forgebench /> : <Navigate to="/" />} />
          <Route path="/quest" element={project ? <StoryQuest /> : <Navigate to="/" />} />
          <Route path="/voiceprint" element={<Voiceprint />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
