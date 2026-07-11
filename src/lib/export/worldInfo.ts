// Export a tome's Codex as a SillyTavern World Info (lorebook) JSON.
// Uses ST's native shape: { entries: { "<n>": { uid, key[], content, … } } }.

import type { Project, STEntry } from '../../types'

interface WorldInfoSource {
  name: string
  keys: string[]
  secondaryKeys?: string[]
  content: string
  constant: boolean
  comment?: string
}

/** Build a SillyTavern-native World Info JSON from generic entries. */
export function entriesToWorldInfo(name: string, sources: WorldInfoSource[]): string {
  const entries: Record<string, unknown> = {}
  let n = 0
  for (const e of sources) {
    if (!e.content.trim()) continue
    entries[String(n)] = {
      uid: n,
      key: e.keys.slice(0, 10),
      keysecondary: e.secondaryKeys ?? [],
      comment: e.comment ?? e.name,
      content: e.content.trim(),
      constant: e.constant,
      selective: !!e.secondaryKeys?.length,
      order: 100 + n,
      position: 0,
      disable: false,
      addMemo: true,
      excludeRecursion: false,
      probability: 100,
      useProbability: true,
    }
    n++
  }
  return JSON.stringify({ entries, name }, null, 2)
}

export function codexToWorldInfo(project: Project): string {
  return entriesToWorldInfo(
    `${project.name} — TomeForge Codex`,
    project.codex.map((e) => ({
      name: e.name,
      keys: [e.name, ...e.aliases],
      secondaryKeys: e.secondaryKeys,
      content: e.content,
      constant: e.alwaysInclude,
      comment: `${e.name} [${e.type}]`,
    })),
  )
}

export function lorebookToWorldInfo(name: string, entries: STEntry[]): string {
  return entriesToWorldInfo(name, entries)
}
