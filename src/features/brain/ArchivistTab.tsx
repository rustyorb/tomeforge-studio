import { useMemo, useRef, useState } from 'react'
import type { Project, StyleProfile } from '../../types'
import { useStore } from '../../store/useStore'
import { streamMessage } from '../../lib/ai'
import { buildStoryContext } from '../../lib/context'
import { ErrorBanner } from '../../components/ui'
import { uid } from '../../lib/id'

/** Words that start sentences constantly and are never lore. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'so', 'yet', 'for', 'nor', 'as', 'at',
  'by', 'in', 'of', 'on', 'to', 'up', 'it', 'its', 'he', 'she', 'they', 'we',
  'you', 'i', 'his', 'her', 'their', 'our', 'your', 'my', 'this', 'that',
  'these', 'those', 'there', 'here', 'then', 'when', 'where', 'while', 'what',
  'who', 'why', 'how', 'not', 'no', 'yes', 'if', 'was', 'were', 'is', 'are',
  'be', 'been', 'had', 'has', 'have', 'did', 'do', 'does', 'with', 'without',
  'from', 'into', 'over', 'under', 'after', 'before', 'behind', 'beneath',
  'beyond', 'above', 'below', 'across', 'against', 'along', 'around', 'through',
  'chapter', 'scene', 'even', 'still', 'once', 'now', 'again', 'perhaps',
  'something', 'nothing', 'someone', 'somewhere', 'everything', 'everyone',
])

interface Candidate {
  name: string
  count: number
  snippet: string
}

/**
 * Scan the manuscript for repeated capitalized names (1-3 word runs) that are
 * not yet in the Codex or Cast Ledger. Local, instant, free.
 */
