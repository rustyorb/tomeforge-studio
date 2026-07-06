import { useState } from 'react'
import { useActiveProject, useProjectStyle } from '../../store/useStore'
import { EmptyState, Tabs } from '../../components/ui'
import ContinuityCoreTab from './ContinuityCoreTab'
import CodexTab from './CodexTab'
import CastTab from './CastTab'
import ThreadmapTab from './ThreadmapTab'
import ChronicleTab from './ChronicleTab'
import ContinuityCheckTab from './ContinuityCheckTab'
import './brain.css'

const TABS = [
  { id: 'core', label: 'Continuity Core' },
  { id: 'codex', label: 'Codex' },
  { id: 'cast', label: 'Cast Ledger' },
  { id: 'threads', label: 'Threadmap' },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'check', label: 'Continuity Check' },
]

export default function BrainPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)
  const [tab, setTab] = useState('core')

  if (!project) {
    return (
      <div className="page">
        <EmptyState glyph="◈" title="No active project">
          The Story Brain needs a tome to think about. Open one from the Archive first.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">Story Brain</div>
        <h1>{project.name}</h1>
        <p className="sub">
          Everything the AI knows about this story — its living memory, canon, cast, planted
          threads, and chronology. Keep the brain sharp and the prose stays consistent.
        </p>
      </header>

      <Tabs tabs={TABS} active={tab} onSelect={setTab} />

      {tab === 'core' && <ContinuityCoreTab project={project} />}
      {tab === 'codex' && <CodexTab project={project} styleProfile={styleProfile} />}
      {tab === 'cast' && <CastTab project={project} styleProfile={styleProfile} />}
      {tab === 'threads' && <ThreadmapTab project={project} styleProfile={styleProfile} />}
      {tab === 'chronicle' && <ChronicleTab project={project} />}
      {tab === 'check' && <ContinuityCheckTab project={project} styleProfile={styleProfile} />}
    </div>
  )
}
