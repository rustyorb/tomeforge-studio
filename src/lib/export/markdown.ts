// ---------- Markdown / plain-text export (pure functions, no React) ----------

import type {
  CharacterCard,
  CodexEntry,
  CodexType,
  PlotThread,
  Project,
  StyleProfile,
} from '../../types'
import { CODEX_TYPES } from '../../types'

export interface MarkdownOptions {
  author: string
  /** Include scene summaries (italicized) before each scene's prose. */
  includeSynopsis: boolean
  /** Set false to omit the '***' separators between scenes. Default true. */
  sceneSeparators?: boolean
}

/** Count words in a text (whitespace-delimited). */
export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** Total manuscript word count across all chapters and scenes. */
export function projectWordCount(project: Project): number {
  return project.chapters.reduce(
    (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + countWords(sc.content), 0),
    0,
  )
}

/** Compile the manuscript to Markdown with a front matter block. */
export function projectToMarkdown(project: Project, opts: MarkdownOptions): string {
  const sep = opts.sceneSeparators === false ? '\n\n' : '\n\n***\n\n'
  const out: string[] = []

  out.push('---')
  out.push(`title: ${project.name}`)
  if (opts.author.trim()) out.push(`author: ${opts.author.trim()}`)
  if (project.genre.trim()) out.push(`genre: ${project.genre.trim()}`)
  if (project.logline.trim()) out.push(`logline: ${project.logline.trim()}`)
  out.push(`words: ${projectWordCount(project)}`)
  out.push(`exported: ${new Date().toISOString().slice(0, 10)}`)
  out.push('---', '')
  out.push(`# ${project.name}`)

  for (const chapter of project.chapters) {
    out.push('', `## ${chapter.title}`, '')
    const scenes = chapter.scenes
      .map((sc) => {
        const parts: string[] = []
        if (opts.includeSynopsis && sc.summary?.trim()) parts.push(`*${sc.summary.trim()}*`)
        if (sc.content.trim()) parts.push(sc.content.trim())
        return parts.join('\n\n')
      })
      .filter(Boolean)
    if (scenes.length) out.push(scenes.join(sep))
  }
  return out.join('\n') + '\n'
}

/** Compile the manuscript to unadorned plain text. */
export function projectToText(project: Project): string {
  const out: string[] = [project.name]
  if (project.genre.trim()) out.push(project.genre.trim())
  for (const chapter of project.chapters) {
    out.push('', '', chapter.title, '─'.repeat(Math.max(chapter.title.length, 3)), '')
    const scenes = chapter.scenes.map((sc) => sc.content.trim()).filter(Boolean)
    if (scenes.length) out.push(scenes.join('\n\n* * *\n\n'))
  }
  return out.join('\n') + '\n'
}

// ---------- Story Bible ----------

const CARD_FIELDS: ReadonlyArray<
  readonly [string, Exclude<keyof CharacterCard, 'id' | 'name'>]
> = [
  ['Location', 'location'],
  ['Goal', 'goal'],
  ['Secrets', 'secrets'],
  ['Injuries', 'injuries'],
  ['Relationships', 'relationships'],
  ['Emotional state', 'emotionalState'],
  ['Arc stage', 'arcStage'],
  ['Last appearance', 'lastAppearance'],
  ['Voice notes', 'voiceNotes'],
  ['Forbidden', 'forbidden'],
]

