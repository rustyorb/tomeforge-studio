import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { streamMessage } from '../../lib/ai'
import type { ID } from '../../types'
import { GHOST_MAX_TOKENS } from './generation'

export interface GhostRequest {
  system: string
  user: string
  temperature: number
}

export interface GhostEditorHandle {
  /** Start a ghost continuation (same as Ctrl+Space inside the editor). */
  triggerGhost: () => void
  /** True while a ghost suggestion is streaming or visible. */
  ghostActive: () => boolean
  dismissGhost: () => void
  /** Focus the textarea and place the caret at the very end. */
  focusEnd: () => void
}

interface Props {
  sceneId: ID
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** 'page' = normal manuscript editor, 'focus' = focus-mode look. */
  variant: 'page' | 'focus'
  /** Keep the caret line vertically centered while typing (focus mode). */
  typewriter?: boolean
  /** Built lazily at trigger time so it always sees the latest scene text. */
  buildRequest: () => GhostRequest
  /** Called with the ghost text on Tab-accept; parent snapshots + appends. */
  onAcceptGhost: (ghostText: string) => void
}

function isAbortError(e: unknown): boolean {
  return (e instanceof DOMException || e instanceof Error) && e.name === 'AbortError'
}

/**
 * Scene editor with Copilot-style inline "ghost" continuation.
 *
 * Render technique: an aria-hidden mirror div sits behind the textarea with
 * identical typography and box metrics. The mirror repeats the scene text in
 * a transparent span, followed by the dim italic ghost span; the textarea's
 * background is transparent so the ghost shows through exactly where the
 * text ends. The mirror's scrollTop is kept in lockstep with the textarea.
 */