function findCandidates(project: Project): Candidate[] {
  const text = project.chapters.flatMap((c) => c.scenes.map((s) => s.content)).join('\n\n')
  if (!text.trim()) return []

  // Names already known to the brain (codex names + aliases + cast names).
  const known = new Set<string>()
  for (const e of project.codex) {
    known.add(e.name.toLowerCase())
    for (const a of e.aliases) known.add(a.toLowerCase())
  }
  for (const c of project.characters) known.add(c.name.toLowerCase())

  // Capitalized runs: "Mara", "Lake Veyr", "The Hollow King" (leading "The" kept).
  const runRe = /(?:The\s)?(?:[A-Z][a-zA-Z'’-]+)(?:\s(?:of|the)\s[A-Z][a-zA-Z'’-]+|\s[A-Z][a-zA-Z'’-]+){0,2}/g
  const counts = new Map<string, { count: number; snippet: string }>()

  for (const match of text.matchAll(runRe)) {
    const run = match[0].trim()
    const stripped = run.replace(/^The\s/, '')
    const first = stripped.split(/\s/)[0].toLowerCase()
    // Skip single common words and sentence-start noise.
    if (STOPWORDS.has(first)) continue
    if (stripped.length < 3) continue
    // Single words at sentence start ("She said…") are ambiguous — require
    // the word to also appear mid-sentence somewhere, checked via count below.
    const key = run
    const existing = counts.get(key)
    if (existing) existing.count++
    else {
      const at = match.index ?? 0
      const snippet = text.slice(Math.max(0, at - 40), at + run.length + 40).replace(/\n+/g, ' ')
      counts.set(key, { count: 1, snippet: `…${snippet.trim()}…` })
    }
  }

  return [...counts.entries()]
    .filter(([name, v]) => {
      if (known.has(name.toLowerCase())) return false
      if (known.has(name.replace(/^The\s/, '').toLowerCase())) return false
      return v.count >= 2 // mentioned at least twice = probably lore
    })
    .map(([name, v]) => ({ name, count: v.count, snippet: v.snippet }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
}

export default function ArchivistTab(props: {
  project: Project
  styleProfile: StyleProfile | null
}) {
  const { project, styleProfile } = props
  const updateProject = useStore((s) => s.updateProject)

  const [scanNonce, setScanNonce] = useState(0)
  const [draftingName, setDraftingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [sumProgress, setSumProgress] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const candidates = useMemo(
    () => findCandidates(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.updatedAt, scanNonce],
  )

  const addToCodex = (name: string, content = '') => {
    updateProject(project.id, (d) => {
      d.codex.push({
        id: uid(),
        name: name.replace(/^The\s/, ''),
        type: 'other',
        aliases: name.startsWith('The ') ? [name] : [],
        content,
        alwaysInclude: false,
        updatedAt: Date.now(),
      })
    })
  }

  const draftWithAI = async (candidate: Candidate) => {
    setDraftingName(candidate.name)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const content = await streamMessage({
        system: buildStoryContext(project, styleProfile, {
          recentText: candidate.snippet,
          taskDirective:
            `Write a codex entry (80-150 words) for "${candidate.name}", which appears ` +
            `${candidate.count} times in the manuscript. Use ONLY what the manuscript ` +
            'establishes; do not invent major new facts. Output only the entry body.',
        }),
        messages: [
          {
            role: 'user',
            content: `Context where "${candidate.name}" appears: ${candidate.snippet}\n\nWrite the codex entry now.`,
          },
        ],
        temperature: 0.5,
        maxTokens: 400,
        signal: controller.signal,
      })
      addToCodex(candidate.name, content.trim())
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setDraftingName(null)
      abortRef.current = null
    }
  }

  /** Scenes worth summarizing: long enough, and not summarized since last edit. */
  const unsummarized = project.chapters.flatMap((ch) =>
    ch.scenes
      .filter((sc) => !sc.summary && sc.content.trim().split(/\s+/).length >= 150)
      .map((sc) => ({ chapter: ch, scene: sc })),
  )

  const summarizeAll = async () => {
    setSummarizing(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for (let i = 0; i < unsummarized.length; i++) {
        const { chapter, scene } = unsummarized[i]
        setSumProgress(`${i + 1} / ${unsummarized.length} — ${scene.title}`)
        const summary = await streamMessage({
          system:
            'You summarize fiction scenes for a story memory system. Output only the summary: ' +
            '1-2 sentences, past tense, naming who did what and any fact a later chapter must not contradict.',
          messages: [
            {
              role: 'user',
              content: `Chapter: ${chapter.title}\nScene: ${scene.title}\n\n${scene.content.slice(0, 12000)}`,
            },
          ],
          temperature: 0.3,
          maxTokens: 150,
          signal: controller.signal,
        })
        updateProject(project.id, (d) => {
          for (const c of d.chapters) {
            const s = c.scenes.find((x) => x.id === scene.id)
            if (s) s.summary = summary.trim()
          }
        })
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setSummarizing(false)
      setSumProgress('')
      abortRef.current = null
    }
  }

  const summarizedCount = project.chapters
    .flatMap((c) => c.scenes)
    .filter((s) => s.summary).length

  return (
    <div className="rise">
      <ErrorBanner error={error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between wrap">
          <div>
            <h3>Story So Far — scene memory</h3>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 560 }}>
              The Archivist writes a 1-2 sentence summary of each scene. Summaries become the
              "story so far" section of every AI generation, so the co-writer remembers events
              far beyond the recent pages. {summarizedCount} scene{summarizedCount === 1 ? '' : 's'} summarized,{' '}
              {unsummarized.length} pending.
            </p>
          </div>
          {summarizing ? (
            <div className="row">
              <span className="mono faint">{sumProgress}</span>
              <button className="btn small danger" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            </div>
          ) : (
            <button className="btn primary" disabled={!unsummarized.length} onClick={summarizeAll}>
              {unsummarized.length ? `✎ Summarize ${unsummarized.length} scene${unsummarized.length === 1 ? '' : 's'}` : 'All scenes summarized'}
            </button>
          )}
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h3>Uncatalogued names</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Names that appear repeatedly in the manuscript but aren't in the Codex or Cast
            Ledger yet. Catalogue them so the Story Brain can defend their canon.
          </p>
        </div>
        <button className="btn small" onClick={() => setScanNonce((n) => n + 1)}>
          ↻ Rescan
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="faint">
          Nothing uncatalogued — every recurring name in the manuscript is already in the brain.
        </p>
      ) : (
        <div className="stack">
          {candidates.map((c) => (
            <div key={c.name} className="card" style={{ padding: '12px 16px' }}>
              <div className="row between wrap" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15.5 }}>
                    {c.name}
                  </span>{' '}
                  <span className="tag brass" style={{ marginLeft: 6 }}>
                    ×{c.count}
                  </span>
                  <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{c.snippet}</div>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <button
                    className="btn small"
                    disabled={draftingName !== null}
                    onClick={() => draftWithAI(c)}
                  >
                    {draftingName === c.name ? (
                      <>
                        <span className="spinner" /> Drafting…
                      </>
                    ) : (
                      '✎ Draft with AI'
                    )}
                  </button>
                  <button
                    className="btn ghost small"
                    disabled={draftingName !== null}
                    onClick={() => addToCodex(c.name)}
                  >
                    + Add empty
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
