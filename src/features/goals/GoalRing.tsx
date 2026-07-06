import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useSettings } from '../../store/useSettings'
import { combinedDaily, dayKey } from '../insights/stats'
import './goals.css'

const CELEBRATED_KEY = 'tomeforge-goal-celebrated'

/**
 * Sidebar daily-goal progress ring. Hidden when no goal is set (dailyGoal 0).
 * Fires a one-shot ember burst the first time the goal is crossed each day.
 */
export default function GoalRing() {
  const goal = useSettings((s) => s.dailyGoal)
  const projects = useStore((s) => s.projects)
  const [burst, setBurst] = useState(false)
  const burstTimer = useRef<number | null>(null)

  const today = useMemo(() => {
    const daily = combinedDaily(projects)
    return daily[dayKey(Date.now())] ?? 0
  }, [projects])

  const hit = goal > 0 && today >= goal

  // One-shot celebration per day, remembered across reloads.
  useEffect(() => {
    if (!hit) return
    const day = dayKey(Date.now())
    if (localStorage.getItem(CELEBRATED_KEY) === day) return
    try {
      localStorage.setItem(CELEBRATED_KEY, day)
    } catch {
      /* storage full — celebrate anyway */
    }
    setBurst(true)
    burstTimer.current = window.setTimeout(() => setBurst(false), 1800)
    return () => {
      if (burstTimer.current) window.clearTimeout(burstTimer.current)
    }
  }, [hit])

  if (goal <= 0) return null

  const frac = Math.min(1, today / goal)
  const R = 16
  const C = 2 * Math.PI * R

  return (
    <div className="gl-wrap" title={`${today.toLocaleString()} / ${goal.toLocaleString()} words today`}>
      <div className="gl-ring-box">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={R} fill="none" stroke="var(--ink-4)" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={hit ? 'var(--verdigris)' : 'var(--ember)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 22 22)"
            className="gl-arc"
          />
        </svg>
        {burst && (
          <div className="gl-burst">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
            ))}
          </div>
        )}
        <span className="gl-pct">{hit ? '✓' : `${Math.floor(frac * 100)}%`}</span>
      </div>
      <div className="gl-text">
        <span className="gl-count">{today.toLocaleString()}</span>
        <span className="gl-goal">/ {goal.toLocaleString()} today</span>
      </div>
    </div>
  )
}
