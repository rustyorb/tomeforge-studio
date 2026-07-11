import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../types'
import { manuscriptWordCount } from './helpers'

/**
 * Reading Mode — the manuscript rendered as a book: title page, chapter
 * headings, scene breaks, book typography, a reading progress bar.
 * No editing, no AI, no chrome. Esc closes.
 */
export default function ReadingMode(props: { project: Project; onClose: () => void }) {
  const { project } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1)
  }

  const words = manuscriptWordCount(project)
  const minutes = Math.max(1, Math.round(words / 230))

  return (
    <div className="ms-reader">
      <div className="ms-reader-progress" style={{ width: `${progress * 100}%` }} />
      <div className="ms-reader-top">
        <span className="mono faint">
          {words.toLocaleString()} words · ~{minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`} read
        </span>
        <button className="btn ghost small" onClick={props.onClose}>✕ Esc</button>
      </div>
      <div className="ms-reader-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="ms-reader-page">
          <div className="ms-reader-titlepage">
            <div className="ms-reader-booktitle">{project.name}</div>
            {project.genre && <div className="ms-reader-genre">{project.genre}</div>}
            {project.logline && <div className="ms-reader-logline">{project.logline}</div>}
          </div>

          {project.chapters.map((ch) => (
            <section key={ch.id} className="ms-reader-chapter">
              <h2 className="ms-reader-chtitle">{ch.title}</h2>
              {ch.scenes.map((sc, i) => (
                <div key={sc.id}>
                  {i > 0 && <div className="ms-reader-break">⁂</div>}
                  {sc.content
                    .split(/\n{2,}/)
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((block, j) => (
                      <p key={j} className="ms-reader-para">{block}</p>
                    ))}
                </div>
              ))}
            </section>
          ))}

          <div className="ms-reader-end">🕯️</div>
        </div>
      </div>
    </div>
  )
}
