import { useCallback, useEffect, useRef, useState } from 'react'
import { streamMessage } from '../../lib/ai'
import type { StreamOptions } from '../../lib/ai'

export type StreamTaskOptions = Omit<StreamOptions, 'signal' | 'onDelta'>

/**
 * Shared streaming-task state for the Story Brain AI assists:
 * accumulated text, busy flag, friendly error, and abortable run/stop.
 * An aborted run keeps whatever partial text arrived and is not an error.
 */
export function useStreamTask() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(async (opts: StreamTaskOptions): Promise<string | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setText('')
    setError(null)
    setBusy(true)
    let acc = ''
    try {
      const full = await streamMessage({
        ...opts,
        signal: controller.signal,
        onDelta: (delta) => {
          acc += delta
          setText(acc)
        },
      })
      return full
    } catch (e) {
      if (controller.signal.aborted) return null // user stop — keep partial text
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { text, setText, busy, error, setError, run, stop }
}
