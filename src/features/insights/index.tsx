import { useMemo } from 'react'
import { useActiveProject, useStore } from '../../store/useStore'
import type { Project } from '../../types'
import { EmptyState } from '../../components/ui'
import { Sparkline } from './Sparkline'
import {
  MONTHS,
  bestDay,
  combinedDaily,
  currentStreak,
  dailyWordsForProject,
  dayKey,
  dayTitle,
  lastNDays,
  projectTotalWords,
  relativeDate,
  wordCount,
  wordsThisWeek,
} from './stats'
import './insights.css'

const DAY_MS = 86_400_000
const WEEKS = 17

// ---------- writing heatmap ----------

function Heatmap(props: { daily: Record<string, number> }) {
  const { daily } = props
  const now = Date.now()
  const mondayIndex = (new Date(now).getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  const start = now - mondayIndex * DAY_MS - (WEEKS - 1) * 7 * DAY_MS
  const max = Math.max(0, ...Object.values(daily))
  const level = (w: number) => {
    if (w <= 0 || max <= 0) return 0
    const t = w / max
    return t <= 0.25 ? 1 : t <= 0.5 ? 2 : t <= 0.75 ? 3 : 4
  }

  const weeks: { key: string; words: number; future: boolean }[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const col: { key: string; words: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const ts = start + (w * 7 + d) * DAY_MS
      const key = dayKey(ts)
      col.push({ key, words: daily[key] ?? 0, future: ts > now })
    }
    weeks.push(col)
  }
  const monthOf = (col: { key: string }[]) => new Date(col[0].key + 'T00:00:00Z').getUTCMonth()
  const labels = weeks.map((col, i) =>
    i === 0 || monthOf(col) !== monthOf(weeks[i - 1]) ? MONTHS[monthOf(col)] : '',
  )

  return (
    <div className="ins-heatmap">
      <div className="ins-hm-months">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="ins-hm-grid">
        {weeks.map((col, wi) => (
          <div className="ins-hm-col" key={wi}>
            {col.map((c) =>
              c.future ? (
                <span key={c.key} className="ins-hm-cell ins-hm-future" />
              ) : (
                <span
                  key={c.key}
                  className={`ins-hm-cell ins-hm-${level(c.words)}`}
                  title={dayTitle(c.key, c.words)}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- manuscript composition ----------

const ADVERB_STOPLIST = new Set([
  'only', 'early', 'likely', 'family', 'reply', 'supply',
  'italy', 'belly', 'rally', 'holy', 'ugly', 'assembly',
])

interface Composition {
  words: number
  dialoguePct: number
  avgSentence: number
  avgParagraph: number
  adverbs: [string, number][]
  readingTime: string
}

function analyzeComposition(text: string): Composition {
  const words = wordCount(text)

  // Dialogue share: characters inside straight or curly double quotes.
  let inQuote = false
  let quoteChars = 0
  for (const ch of text) {
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === '“') { inQuote = true; continue }
    if (ch === '”') { inQuote = false; continue }
    if (inQuote) quoteChars++
  }
  const dialoguePct = text.length > 0 ? Math.round((quoteChars / text.length) * 100) : 0

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  const avgSentence = sentences.length ? words / sentences.length : 0

  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  const avgParagraph = paragraphs.length ? words / paragraphs.length : 0

  const counts = new Map<string, number>()
  for (const m of text.toLowerCase().matchAll(/[a-z]+/g)) {
    const w = m[0]
    if (w.length >= 4 && w.endsWith('ly') && !ADVERB_STOPLIST.has(w)) {
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  const adverbs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const totalMin = Math.max(1, Math.round(words / 230))
  const hr = Math.floor(totalMin / 60)
  const readingTime = hr > 0 ? `${hr} hr ${totalMin % 60} min` : `${totalMin} min`

  return { words, dialoguePct, avgSentence, avgParagraph, adverbs, readingTime }
}

function CompositionPanel(props: { project: Project }) {
  const { project } = props
  const text = useMemo(
    () => project.chapters.flatMap((c) => c.scenes.map((s) => s.content)).join('\n\n'),
    [project],
  )
  const comp = useMemo(() => analyzeComposition(text), [text])

  if (comp.words === 0) {
    return (
      <EmptyState glyph="✒" title="Nothing to analyze yet">
        Write some prose in “{project.name}” and the composition lens will wake up.
      </EmptyState>
    )
  }

  return (
    <div className="ins-comp-grid">
      <div className="card">
        <div className="ins-stat-value">{comp.dialoguePct}%</div>
        <div className="ins-stat-label">Dialogue share</div>
      </div>
      <div className="card">
        <div className="ins-stat-value">{comp.avgSentence.toFixed(1)}</div>
        <div className="ins-stat-label">Avg words / sentence</div>
      </div>
      <div className="card">
        <div className="ins-stat-value">{comp.avgParagraph.toFixed(1)}</div>
        <div className="ins-stat-label">Avg words / paragraph</div>
      </div>
      <div className="card">
        <div className="ins-stat-value">{comp.readingTime}</div>
        <div className="ins-stat-label">Reading time</div>
      </div>
      <div className="card">
        <div className="ins-stat-label" style={{ marginTop: 0 }}>Top -ly adverbs</div>
        {comp.adverbs.length === 0 ? (
          <div className="ins-hm-hint">None found — admirably restrained.</div>
        ) : (
          <div className="ins-adverb-list">
            {comp.adverbs.map(([word, n]) => (
              <div className="ins-adverb" key={word}>
                <span>{word}</span>
                <b>×{n}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- page ----------

export default function InsightsPage() {
  const projects = useStore((s) => s.projects)
  const active = useActiveProject()

  const daily = useMemo(() => combinedDaily(projects), [projects])
  const totalWords = projects.reduce((s, p) => s + projectTotalWords(p), 0)
  const today = daily[dayKey(Date.now())] ?? 0
  const week = wordsThisWeek(daily)
  const streak = currentStreak(daily)
  const best = bestDay(daily)
  const hasLog = Object.values(daily).some((v) => v > 0)

  if (projects.length === 0) {
    return (
      <div className="page">
        <header className="page-header rise">
          <div className="kicker">The Observatory</div>
          <h1>Insights</h1>
        </header>
        <EmptyState glyph="◍" title="Nothing to observe yet">
          Forge a tome in the Archive and start writing — the Observatory charts every word
          from there.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Observatory</div>
        <h1>Insights</h1>
        <p className="sub">
          Your writing practice, charted. Every word logged across every tome — momentum,
          habits, and the texture of the prose itself.
        </p>
      </header>

      <div className="ins-stats rise-1">
        <div className="ins-stat">
          <div className="ins-stat-value">{totalWords.toLocaleString()}</div>
          <div className="ins-stat-label">Total words</div>
        </div>
        <div className="ins-stat">
          <div className="ins-stat-value">{today.toLocaleString()}</div>
          <div className="ins-stat-label">Words today</div>
        </div>
        <div className="ins-stat">
          <div className="ins-stat-value">{week.toLocaleString()}</div>
          <div className="ins-stat-label">Words this week</div>
        </div>
        <div className="ins-stat">
          <div className="ins-stat-value">
            {streak} <span style={{ fontSize: 15 }}>day{streak === 1 ? '' : 's'}</span>
          </div>
          <div className="ins-stat-label">Current streak</div>
        </div>
        <div className="ins-stat" title={best ? dayTitle(best.day, best.words) : undefined}>
          <div className="ins-stat-value">{best ? best.words.toLocaleString() : '—'}</div>
          <div className="ins-stat-label">Best single day</div>
        </div>
      </div>

      <section className="ins-section rise-2">
        <span className="kicker">Writing Heatmap · last {WEEKS} weeks</span>
        <Heatmap daily={daily} />
        {!hasLog && (
          <div className="ins-hm-hint">
            No writing logged yet — the log begins with your next words. Open a tome and write;
            the embers will follow.
          </div>
        )}
      </section>

      <section className="ins-section rise-2">
        <span className="kicker">Tomes</span>
        <div className="grid-cards">
          {projects.map((p) => {
            const spark = lastNDays(dailyWordsForProject(p), 14)
            const scenes = p.chapters.reduce((s, c) => s + c.scenes.length, 0)
            const openThreads = p.threads.filter((t) => t.status === 'open').length
            return (
              <div key={p.id} className="card">
                <div className="row between">
                  <h3>{p.name}</h3>
                  <span className="mono faint">{relativeDate(p.updatedAt)}</span>
                </div>
                <div className="ins-proj-meta">
                  {projectTotalWords(p).toLocaleString()} words · {p.chapters.length} ch ·{' '}
                  {scenes} sc
                  <br />
                  {p.codex.length} codex entries · {openThreads} open thread
                  {openThreads === 1 ? '' : 's'}
                </div>
                <div className="ins-spark-row">
                  <Sparkline values={spark} />
                  <span className="mono faint">14 days</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="ins-section rise-3">
        <span className="kicker">
          Manuscript Composition{active ? ` · ${active.name}` : ''}
        </span>
        {active ? (
          <CompositionPanel project={active} />
        ) : (
          <EmptyState glyph="◈" title="No active tome">
            Open a project from the Archive to see its dialogue share, sentence rhythm, and
            adverb habits.
          </EmptyState>
        )}
      </section>
    </div>
  )
}
