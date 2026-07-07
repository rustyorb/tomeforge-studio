import { CopyButton, Modal } from '../../components/ui'

/**
 * Prompt Peek — the exact system prompt the next Continue would send.
 * Total transparency into the Story Brain's context assembly: memory, codex
 * matches, cast, story-so-far, voiceprint, preset, director's note.
 */
export default function PromptPeek(props: { system: string; onClose: () => void }) {
  const chars = props.system.length
  const tokens = Math.round(chars / 4)
  return (
    <Modal title="Prompt Peek — what the AI sees" onClose={props.onClose}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        This is the exact system prompt assembled for your next <b>Continue</b> — memory, matched
        codex entries, cast states, story-so-far, voiceprint, preset, and the Director's Note
        (last = strongest). Your recent prose rides alongside as the user message.
      </p>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="mono faint">
          {chars.toLocaleString()} chars · ~{tokens.toLocaleString()} tokens
        </span>
        <CopyButton text={props.system} label="Copy prompt" />
      </div>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          lineHeight: 1.55,
          background: 'var(--ink-0)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: 14,
          maxHeight: '55vh',
          overflowY: 'auto',
        }}
      >
        {props.system}
      </pre>
    </Modal>
  )
}
