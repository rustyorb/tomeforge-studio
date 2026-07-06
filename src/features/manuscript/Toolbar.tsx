import { useState } from 'react'
import type { Pacing, Project, StyleProfile } from '../../types'
import { PRESETS } from '../../lib/presets'
import type { GenOverrides, ProseKind } from './generation'

const PACING_OPTIONS: Pacing[] = [
  'slow-burn',
  'balanced',
  'fast',
  'cinematic',
  'lyrical',
  'sparse',
  'high-intensity',
]

const CHAPTER_TOOLS: { kind: ProseKind; label: string; note: string }[] = [
  { kind: 'opening', label: 'Generate Chapter Opening', note: 'Ground the reader; set the chapter in motion' },
  { kind: 'transition', label: 'Generate Transition', note: 'Carry the story into the next movement' },
  { kind: 'climax', label: 'Generate Climax Beat', note: 'Sharpen the chapter to its breaking point' },
  { kind: 'ending', label: 'Generate Chapter Ending', note: 'Land the note; leave the hook' },
]

interface Props {
  project: Project
  styleProfile: StyleProfile | null
  overrides: GenOverrides
  onOverrides: (o: GenOverrides) => void
  busy: boolean
  onRun: (kind: ProseKind) => void
  onToggleRewrite: () => void
  onStop: () => void
  mutate: (recipe: (draft: Project) => void) => void
}

export default function Toolbar(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const o = props.overrides
  const locks = props.styleProfile

  return (
    <div className="panel">
      <div className="panel-body">
        <div className="ms-controls">
          <div className="field ms-control">
            <label>Preset</label>
            <select
              value={props.project.presetId}
              onChange={(e) => {
                const v = e.target.value
                props.mutate((d) => {
                  d.presetId = v
                })
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id} title={p.description}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field ms-control">
            <label>Pacing override</label>
            <select
              value={o.pacing}
              onChange={(e) =>
                props.onOverrides({ ...o, pacing: e.target.value as Pacing | '' })
              }
            >
              <option value="">Profile default</option>
              {PACING_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field ms-control" style={{ minWidth: 200 }}>
            <label className="ms-check-label">
              <input
                type="checkbox"
                checked={o.dialogueRatio !== null}
                onChange={(e) =>
                  props.onOverrides({ ...o, dialogueRatio: e.target.checked ? 5 : null })
                }
              />
              <span>
                Dialogue ratio{' '}
                {o.dialogueRatio !== null && (
                  <span className="ember-text">{o.dialogueRatio}</span>
                )}
              </span>
            </label>
            {o.dialogueRatio !== null ? (
              <input
                type="range"
                min={0}
                max={10}
                value={o.dialogueRatio}
                title="0 = interiority/description, 10 = conversation-driven"
                onChange={(e) =>
                  props.onOverrides({ ...o, dialogueRatio: Number(e.target.value) })
                }
              />
            ) : (
              <div className="hint">Profile default</div>
            )}
          </div>

          {locks && (locks.povLock || locks.tenseLock) && (
            <div className="row wrap ms-locks">
              {locks.povLock && <span className="tag brass">POV · {locks.povLock}</span>}
              {locks.tenseLock && <span className="tag brass">Tense · {locks.tenseLock}</span>}
            </div>
          )}
        </div>

        <div className="row wrap" style={{ marginTop: 14 }}>
          <button className="btn primary" disabled={props.busy} onClick={() => props.onRun('continue')}>
            ▸ Continue
          </button>
          <button className="btn" disabled={props.busy} onClick={() => props.onRun('extend')}>
            Extend Scene
          </button>
          <button className="btn" disabled={props.busy} onClick={() => props.onRun('fork')}>
            Fork ×3
          </button>
          <button className="btn" disabled={props.busy} onClick={props.onToggleRewrite}>
            Rewrite…
          </button>

          <div className="ms-menu-wrap">
            <button className="btn" disabled={props.busy} onClick={() => setMenuOpen((v) => !v)}>
              Chapter Tools ▾
            </button>
            {menuOpen && (
              <>
                <div className="ms-menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="ms-menu rise">
                  {CHAPTER_TOOLS.map((t) => (
                    <button
                      key={t.kind}
                      onClick={() => {
                        setMenuOpen(false)
                        props.onRun(t.kind)
                      }}
                    >
                      {t.label}
                      <span className="ms-menu-note">{t.note}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {props.busy && (
            <button className="btn danger" onClick={props.onStop} style={{ marginLeft: 'auto' }}>
              <span className="spinner" /> Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
