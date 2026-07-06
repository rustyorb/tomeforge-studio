import { useState } from 'react'
import { Modal } from '../../components/ui'

const WELCOME_FLAG = 'tomeforge-welcomed'

const PANELS: { kicker: string; title: string; body: string }[] = [
  {
    kicker: 'Welcome to the forge',
    title: 'A co-writer that stays inside the fiction',
    body:
      'TomeForge Studio drafts alongside you — continuations, rewrites, and seventy-one ' +
      'creative tools — and it never breaks character. Your prose, your canon, your voice; ' +
      'the AI is a collaborator at the bench, not a narrator over your shoulder.',
  },
  {
    kicker: 'The Story Brain',
    title: 'Canon that follows you into every generation',
    body:
      'Codex entries, character cards, plot threads, and timelines live in the Story Brain. ' +
      'Whatever you teach it — a secret, an injury, a prophecy — travels silently into every ' +
      'generation, so the story remembers what you remember.',
  },
  {
    kicker: 'Getting started',
    title: 'Three ways in',
    body:
      "Explore the seeded tome 'The Drowned Observatory' to see everything working. " +
      'Add an API key in Settings to light the forge. And press Ctrl+K anywhere — the ' +
      'command deck reaches every page, project, tool, and scene.',
  },
]

export default function Welcome() {
  const [open, setOpen] = useState(() => !localStorage.getItem(WELCOME_FLAG))
  const [step, setStep] = useState(0)

  if (!open) return null

  const dismiss = () => {
    try {
      localStorage.setItem(WELCOME_FLAG, '1')
    } catch {
      // Storage full — the welcome will show again next load; harmless.
    }
    setOpen(false)
  }

  const panel = PANELS[step]
  const last = step === PANELS.length - 1
  return (
    <Modal title="TomeForge Studio" onClose={dismiss}>
      <div className="kicker">{panel.kicker}</div>
      <h3 style={{ margin: '6px 0 10px' }}>{panel.title}</h3>
      <p className="muted" style={{ lineHeight: 1.65 }}>{panel.body}</p>
      <div className="row between" style={{ marginTop: 22 }}>
        <span className="mono faint">{step + 1} / {PANELS.length}</span>
        <button
          className="btn primary"
          onClick={() => (last ? dismiss() : setStep(step + 1))}
        >
          {last ? 'Begin' : 'Next →'}
        </button>
      </div>
    </Modal>
  )
}
