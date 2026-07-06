import { useState } from 'react'
import { CopyButton, ErrorBanner, StreamView } from '../../components/ui'
import type { GenJob, StreamSlot } from './useGeneration'
import { wordCount } from './helpers'

/** Inline (non-window.prompt) name input for saving a branch. */
export function InlineBranchSave(props: {
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="row" style={{ flex: 1 }}>
      <input
        type="text"
        autoFocus
        placeholder="Branch name…"
        value={name}
        style={{ maxWidth: 220, padding: '4px 9px', fontSize: 13 }}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) props.onSave(name.trim())
          if (e.key === 'Escape') props.onCancel()
        }}
      />
      <button
        className="btn small primary"
        disabled={!name.trim()}
        onClick={() => props.onSave(name.trim())}
      >
        Save
      </button>
      <button className="btn small ghost" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  )
}

function SlotPanel(props: {
  slot: StreamSlot
  onAccept: () => void
  onSaveBranch: (name: string) => void
  onDiscard: () => void
}) {
  const [naming, setNaming] = useState(false)
  const { slot } = props
  const hasText = slot.text.trim().length > 0

  return (
    <div className="panel rise">
      <div className="panel-head">
        <span className="kicker">{slot.label}</span>
        <span className="row">
          {slot.busy && <span className="spinner" />}
          {slot.aborted && <span className="tag">stopped</span>}
          {!slot.busy && hasText && (
            <span className="mono faint">{wordCount(slot.text).toLocaleString()} words</span>
          )}
        </span>
      </div>
      <div className="panel-body">
        <ErrorBanner error={slot.error} />
        <div className="ms-scroll">
          <StreamView text={slot.text} busy={slot.busy} />
        </div>
        {!slot.busy && (
          <div className="row wrap" style={{ marginTop: 12 }}>
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
                  <button className="btn small primary" onClick={props.onAccept}>
                    Accept
                  </button>
                )}
                {hasText && (
                  <button className="btn small" onClick={() => setNaming(true)}>
                    Save as Branch
                  </button>
                )}
                {hasText && <CopyButton text={slot.text} />}
                <button className="btn small ghost danger" onClick={props.onDiscard}>
                  Discard
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Result area for continue / extend / fork / chapter-tool jobs. */
export default function ResultPanels(props: {
  job: GenJob
  onAccept: (i: number) => void
  onSaveBranch: (i: number, name: string) => void
  onDiscard: (i: number) => void
}) {
  const { job } = props
  return (
    <div className={job.kind === 'fork' ? 'ms-forks' : 'stack'}>
      {job.slots.map((slot, i) => (
        <SlotPanel
          key={`${job.id}-${slot.label}`}
          slot={slot}
          onAccept={() => props.onAccept(i)}
          onSaveBranch={(n) => props.onSaveBranch(i, n)}
          onDiscard={() => props.onDiscard(i)}
        />
      ))}
    </div>
  )
}
