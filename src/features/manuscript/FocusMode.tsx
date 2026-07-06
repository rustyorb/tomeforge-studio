import { useEffect, useRef } from 'react'
import type { ID } from '../../types'
import GhostEditor from './GhostEditor'
import type { GhostEditorHandle, GhostRequest } from './GhostEditor'
import { wordCount } from './helpers'

interface Props {
  sceneId: ID
  sceneTitle: string
  value: string
  onChange: (v: string) => void
  buildRequest: () => GhostRequest
  onAcceptGhost: (ghostText: string) => void
  /** Compact sprint status line for the HUD, or null when no sprint. */
  sprintText: string | null
  onExit: () => void
}

/**
 * Fullscreen immersive writing overlay. Fixed, candlelit, z-index below 100
 * so Modals still win. Esc exits — unless a ghost suggestion is active, in
 * which case Esc dismisses the ghost first (the editor preventDefaults it).
 */
export default function FocusMode(props: Props) {
  const ghostRef = useRef<GhostEditorHandle>(null)
  const exitRef = useRef(props.onExit)
  useEffect(() => {
    exitRef.current = props.onExit
  })

  // Drop the writer straight into the prose.
  useEffect(() => {
    ghostRef.current?.focusEnd()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Belt and suspenders: the editor consumes Esc while a ghost is active,
      // but if the event reaches us anyway, dismiss the ghost instead of exiting.
      const ghost = ghostRef.current
      if (ghost?.ghostActive()) {
        ghost.dismissGhost()
        return
      }
      exitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ms-focus">
      <div className="ms-focus-col">
        <div className="ms-focus-title">{props.sceneTitle || 'Untitled scene'}</div>
        <GhostEditor
          ref={ghostRef}
          sceneId={props.sceneId}
          value={props.value}
          onChange={props.onChange}
          placeholder="Ink flows here…"
          variant="focus"
          typewriter
          buildRequest={props.buildRequest}
          onAcceptGhost={props.onAcceptGhost}
        />
      </div>
      <div className="ms-focus-hud">
        <span>{wordCount(props.value).toLocaleString()} words</span>
        {props.sprintText && <span className="ember-text">⏱ {props.sprintText}</span>}
        <span>Ctrl+Space — ghost</span>
        <span>Esc — exit</span>
      </div>
    </div>
  )
}
