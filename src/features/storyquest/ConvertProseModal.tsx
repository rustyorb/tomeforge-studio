import { useEffect, useRef, useState } from 'react'
import type { Project, QuestState, StyleProfile } from '../../types'
import { useStore } from '../../store/useStore'
import { uid } from '../../lib/id'
import { CopyButton, ErrorBanner, Modal, StreamView } from '../../components/ui'
import { convertQuestToProse } from './gm'

export function ConvertProseModal(props: {
  project: Project
  styleProfile: StyleProfile | null
  quest: QuestState
  onClose: () => void
}) {
  const { project, styleProfile, quest, onClose } = props
  const updateProject = useStore((s) => s.updateProject)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(true)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const controller = new AbortController()
    void (async () => {
      try {
        const result = await convertQuestToProse({
          project,
          styleProfile,
          quest,
          signal: controller.signal,
          onDelta: (chunk) => setText((t) => t + chunk),
        })
        setText(result)
        setDone(true)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        setBusy(false)
      }
    })()
    return () => {
      // Release the once-guard: an aborted conversion was never delivered,
      // so StrictMode's simulated unmount must not suppress the re-run.
      controller.abort()
      started.current = false
      setText('')
      setBusy(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveAsScene = () => {
    updateProject(project.id, (draft) => {
      draft.chapters.push({
        id: uid(),
        title: `From StoryQuest — ${new Date().toLocaleDateString()}`,
        scenes: [{ id: uid(), title: 'Converted Scene', content: text }],
      })
    })
    onClose()
  }

  return (
    <Modal title="Convert to Prose" onClose={onClose}>
      <ErrorBanner error={error} />
      <div className="sq-convert-preview">
        {busy ? (
          <StreamView text={text} busy />
        ) : (
          text && <div className="prose-block">{text}</div>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {!busy && text && <CopyButton text={text} />}
        <button className="btn ghost small" onClick={onClose}>
          {busy ? 'Cancel' : 'Discard'}
        </button>
        <button className="btn primary" disabled={!done || !text.trim()} onClick={saveAsScene}>
          Save as Scene
        </button>
      </div>
    </Modal>
  )
}
