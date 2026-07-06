// GM protocol helper: builds the system prompt + message history for a
// StoryQuest turn, streams the narration, and parses the updated world state.

import type {
  Project,
  QuestCommand,
  QuestState,
  QuestWorldState,
  StyleProfile,
} from '../../types'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { extractJsonBlock, streamMessage } from '../../lib/ai'
import type { ChatMessage } from '../../lib/ai'
import { gmInstructionsFor } from './modes'

export const OPENING_INPUT = 'Begin the adventure. Set the opening scene.'

export interface PlayerInput {
  command: QuestCommand
  text: string
}

const GM_PREAMBLE =
  'You are the Game Master of an interactive text adventure. Narrate in second person ("you"), ' +
  'present the world vividly, and react honestly to the player\'s choices — consequence over ' +
  'convenience. Never speak for the player or decide their actions for them.'

const STATE_CONTRACT =
  'Respond with 1-3 paragraphs of second-person narration reacting to the player\'s action. ' +
  'Then, on a new line, output the complete updated world state as a fenced ```json code block ' +
  'matching the exact shape of CURRENT WORLD STATE (all keys present). The json block is mandatory.'

function buildGmDirective(quest: QuestState): string {
  return [
    GM_PREAMBLE,
    gmInstructionsFor(quest.mode),
    `PREMISE:\n${quest.premise}`,
    `PLAYER CHARACTER: ${quest.playerName}`,
    'CURRENT WORLD STATE:\n' + JSON.stringify(quest.state, null, 2),
    STATE_CONTRACT,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Map the recent quest log + new input into an alternating message array. */
function buildMessages(quest: QuestState, input: PlayerInput | null): ChatMessage[] {
  const mapped: ChatMessage[] = quest.log.slice(-20).map((turn) =>
    turn.role === 'player'
      ? { role: 'user', content: `[${turn.command ?? 'do'}] ${turn.text}` }
      : { role: 'assistant', content: turn.text },
  )
  mapped.push({
    role: 'user',
    content: input ? `[${input.command}] ${input.text}` : OPENING_INPUT,
  })

  // The API requires the conversation to open with a user turn; merge any
  // consecutive same-role turns (possible after aborted GM responses).
  if (mapped[0].role === 'assistant') {
    mapped.unshift({ role: 'user', content: OPENING_INPUT })
  }
  const merged: ChatMessage[] = []
  for (const msg of mapped) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) last.content += '\n' + msg.content
    else merged.push({ ...msg })
  }
  return merged
}

/** Remove the fenced json state block (even if unterminated) from narration. */
export function stripJsonBlock(text: string): string {
  return text
    .replace(/```json[\s\S]*?(?:```|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter((x): x is string | number => typeof x === 'string' || typeof x === 'number')
    .map(String)
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string' || typeof val === 'number') out[key] = String(val)
  }
  return out
}

/** Coerce parsed model output into a well-formed QuestWorldState, falling back per-key. */
export function normalizeWorldState(parsed: unknown, fallback: QuestWorldState): QuestWorldState {
  if (typeof parsed !== 'object' || parsed === null) return fallback
  const p = parsed as Record<string, unknown>
  return {
    location: typeof p.location === 'string' ? p.location : fallback.location,
    timeOfDay: typeof p.timeOfDay === 'string' ? p.timeOfDay : fallback.timeOfDay,
    weather: typeof p.weather === 'string' ? p.weather : fallback.weather,
    inventory: stringArray(p.inventory) ?? [...fallback.inventory],
    injuries: stringArray(p.injuries) ?? [...fallback.injuries],
    relationships: stringRecord(p.relationships) ?? { ...fallback.relationships },
    quests: stringArray(p.quests) ?? [...fallback.quests],
    secretsDiscovered: stringArray(p.secretsDiscovered) ?? [...fallback.secretsDiscovered],
    npcs: stringRecord(p.npcs) ?? { ...fallback.npcs },
  }
}

export interface GmTurnResult {
  narration: string
  /** Updated world state, or null when the model omitted / broke the json block. */
  state: QuestWorldState | null
}

export async function runGmTurn(opts: {
  project: Project
  styleProfile: StyleProfile | null
  quest: QuestState
  input: PlayerInput | null
  signal: AbortSignal
  onDelta: (chunk: string) => void
}): Promise<GmTurnResult> {
  const system = buildStoryContext(opts.project, opts.styleProfile, {
    recentText: tailOfManuscript(opts.project),
    taskDirective: buildGmDirective(opts.quest),
  })
  const full = await streamMessage({
    system,
    messages: buildMessages(opts.quest, opts.input),
    signal: opts.signal,
    onDelta: opts.onDelta,
  })
  const parsed = extractJsonBlock(full)
  return {
    narration: stripJsonBlock(full),
    state: parsed === null ? null : normalizeWorldState(parsed, opts.quest.state),
  }
}

/** Render the quest log as a plain transcript for prose conversion. */
export function questTranscript(quest: QuestState): string {
  return quest.log
    .map((turn) =>
      turn.role === 'player'
        ? `> [${(turn.command ?? 'do').toUpperCase()}] ${turn.text}`
        : turn.text,
    )
    .join('\n\n')
}

export async function convertQuestToProse(opts: {
  project: Project
  styleProfile: StyleProfile | null
  quest: QuestState
  signal: AbortSignal
  onDelta: (chunk: string) => void
}): Promise<string> {
  const pov = opts.styleProfile?.povLock.trim()
    ? opts.styleProfile.povLock
    : `third person limited (${opts.quest.playerName})`
  const directive = [
    'Convert the interactive adventure transcript in the user message into one polished, ' +
      'continuous prose scene worthy of the manuscript.',
    `Narrate in ${pov} — never second person. Fold the player's bracketed commands seamlessly ` +
      `into ${opts.quest.playerName}'s actions, thoughts, and dialogue.`,
    'Output only the finished prose. No headings, no commentary, no transcript artifacts.',
  ].join('\n')
  const system = buildStoryContext(opts.project, opts.styleProfile, {
    recentText: tailOfManuscript(opts.project),
    taskDirective: directive,
  })
  return streamMessage({
    system,
    messages: [
      {
        role: 'user',
        content: `ADVENTURE TRANSCRIPT:\n\n${questTranscript(opts.quest)}\n\nConvert this transcript into a single polished prose scene.`,
      },
    ],
    signal: opts.signal,
    onDelta: opts.onDelta,
  })
}
