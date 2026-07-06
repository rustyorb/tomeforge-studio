import { useActiveProject, useProjectStyle } from '../../store/useStore'
import { EmptyState } from '../../components/ui'
import { SetupView } from './SetupView'
import { PlayView } from './PlayView'
import './storyquest.css'

export default function StoryQuestPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)

  if (!project) {
    return (
      <div className="page">
        <EmptyState glyph="✦" title="No active project">
          Open a tome from the Dashboard to begin a StoryQuest.
        </EmptyState>
      </div>
    )
  }

  return project.quest ? (
    <PlayView project={project} styleProfile={styleProfile} quest={project.quest} />
  ) : (
    <SetupView project={project} />
  )
}
