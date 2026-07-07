import { useState } from 'react'
import type { Project, QuestMode } from '../../types'
import { useStore } from '../../store/useStore'
import { Field } from '../../components/ui'
import { InspireButton } from '../../components/InspireButton'
import { buildStoryContext } from '../../lib/context'
import { QUEST_MODES } from './modes'

export function SetupView(props: { project: Project }) {
  const { project } = props
  const updateProject = useStore((s) => s.updateProject)
  const [mode, setMode] = useState<QuestMode>('novel')
  const [playerName, setPlayerName] = useState('')
  const [premise, setPremise] = useState(() =>
    `${project.logline}\n${project.memory}`.trim(),
  )

  const begin = () => {
    updateProject(project.id, (draft) => {
      draft.quest = {
        mode,
        playerName: playerName.trim(),
        premise: premise.trim(),
        log: [],
        state: {
          location: '',
          timeOfDay: '',
          weather: '',
          inventory: [],
          injuries: [],
          relationships: {},
          quests: [],
          secretsDiscovered: [],
          npcs: {},
        },
      }
    })
    // PlayView mounts once quest exists and requests the opening narration.
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">StoryQuest</div>
        <h1>Begin an Adventure</h1>
        <p className="sub">
          Play your story instead of writing it. Choose how the Game Master should run the
          world, name your character, and step in. Convert the best runs into manuscript
          prose whenever you like.
        </p>
      </header>

      <div className="rise-1">
        <div className="kicker" style={{ marginBottom: 10 }}>GM Mode</div>
        <div className="sq-mode-grid">
          {QUEST_MODES.map((m) => (
            <div
              key={m.id}
              className={`sq-mode-card ${mode === m.id ? 'selected' : ''}`}
              onClick={() => setMode(m.id)}
            >
              <div className="sq-mode-glyph">{m.glyph}</div>
              <div className="sq-mode-title">{m.title}</div>
              <div className="sq-mode-tagline">{m.tagline}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card rise-2" style={{ maxWidth: 720 }}>
        <Field label="Player Name" hint="Who are you inside the story?">
          <input
            type="text"
            value={playerName}
            placeholder="Mara of the Ninth Lantern"
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </Field>
        <Field
          label="Premise"
          hint="Where the adventure starts. Prefilled from the project's logline and continuity core."
        >
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
            <InspireButton
              title="Draft an adventure premise from this tome's Story Brain"
              build={() => ({
                system: buildStoryContext(project, null, {
                  taskDirective:
                    `Draft a compelling ${mode}-mode text-adventure premise for the player (2-4 sentences): ` +
                    'where they stand as it begins, what presses on them, and the first choice looming. ' +
                    'Second person. Output only the premise.',
                }),
                user: 'Write the premise now.',
                maxTokens: 250,
              })}
              onText={setPremise}
            />
          </div>
          <textarea
            value={premise}
            rows={5}
            onChange={(e) => setPremise(e.target.value)}
          />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn primary"
            disabled={!playerName.trim() || !premise.trim()}
            onClick={begin}
          >
            Begin Adventure
          </button>
        </div>
      </div>
    </div>
  )
}
