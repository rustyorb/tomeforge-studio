import { useState } from 'react'
import { ErrorBanner, Field, StreamView } from '../../components/ui'
import type { GenJob } from './useGeneration'
import { InlineBranchSave } from './ResultPanels'

interface Props {
  sceneContent: string
  /** The active rewrite job, if one is running or finished. */
  job: GenJob | null
  busy: boolean
  replaceError: string | null
  onRun: (target: 'scene' | 'passage', passage: string, instruction: string) => void
  onReplace: () => void
  onSaveBranch: (name: string) => void
  onDiscard: () => void
  onClose: () => void
}

export default function RewritePanel(props: Props) {
  const [target, setTarget] = useState<'scene' | 'passage'>('scene')
  const [passage, setPassage] = useState('')
  const [instruction, setInstruction] = useState('')
  const [naming, setNaming] = useState(false)

  const slot = props.job?.slots[0] ?? null
  const hasText = (slot?.text.trim().length ?? 0) > 0
  const canRun =
    !props.busy &&
    instruction.trim().length > 0 &&
    (target === 'scene'
      ? props.sceneContent.trim().length > 0
      : passage.trim().length > 0)

  return (
    <div className="panel rise">
      <div className="panel-head">
        <span className="kicker">Rewrite</span>
        <button className="btn ghost small" onClick={props.onClose}>
          ✕
        </button>
      </div>
      <div className="panel-body">
        {!props.job && (
          <>
            <div className="field">
              <label>Target</label>
              <div className="row wrap">
                <label className="ms-radio">
                  <input
                    type="radio"
                    name="ms-rewrite-target"
                    checked={target === 'scene'}
                    onChange={() => setTarget('scene')}
                  />
                  Rewrite whole scene
                </label>
                <label className="ms-radio">
                  <input
                    type="radio"
                    name="ms-rewrite-target"
                    checked={target === 'passage'}
                    onChange={() => setTarget('passage')}
                  />
                  Rewrite a pasted passage
                </label>
              </div>
            </div>

            {target === 'passage' && (
              <Field
                label="Passage"
                hint="Paste the exact passage from the scene — Replace will swap only this text."
              >
                <textarea value={passage} onChange={(e) => setPassage(e.target.value)} />
              </Field>
            )}

            <Field label="Instruction" hint='e.g. "more dread, tighter dialogue"'>
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canRun) props.onRun(target, passage, instruction)
                }}
              />
            </Field>

            <button
              className="btn primary"
              disabled={!canRun}
              onClick={() => props.onRun(target, passage, instruction)}
            >
              Run Rewrite
            </button>
          </>
        )}

        {props.job && slot && (
          <>
            <ErrorBanner error={slot.error} />
            <ErrorBanner error={props.replaceError} />
            <div className="ms-compare">
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>
                  Original
                </div>
                <div className="prose-block ms-scroll muted">
                  {props.job.rewrite?.original}
                </div>
              </div>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>
                  Rewrite
                </div>
                <div className="ms-scroll">
                  <StreamView text={slot.text} busy={slot.busy} />
                </div>
              </div>
            </div>
            {!slot.busy && (
              <div className="row wrap" style={{ marginTop: 14 }}>
                {naming ? (
                  <InlineBranchSave
                    onSave={(n) => {
                      setNaming(false)
                      props.onSaveBranch(n)
                    }}
                    onCancel={() => setNaming(false)}
                  />
                ) : (
                  <>
                    {hasText && (
                      <button className="btn small primary" onClick={props.onReplace}>
                        Replace {props.job.rewrite?.target === 'scene' ? 'Whole Scene' : 'Passage'}
                      </button>
                    )}
                    {hasText && (
                      <button className="btn small" onClick={() => setNaming(true)}>
                        Save as Branch
                      </button>
                    )}
                    <button className="btn small ghost danger" onClick={props.onDiscard}>
                      Discard
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