const THREAD_GROUPS: ReadonlyArray<readonly [PlotThread['status'], string]> = [
  ['open', 'Open'],
  ['paidoff', 'Paid Off'],
  ['abandoned', 'Abandoned'],
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function codexEntryMd(entry: CodexEntry, out: string[]): void {
  out.push(`#### ${entry.name}`, '')
  const meta: string[] = []
  if (entry.aliases.length) meta.push(`Aliases: ${entry.aliases.join(', ')}`)
  if (entry.alwaysInclude) meta.push('Always in context')
  if (meta.length) out.push(meta.join(' · '), '')
  out.push(entry.content.trim() || '_No details recorded._', '')
}

/**
 * The full Story Bible as Markdown: continuity core, director's note,
 * codex (grouped by type), cast ledger, threadmap, chronicle, notes,
 * and the assigned style profile (if any).
 */
export function storyBibleToMarkdown(
  project: Project,
  styleProfile: StyleProfile | null,
): string {
  const out: string[] = []

  out.push(`# ${project.name} — Story Bible`, '')
  const head: string[] = []
  if (project.genre.trim()) head.push(project.genre.trim())
  if (project.logline.trim()) head.push(project.logline.trim())
  if (head.length) out.push(head.join(' — '), '')
  out.push(
    `Exported ${new Date().toISOString().slice(0, 10)} · ` +
      `${project.chapters.length} chapters · ${projectWordCount(project)} words in manuscript`,
    '',
  )

  out.push('## Continuity Core', '', project.memory.trim() || '_Nothing recorded._', '')
  out.push("## Director's Note", '', project.authorNote.trim() || '_Nothing recorded._', '')

  out.push('## Codex', '')
  if (project.codex.length === 0) {
    out.push('_No codex entries._', '')
  } else {
    const byType = new Map<CodexType, CodexEntry[]>()
    for (const entry of project.codex) {
      const list = byType.get(entry.type)
      if (list) list.push(entry)
      else byType.set(entry.type, [entry])
    }
    for (const type of CODEX_TYPES) {
      const entries = byType.get(type)
      if (!entries) continue
      out.push(`### ${capitalize(type)}`, '')
      for (const entry of entries) codexEntryMd(entry, out)
    }
  }

  out.push('## Cast Ledger', '')
  if (project.characters.length === 0) {
    out.push('_No character cards._', '')
  } else {
    for (const card of project.characters) {
      out.push(`### ${card.name}`, '')
      for (const [label, key] of CARD_FIELDS) {
        out.push(label, `: ${card[key].trim() || '—'}`, '')
      }
    }
  }

  out.push('## Threadmap', '')
  if (project.threads.length === 0) {
    out.push('_No plot threads._', '')
  } else {
    for (const [status, label] of THREAD_GROUPS) {
      const threads = project.threads.filter((t) => t.status === status)
      if (!threads.length) continue
      out.push(`### ${label}`, '')
      for (const t of threads) {
        out.push(`#### ${t.title} (${t.kind})`, '')
        out.push(`- Introduced: ${t.chapterIntroduced.trim() || '—'}`)
        out.push(`- Setup: ${t.setup.trim() || '—'}`)
        out.push(`- Payoff notes: ${t.payoffNotes.trim() || '—'}`, '')
      }
    }
  }

  out.push('## Chronicle', '')
  if (project.timeline.length === 0) {
    out.push('_No timeline events._', '')
  } else {
    const events = [...project.timeline].sort((a, b) => a.order - b.order)
    events.forEach((ev, i) => {
      const when = ev.when.trim() ? ` — ${ev.when.trim()}` : ''
      out.push(`${i + 1}. **${ev.title}**${when}`)
      if (ev.location.trim()) out.push(`   - Location: ${ev.location.trim()}`)
      if (ev.characters.trim()) out.push(`   - Characters: ${ev.characters.trim()}`)
      if (ev.chapterRef.trim()) out.push(`   - Chapter: ${ev.chapterRef.trim()}`)
      if (ev.notes.trim()) out.push(`   - Notes: ${ev.notes.trim()}`)
    })
    out.push('')
  }

  out.push('## Notes', '', project.notes.trim() || '_Nothing recorded._', '')

  out.push('## Style Profile', '')
  if (!styleProfile) {
    out.push('_No style profile assigned._', '')
  } else {
    out.push(`### ${styleProfile.name}`, '')
    if (styleProfile.description.trim()) out.push(styleProfile.description.trim(), '')
    const c = styleProfile.controls
    out.push(`- POV lock: ${styleProfile.povLock.trim() || 'none'}`)
    out.push(`- Tense lock: ${styleProfile.tenseLock.trim() || 'none'}`)
    out.push(`- Pacing: ${c.pacing}`)
    out.push(
      `- Dials (0–10): prose density ${c.proseDensity}, vocabulary ${c.vocabulary}, ` +
        `dialogue ${c.dialogueFrequency}, interior monologue ${c.interiorMonologue}, ` +
        `humor ${c.humor}, darkness ${c.darkness}, romance ${c.romance}, ` +
        `violence ${c.violence}, surrealism ${c.surrealism}`,
    )
    if (styleProfile.voiceNotes.trim()) {
      out.push('', `Voice notes: ${styleProfile.voiceNotes.trim()}`)
    }
    out.push('')
  }

  return out.join('\n')
}
