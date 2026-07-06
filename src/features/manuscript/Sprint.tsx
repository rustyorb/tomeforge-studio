import { useEffect, useRef, useState } from 'react'

export interface SprintState {
  status: 'running' | 'done'
  durationMin: number
  goal: number | null
  /** Total manuscript word count when the sprint started. */
  startWords: number
  startedAt: number
  deadline: number
  /** Ticked every second while running. */
  now: number
  /** Total manuscript word count captured the moment time ran out. */
  wordsAtEnd: number | null
}

export interface SprintApi {
  sprint: SprintState | null
  start: (durationMin: number, goal: number | null) => void
  cancel: () => void
  goAgain: () => void
}

/**
 * Session-only writing sprint. Pass the live total manuscript word count so
 * progress and the end-of-sprint tally track real writing.
 */
export function useSprint(totalWords: number): SprintApi {
  const [sprint, setSprint] = useState<SprintState | null>(null)
  const wordsRef = useRef(totalWords)
  useEffect(() => {
    wordsRef.current = totalWords
  })

  const running = sprint?.status === 'running'
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSprint((s) => {
        if (!s || s.status !== 'running') return s
        const now = Date.now()
        if (now >= s.deadline) {
          return { ...s, status: 'done', now: s.deadline, wordsAtEnd: wordsRef.current }
        }
        return { ...s, now }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const start = (durationMin: number, goal: number | null) => {
    const now = Date.now()
    setSprint({
      status: 'running',
      durationMin,
      goal,
      startWords: wordsRef.current,
      startedAt: now,
      deadline: now + durationMin * 60_000,
      now,
      wordsAtEnd: null,
    })
  }

  return {
    sprint,
    start,
    cancel: () => setSprint(null),
    goAgain: () => {
      const s = sprint
      if (s) start(s.durationMin, s.goal)
    },
  }
}

function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

function fmtDelta(words: number): string {
  return words >= 0 ? `+${words}` : `${words}`
}

/** Compact one-line sprint status for the Focus Mode HUD, or null. */
export function sprintHudText(s: SprintState | null, totalWords: number): string | null {
  if (!s) return null
  if (s.status === 'done') {
    const words = Math.max(0, (s.wordsAtEnd ?? totalWords) - s.startWords)
    return `sprint done · ${words} words`
  }
  const words = totalWords - s.startWords
  const goal = s.goal !== null ? ` / ${s.goal}` : ''
  return `${fmtRemaining(s.deadline - s.now)} · ${fmtDelta(words)} w${goal}`
}

const DURATIONS = [15, 25, 45]

/**
 * Toolbar sprint control: setup popover when idle, live chip while running,
 * gentle completion state when time is up.
 */
export function SprintControl(props: { api: SprintApi; totalWords: number }) {
  const [open, setOpen] = useState(false)
  const [durationMin, setDurationMin] = useState(25)
  const [goalText, setGoalText] = useState('')
  const s = props.api.sprint

  if (s?.status === 'running') {
    const words = props.totalWords - s.startWords
    const goalPart =
      s.goal !== null
        ? ` · ${Math.min(100, Math.max(0, Math.round((words / s.goal) * 100)))}% of ${s.goal}`
        : ''
    return (
      <span className="ms-sprint-chip">
        ⏱ {fmtRemaining(s.deadline - s.now)} · {fmtDelta(words)} w{goalPart}
        <button className="ms-sprint-x" title="Cancel sprint" onClick={props.api.cancel}>
          ✕
        </button>
      </span>
    )
  }

  if (s?.status === 'done') {
    const words = Math.max(0, (s.wordsAtEnd ?? props.totalWords) - s.startWords)
    const wpm = s.durationMin > 0 ? Math.round((words / s.durationMin) * 10) / 10 : 0
    const goalNote =
      s.goal === null ? '' : words >= s.goal ? ' · goal hit ✦' : ` · goal ${s.goal} not reached`
    return (
      <span className="ms-sprint-chip ms-sprint-done">
        Sprint over — {words} words · {wpm} wpm{goalNote}
        <button className="btn small" onClick={props.api.goAgain}>
          Go again
        </button>
        <button className="btn small ghost" onClick={props.api.cancel}>
          Dismiss
        </button>
      </span>
    )
  }

  return (
    <div className="ms-menu-wrap">
      <button className="btn" onClick={() => setOpen((v) => !v)}>
        ⏱ Sprint
      </button>
      {open && (
        <>
          <div className="ms-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="ms-popover rise">
            <div className="field">
              <label>Duration</label>
              <div className="row">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    className={`btn small ${durationMin === m ? 'primary' : ''}`}
                    onClick={() => setDurationMin(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Word goal (optional)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 500"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
              />
            </div>
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => {
                const goal = Math.floor(Number(goalText))
                props.api.start(durationMin, Number.isFinite(goal) && goal > 0 ? goal : null)
                setOpen(false)
              }}
            >
              Start sprint
            </button>
          </div>
        </>
      )}
    </div>
  )
}
