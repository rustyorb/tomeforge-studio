// Shared, pure calculations for the Observatory (insights) and Dashboard.
// The store logs wordLog[YYYY-MM-DD] = highest TOTAL manuscript word count
// observed that day (UTC keys via toISOString). Words written on day D =
// wordLog[D] - max(wordLog[d] for all earlier d), clamped >= 0.

import type { Project } from '../../types'

const DAY_MS = 86_400_000

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** YYYY-MM-DD (UTC) — matches the store's wordLog key convention. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export function projectTotalWords(project: Project): number {
  return project.chapters.reduce(
    (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + wordCount(sc.content), 0),
    0,
  )
}

/** Words written per day for one project, derived from its wordLog. */
export function dailyWordsForProject(project: Project): Record<string, number> {
  const log = project.wordLog
  if (!log) return {}
  const days = Object.keys(log).sort()
  const out: Record<string, number> = {}
  let runningMax = 0
  for (const day of days) {
    const total = log[day] ?? 0
    out[day] = Math.max(0, total - runningMax)
    runningMax = Math.max(runningMax, total)
  }
  return out
}

/** Words written per day summed across all projects. */
export function combinedDaily(projects: Project[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of projects) {
    const daily = dailyWordsForProject(p)
    for (const day in daily) out[day] = (out[day] ?? 0) + daily[day]
  }
  return out
}

/** Consecutive days with >0 words, ending today or yesterday. */
export function currentStreak(daily: Record<string, number>): number {
  const now = Date.now()
  let offset = -1
  if ((daily[dayKey(now)] ?? 0) > 0) offset = 0
  else if ((daily[dayKey(now - DAY_MS)] ?? 0) > 0) offset = 1
  if (offset < 0) return 0
  let streak = 0
  while ((daily[dayKey(now - (offset + streak) * DAY_MS)] ?? 0) > 0) streak++
  return streak
}

/** Words written since Monday of the current week (inclusive of today). */
export function wordsThisWeek(daily: Record<string, number>): number {
  const now = Date.now()
  const mondayIndex = (new Date(now).getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  let sum = 0
  for (let i = 0; i <= mondayIndex; i++) sum += daily[dayKey(now - i * DAY_MS)] ?? 0
  return sum
}

/** Daily word values for the last n days, oldest first (today last). */
export function lastNDays(daily: Record<string, number>, n: number): number[] {
  const now = Date.now()
  const out: number[] = []
  for (let i = n - 1; i >= 0; i--) out.push(daily[dayKey(now - i * DAY_MS)] ?? 0)
  return out
}

export function bestDay(daily: Record<string, number>): { day: string; words: number } | null {
  let best: { day: string; words: number } | null = null
  for (const [day, words] of Object.entries(daily)) {
    if (words > 0 && (!best || words > best.words)) best = { day, words }
  }
  return best
}

/** 'Mar 3 — 1,240 words' — heatmap tooltip text. */
export function dayTitle(key: string, words: number): string {
  const d = new Date(key + 'T00:00:00Z')
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} — ${words.toLocaleString()} words`
}

/** Relative 'last touched' label for a timestamp. */
export function relativeDate(ts: number): string {
  const days = Math.floor((Date.now() - ts) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------- curated palette (covers + relation web groups) ----------

export const PALETTE = [
  '#e0763a', // ember
  '#c9a35c', // brass
  '#6fae9b', // verdigris
  '#a34434', // oxblood
  '#5b6ee1', // indigo
  '#9a5b8f', // plum
] as const

/** Deterministic djb2 hash → unsigned 32-bit int. */
export function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}
