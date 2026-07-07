// Shared helper for the Story Brain's one-click "discover from manuscript"
// buttons (cast, timeline, threads): one AI pass → validated JSON array.
//
// Deliberately does NOT use buildStoryContext: the fiction-engine persona
// ("output only story prose", voiceprint, preset, Director's Note injected
// last) actively fights structured-output instructions and made the model
// answer in prose. Extraction gets a clean extractor persona instead.

import type { Project, StyleProfile } from '../../types'
import { streamMessage } from '../../lib/ai'
import { tailOfManuscript } from '../../lib/context'

/** Forgiving JSON reader: fenced block (any tag), raw text, or bracket scan. */
function looseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  for (const candidate of [fenced?.[1], text]) {
    if (!candidate) continue
    const trimmed = candidate.trim()
    try {
      return JSON.parse(trimmed)
    } catch {
      /* fall through to bracket scan */
    }
    const start = trimmed.search(/[[{]/)
    if (start >= 0) {
      const close = trimmed[start] === '[' ? ']' : '}'
      const end = trimmed.lastIndexOf(close)
      if (end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1))
        } catch {
          /* keep trying */
        }
      }
    }
  }
  return null
}

export async function discoverArray(
  project: Project,
  _styleProfile: StyleProfile | null,
  taskDirective: string,
): Promise<Record<string, unknown>[]> {
  const manuscript = tailOfManuscript(project, 14000)
  const full = await streamMessage({
    system:
      'You are a structured-data extraction engine for a fiction studio. You read manuscript ' +
      'text and respond with ONLY a fenced ```json code block containing an array — no prose ' +
      'before or after it, no commentary, no apologies. If nothing qualifies, return ```json\n[]\n```.\n\n' +
      `TASK:\n${taskDirective}`,
    messages: [
      {
        role: 'user',
        content: `MANUSCRIPT:\n${manuscript || '(empty)'}\n\nReturn the JSON array now.`,
      },
    ],
    temperature: 0.2,
    maxTokens: 2500,
  })

  const parsed = looseJson(full)
  // Accept a bare array, or unwrap {"characters": [...]}-style objects.
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? (Object.values(parsed as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? null
      : null
  if (!arr) {
    const said = full.trim().replace(/\s+/g, ' ').slice(0, 200)
    throw new Error(`Could not read the scan result. The model said: "${said}…" — try again.`)
  }
  return arr.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
}

export const str = (v: unknown, cap = 500): string =>
  typeof v === 'string' ? v.slice(0, cap) : ''
