import type { Project, StyleProfile } from '../../types'
import { streamMessage } from '../../lib/ai'
import { buildStoryContext } from '../../lib/context'
import { uid } from '../../lib/id'
import { useStore } from '../../store/useStore'

/**
 * Turn a Parlor/Salon transcript into a prose scene, appended to the tome as
 * a new chapter. Returns the chapter title it created.
 */
export async function chatToProseScene(
  project: Project,
  styleProfile: StyleProfile | null,
  transcript: string,
  label: string,
  signal?: AbortSignal,
): Promise<string> {
  const prose = await streamMessage({
    system: buildStoryContext(project, styleProfile, {
      taskDirective:
        'Rewrite the conversation transcript in the user message as a polished prose scene in ' +
        "this manuscript's voice and POV conventions: narration, beats, and attributed dialogue — " +
        'no script formatting, no speaker labels. Preserve everything said and its order; add ' +
        'connective interiority and staging sparingly. Output only the scene.',
    }),
    messages: [{ role: 'user', content: `TRANSCRIPT:\n${transcript}\n\nWrite the scene now.` }],
    temperature: 0.8,
    maxTokens: 2500,
    signal,
  })
  const title = `${label} — ${new Date().toLocaleDateString()}`
  useStore.getState().updateProject(project.id, (d) => {
    d.chapters.push({
      id: uid(),
      title,
      scenes: [{ id: uid(), title: label, content: prose.trim() }],
    })
  })
  return title
}
