import { useStore } from '../../store/useStore'
import type { CanonMode, Project } from '../../types'
import { Field } from '../../components/ui'
import { InspireButton } from '../../components/InspireButton'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'

const CANON_OPTIONS: { mode: CanonMode; title: string; desc: string }[] = [
  { mode: 'loose', title: 'Loose', desc: 'Invent freely — new characters, places, and facts are welcome.' },
  { mode: 'guided', title: 'Guided', desc: 'Small inventions allowed, but every major fact is preserved.' },
  { mode: 'strict', title: 'Strict', desc: 'No new world facts. Only what is already established.' },
  { mode: 'sandbox', title: 'Sandbox', desc: 'Experimental branch — nothing written here is canonical.' },
]

export default function ContinuityCoreTab({ project }: { project: Project }) {
  const updateProject = useStore((s) => s.updateProject)

  return (
    <div className="stack rise">
      <div className="card">
        <div className="kicker" style={{ marginBottom: 10 }}>Working Memory</div>
        <Field
          label="Memory"
          hint="The always-honored current story direction. Injected into every generation, no matter what."
        >
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
            <InspireButton
              title="Draft the memory from the manuscript and codex"
              build={() => ({
                system: buildStoryContext(project, null, {
                  recentText: tailOfManuscript(project, 8000),
                  taskDirective:
                    'Draft a Continuity Core memory for this story (4-7 sentences, present tense): ' +
                    'the current plot goal, the immediate conflict, key recent events, the emotional temperature, ' +
                    'and 1-2 hard rules the AI must not break (secrets not yet revealed, etc). Output only the memory text.',
                }),
                user: 'Draft the memory now.',
                maxTokens: 350,
                temperature: 0.5,
              })}
              onText={(t) => updateProject(project.id, (d) => { d.memory = t })}
            />
          </div>
          <textarea
            rows={7}
            value={project.memory}
            placeholder="Mara has taken the lighthouse keeper's oath. The tide-cult knows her name now…"
            onChange={(e) => updateProject(project.id, (d) => { d.memory = e.target.value })}
          />
        </Field>
        <Field
          label="Director's Note"
          hint={'Strongest steering for the next generation — placed last in the prompt. e.g. "[Style: dark fantasy, slow pace, rising dread]"'}
        >
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
            <InspireButton
              title="Suggest a Director's Note matching the manuscript's voice"
              build={() => ({
                system: buildStoryContext(project, null, {
                  recentText: tailOfManuscript(project, 6000),
                  taskDirective:
                    'Write a one-line Director\'s Note in the bracket style "[Style: …]" — 6-10 comma-separated style/mood/pacing directives that match and sharpen this manuscript\'s existing voice. Output only the bracketed line.',
                }),
                user: 'Write the note now.',
                maxTokens: 100,
                temperature: 0.7,
              })}
              onText={(t) => updateProject(project.id, (d) => { d.authorNote = t })}
            />
          </div>
          <textarea
            rows={3}
            value={project.authorNote}
            placeholder="[Style: dark fantasy, slow pace, rising dread]"
            onChange={(e) => updateProject(project.id, (d) => { d.authorNote = e.target.value })}
          />
        </Field>
      </div>

      <div className="card">
        <div className="kicker" style={{ marginBottom: 10 }}>Canon Lock</div>
        <div className="br-canon-grid">
          {CANON_OPTIONS.map((opt) => (
            <div
              key={opt.mode}
              className={`card interactive br-canon-card ${project.canonMode === opt.mode ? 'br-selected' : ''}`}
              onClick={() => updateProject(project.id, (d) => { d.canonMode = opt.mode })}
            >
              <div className="row between">
                <h3>{opt.title}</h3>
                {project.canonMode === opt.mode && <span className="tag ember">on</span>}
              </div>
              <div className="br-canon-desc">{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="kicker" style={{ marginBottom: 10 }}>Scriptorium</div>
        <Field label="Project Notes" hint="Private scratch space. Never sent to the AI.">
          <textarea
            rows={6}
            value={project.notes}
            placeholder="Loose ideas, research, reminders…"
            onChange={(e) => updateProject(project.id, (d) => { d.notes = e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
