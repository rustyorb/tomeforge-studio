import React, { useState } from 'react'
import type { Pacing, Project, StyleProfile } from '../../types'
import { PACINGS } from '../../types'
import { PRESETS } from '../../lib/presets'
import type { GenOverrides, ProseKind } from './generation'

const PACING_OPTIONS: readonly Pacing[] = PACINGS

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
  onFocus: () => void
  onGhost: () => void
  /** Sprint chip / setup control rendered at the row's right edge. */
  sprintControl: React.ReactNode
  mutate: (recipe: (draft: Project) => void) => void
  /** Opens the Prompt Peek modal (what the AI sees) */
  onPeek?: () => void
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

          <div className="row wrap ms-locks">
            <span
              className={`tag ${props.styleProfile ? 'ember' : ''}`}
              title={
                props.styleProfile
                  ? `Voiceprint "${props.styleProfile.name}" shapes every generation on this tome — its dials, pacing, and voice notes ride along invisibly. Assign a different one on the Voiceprint page.`
                  : 'No voiceprint assigned — generations use only the preset. Assign one on the Voiceprint page.'
              }
            >
              ❦ {props.styleProfile ? props.styleProfile.name : 'no voiceprint'}
            </span>
            {props.onPeek && (
              <button
                className="btn ghost small"
                title="Prompt Peek — see exactly what the AI is given on the next generation"
                onClick={props.onPeek}
              >
                👁 Peek
              </button>
            )}
            {locks?.povLock && <span className="tag brass">POV · {locks.povLock}</span>}
            {locks?.tenseLock && <span className="tag brass">Tense · {locks.tenseLock}</span>}
          </div>
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
          <button
            className="btn"
            title="Ghost continuation (Ctrl+Space in the editor)"
            onClick={props.onGhost}
          >
            ✧ Ghost
          </button>
          <button className="btn" title="Immersive writing mode" onClick={props.onFocus}>
            ◉ Focus
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

          <span className="row" style={{ marginLeft: 'auto' }}>
            {props.sprintControl}
            {props.busy && (
              <button className="btn danger" onClick={props.onStop}>
                <span className="spinner" /> Stop
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
