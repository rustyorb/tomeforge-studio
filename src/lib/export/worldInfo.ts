// Export a tome's Codex as a SillyTavern World Info (lorebook) JSON.
// Uses ST's native shape: { entries: { "<n>": { uid, key[], content, … } } }.

import type { Project } from '../../types'

export function codexToWorldInfo(project: Project): string {
  const entries: Record<string, unknown> = {}
  let n = 0
  for (const e of project.codex) {
    if (!e.content.trim()) continue
    entries[String(n)] = {
      uid: n,
      key: [e.name, ...e.aliases].slice(0, 10),
      keysecondary: [],
      comment: `${e.name} [${e.type}]`,
      content: e.content.trim(),
      constant: e.alwaysInclude,
      selective: false,
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
  return JSON.stringify({ entries, name: `${project.name} — TomeForge Codex` }, null, 2)
}
