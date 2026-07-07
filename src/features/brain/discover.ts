// Shared helper for the Story Brain's one-click "discover from manuscript"
// buttons (cast, timeline, threads): one AI pass → validated JSON array.

import type { Project, StyleProfile } from '../../types'
import { streamMessage, extractJsonBlock } from '../../lib/ai'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'

export async function discoverArray(
  project: Project,
  styleProfile: StyleProfile | null,
  taskDirective: string,
): Promise<Record<string, unknown>[]> {
  const manuscript = tailOfManuscript(project, 14000)
  const full = await streamMessage({
    system: buildStoryContext(project, styleProfile, {
      recentText: manuscript,
      taskDirective,
    }),
    messages: [
      {
        role: 'user',
        content: `MANUSCRIPT:\n${manuscript || '(empty)'}\n\nReturn the JSON array now.`,
      },
    ],
    temperature: 0.3,
    maxTokens: 2000,
  })
  const parsed = extractJsonBlock(full)
  if (!Array.isArray(parsed)) {
    throw new Error('The scan returned no readable list — try again.')
  }
  return parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
}

export const str = (v: unknown, cap = 500): string =>
  typeof v === 'string' ? v.slice(0, cap) : ''
