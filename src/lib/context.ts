import type { CodexEntry, Project, StyleProfile } from '../types'
import { getPreset } from './presets'

const CANON_DIRECTIVES: Record<Project['canonMode'], string> = {
  loose:
    'Canon mode: LOOSE. You may invent freely — new characters, places, and facts are welcome if they serve the story.',
  guided:
    'Canon mode: GUIDED. You may invent small supporting details, but you must preserve every major established fact, character trait, relationship, and world rule.',
  strict:
    'Canon mode: STRICT. Do not invent any new world facts, named characters, locations, or history. Work only with what is established. If the story needs something unknown, keep it vague rather than inventing.',
  sandbox:
    'Canon mode: SANDBOX. This is an experimental branch. Feel free to explore, but note this text is non-canonical.',
}

/** Find codex entries mentioned (by name or alias) in the given text. */
export function matchCodexEntries(codex: CodexEntry[], text: string): CodexEntry[] {
  const lower = text.toLowerCase()
  return codex.filter((entry) => {
    if (entry.alwaysInclude) return true
    const keys = [entry.name, ...entry.aliases].filter((k) => k.trim().length > 1)
    return keys.some((k) => lower.includes(k.toLowerCase()))
  })
}

function describeStyle(profile: StyleProfile | null): string {
  if (!profile) return ''
  const c = profile.controls
  const dial = (label: string, v: number, low: string, high: string) => {
    if (v <= 2) return `${label}: very ${low}`
    if (v <= 4) return `${label}: ${low}-leaning`
    if (v >= 8) return `${label}: very ${high}`
    if (v >= 6) return `${label}: ${high}-leaning`
    return null
  }
  const dials = [
    dial('Prose density', c.proseDensity, 'spare', 'dense'),
    dial('Vocabulary', c.vocabulary, 'plain', 'elevated'),
    dial('Dialogue frequency', c.dialogueFrequency, 'sparse', 'abundant'),
    dial('Interior monologue', c.interiorMonologue, 'minimal', 'deep'),
    dial('Humor', c.humor, 'absent', 'prominent'),
    dial('Darkness', c.darkness, 'light', 'dark'),
    dial('Romance', c.romance, 'absent', 'central'),
    dial('Violence', c.violence, 'bloodless', 'graphic'),
    dial('Surrealism', c.surrealism, 'grounded', 'dreamlike'),
  ].filter(Boolean)
  const lines = [
    `STYLE PROFILE — ${profile.name}`,
    profile.description,
    `Pacing: ${c.pacing}.`,
    dials.length ? dials.join('; ') + '.' : '',
    profile.povLock ? `POV LOCK: narrate strictly in ${profile.povLock}. Never shift perspective.` : '',
    profile.tenseLock ? `TENSE LOCK: write strictly in ${profile.tenseLock}. Never drift.` : '',
    profile.voiceNotes ? `Voice notes: ${profile.voiceNotes}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

export interface ContextOptions {
  /** Recent manuscript text used for codex keyword matching */
  recentText?: string
  /** Extra task-specific instruction appended near the end */
  taskDirective?: string
  /** Override the project preset */
  presetId?: string
  /** Include full cast ledger cards */
  includeCast?: boolean
}

/**
 * Assemble the Story Brain system prompt: identity, canon mode, memory,
 * matched codex entries, cast cards, style profile, preset directive, and
 * the Director's Note last (strongest recency effect).
 */
export function buildStoryContext(
  project: Project,
  styleProfile: StyleProfile | null,
  opts: ContextOptions = {},
): string {
  const preset = getPreset(opts.presetId ?? project.presetId)
  const parts: string[] = []

  parts.push(
    'You are the co-writer engine of TomeForge Studio, a fiction-first writing environment. ' +
      'You stay inside the fiction: no assistant chatter, no lectures, no meta-commentary, no headings. ' +
      'Output only what was asked for — usually story prose. Match the manuscript\'s voice, diction, ' +
      'rhythm, dialogue density, and descriptive texture exactly.',
  )

  parts.push(`PROJECT: "${project.name}" — ${project.genre || 'fiction'}. ${project.logline}`)
  parts.push(CANON_DIRECTIVES[project.canonMode])

  if (project.memory.trim()) {
    parts.push(`CONTINUITY CORE (current story direction — always honor this):\n${project.memory.trim()}`)
  }

  const matched = matchCodexEntries(project.codex, opts.recentText ?? '')
  if (matched.length) {
    const lore = matched
      .map((e) => `• ${e.name} [${e.type}]: ${e.content.trim()}`)
      .join('\n')
    parts.push(`CODEX (established canon — never contradict):\n${lore}`)
  }

  if (opts.includeCast !== false && project.characters.length) {
    const cast = project.characters
      .map((ch) => {
        const bits = [
          ch.location && `at ${ch.location}`,
          ch.goal && `goal: ${ch.goal}`,
          ch.emotionalState && `feeling: ${ch.emotionalState}`,
          ch.injuries && `injuries: ${ch.injuries}`,
          ch.secrets && `knows secretly: ${ch.secrets}`,
          ch.voiceNotes && `voice: ${ch.voiceNotes}`,
          ch.forbidden && `NEVER: ${ch.forbidden}`,
        ].filter(Boolean)
        return `• ${ch.name} — ${bits.join('; ')}`
      })
      .join('\n')
    parts.push(`CAST LEDGER (current character states):\n${cast}`)
  }

  const style = describeStyle(styleProfile)
  if (style) parts.push(style)

  parts.push(`PRESET — ${preset.name}: ${preset.directive}`)

  if (opts.taskDirective) parts.push(`TASK:\n${opts.taskDirective}`)

  if (project.authorNote.trim()) {
    parts.push(`DIRECTOR'S NOTE (highest priority for the next output):\n${project.authorNote.trim()}`)
  }

  return parts.join('\n\n')
}

/** Last N characters of the manuscript, for context windows. */
export function tailOfManuscript(project: Project, chars = 6000): string {
  const all = project.chapters
    .flatMap((c) => c.scenes.map((s) => s.content))
    .join('\n\n')
  return all.slice(-chars)
}