const GhostEditor = forwardRef<GhostEditorHandle, Props>(function GhostEditor(props, ref) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** Refs mirror state so event handlers and the imperative handle read fresh values. */
  const ghostTextRef = useRef('')
  const busyRef = useRef(false)
  /** Scene text captured when the ghost started — external edits dismiss it. */
  const ghostBaseRef = useRef('')
  const noticeTimerRef = useRef<number | null>(null)

  const [ghost, setGhost] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const editorClass = props.variant === 'focus' ? 'ms-focus-editor' : 'prose-editor'
  const ghostOn = busy || ghost.length > 0

  const clearGhost = () => {
    ghostTextRef.current = ''
    busyRef.current = false
    setGhost('')
    setBusy(false)
  }

  const dismissGhost = () => {
    abortRef.current?.abort()
    abortRef.current = null
    clearGhost()
  }

  const flashNotice = (text: string, ms = 3000) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    setNotice(text)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), ms)
  }

  const triggerGhost = () => {
    const ta = taRef.current
    if (!ta || busyRef.current) return
    ta.focus()
    if (ta.selectionStart !== ta.value.length || ta.selectionEnd !== ta.value.length) {
      flashNotice('Ghost continues from the end — move the caret there')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    ghostTextRef.current = ''
    ghostBaseRef.current = ta.value
    busyRef.current = true
    setGhost('')
    setBusy(true)
    setNotice(null)

    const req = props.buildRequest()
    streamMessage({
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      temperature: req.temperature,
      maxTokens: GHOST_MAX_TOKENS,
      signal: controller.signal,
      onDelta: (t) => {
        if (controller.signal.aborted) return
        ghostTextRef.current += t
        setGhost(ghostTextRef.current)
      },
    })
      .then(() => {
        if (controller.signal.aborted) return
        busyRef.current = false
        setBusy(false)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || isAbortError(e)) return
        clearGhost()
        // Covers AIKeyMissingError and API failures — inline notice, no crash.
        setNotice(e instanceof Error ? e.message : String(e))
      })
  }

  const acceptGhost = () => {
    const text = ghostTextRef.current
    abortRef.current?.abort()
    abortRef.current = null
    clearGhost()
    if (!text) return
    const newLen = props.value.length + text.length
    props.onAcceptGhost(text)
    // After the store update re-renders, keep the caret at the new end.
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(newLen, newLen)
      if (props.typewriter) centerCaret()
    })
  }

  /**
   * Typewriter scrolling: approximate the caret's vertical position as its
   * character fraction of the text applied to scrollHeight, then scroll so
   * that point sits mid-viewport.
   */
  const centerCaret = () => {
    const ta = taRef.current
    if (!ta || ta.value.length === 0) return
    const caret = ta.selectionStart ?? ta.value.length
    const fraction = caret / ta.value.length
    const target = fraction * ta.scrollHeight - ta.clientHeight / 2
    ta.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }

  const syncMirror = () => {
    const ta = taRef.current
    const m = mirrorRef.current
    if (ta && m) m.scrollTop = ta.scrollTop
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault()
      triggerGhost()
      return
    }
    const active = busyRef.current || ghostTextRef.current.length > 0
    if (!active) return
    if (e.key === 'Tab') {
      e.preventDefault()
      acceptGhost()
      return
    }
    if (e.key === 'Escape') {
      // Esc dismisses the ghost only — preventDefault so enclosing layers
      // (Focus Mode's window listener) know it was consumed.
      e.preventDefault()
      e.stopPropagation()
      dismissGhost()
      return
    }
    const plainChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
    const editKey = e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter'
    const pasteCut = (e.ctrlKey || e.metaKey) && 'vxVX'.includes(e.key)
    if (plainChar || editKey || pasteCut) dismissGhost()
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Catch-all: any content change (typing, paste, cut, drop) kills the ghost.
    if (busyRef.current || ghostTextRef.current) dismissGhost()
    setNotice(null)
    props.onChange(e.target.value)
    if (props.typewriter) requestAnimationFrame(centerCaret)
  }

  // Abort the stream and reset ghost state on scene switch and on unmount.
  // StrictMode-safe: nothing latches — cleanup fully resets, setup is a no-op.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      abortRef.current = null
      ghostTextRef.current = ''
      busyRef.current = false
      setGhost('')
      setBusy(false)
      setNotice(null)
    },
    [props.sceneId],
  )

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    },
    [],
  )

  // Dismiss if the scene text changes underneath the ghost from outside this
  // editor (e.g. an Accept from the result panels while a ghost is showing).
  useEffect(() => {
    if ((busyRef.current || ghostTextRef.current) && props.value !== ghostBaseRef.current) {
      dismissGhost()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value])

  // Keep the mirror aligned after each stream delta and after value changes.
  useEffect(() => {
    syncMirror()
  }, [ghost, props.value])

  useImperativeHandle(ref, () => ({
    triggerGhost,
    ghostActive: () => busyRef.current || ghostTextRef.current.length > 0,
    dismissGhost,
    focusEnd: () => {
      const ta = taRef.current
      if (!ta) return
      ta.focus()
      const len = ta.value.length
      ta.setSelectionRange(len, len)
      if (props.typewriter) centerCaret()
    },
  }))

  return (
    <div
      className={`ms-ghost-wrap ${props.variant === 'focus' ? 'ms-ghost-wrap-focus' : ''} ${
        ghostOn ? 'ms-ghost-on' : ''
      }`}
    >
      <div ref={mirrorRef} aria-hidden className={`${editorClass} ms-ghost-mirror`}>
        <span className="ms-ghost-base">{props.value}</span>
        <span className="ms-ghost">
          {ghost}
          {busy && <span className="ms-ghost-cursor" />}
        </span>
      </div>
      <textarea
        ref={taRef}
        className={`${editorClass} ms-ghost-input`}
        value={props.value}
        placeholder={props.placeholder}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onClick={props.typewriter ? centerCaret : undefined}
        onScroll={syncMirror}
      />
      {ghostOn && <div className="ms-ghost-hint">Tab — accept · Esc — dismiss</div>}
      {notice && <div className="ms-ghost-hint ms-ghost-notice">{notice}</div>}
    </div>
  )
})

export default GhostEditor
