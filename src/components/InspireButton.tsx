import { useState } from 'react'
import { streamMessage } from '../lib/ai'

/**
 * ✨ one-shot AI filler for any input the user is staring at blankly.
 * Build returns the prompt; onText receives the trimmed result.
 */
export function InspireButton(props: {
  title?: string
  build: () => { system: string; user: string; maxTokens?: number; temperature?: number }
  onText: (text: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setErr(null)
    try {
      const p = props.build()
      const text = await streamMessage({
        system: p.system,
        messages: [{ role: 'user', content: p.user }],
        temperature: p.temperature ?? 0.95,
        maxTokens: p.maxTokens ?? 400,
      })
      props.onText(text.trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      <button
        type="button"
        className="btn ghost small"
        disabled={busy}
        title={props.title ?? 'Inspire me — let the AI draft this'}
        onClick={() => void run()}
      >
        {busy ? <span className="spinner" /> : '✨'} {busy ? '' : 'Inspire'}
      </button>
      {err && (
        <span className="tag red" title={err} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {err.slice(0, 40)}…
        </span>
      )}
    </span>
  )
}
