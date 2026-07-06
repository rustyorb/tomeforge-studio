import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui'

const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['Ctrl', 'K'], what: 'Command deck — search everything' },
  { keys: ['Ctrl', '/'], what: 'This help' },
]

const MANUSCRIPT_SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['Ctrl', 'Space'], what: 'Ghost suggestion' },
  { keys: ['Tab'], what: 'Accept ghost' },
  { keys: ['Esc'], what: 'Dismiss ghost / exit focus mode' },
]

function Row(props: { keys: string[]; what: string }) {
  return (
    <div className="row between" style={{ padding: '7px 0' }}>
      <span style={{ fontSize: 14 }}>{props.what}</span>
      <span className="row" style={{ gap: 5 }}>
        {props.keys.map((k) => (
          <kbd key={k} className="pal-kbd">{k}</kbd>
        ))}
      </span>
    </div>
  )
}

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === '/') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Esc consumes the key in capture phase ONLY while open, so lower layers
  // (Focus Mode's exit listener) don't also react to the same press.
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onEsc, { capture: true })
    return () => window.removeEventListener('keydown', onEsc, { capture: true })
  }, [open])

  if (!open) return null
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      {SHORTCUTS.map((s) => (
        <Row key={s.what} keys={s.keys} what={s.what} />
      ))}
      <div className="kicker" style={{ margin: '14px 0 4px' }}>Manuscript</div>
      {MANUSCRIPT_SHORTCUTS.map((s) => (
        <Row key={s.what} keys={s.keys} what={s.what} />
      ))}
      <div className="faint" style={{ fontSize: 12.5, marginTop: 14 }}>
        On macOS, use ⌘ where Ctrl is shown.
      </div>
    </Modal>
  )
}
