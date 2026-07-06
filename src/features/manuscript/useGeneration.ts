import { useCallback, useEffect, useRef, useState } from 'react'
import { streamMessage } from '../../lib/ai'
import { uid } from '../../lib/id'
import type { ID } from '../../types'
import type { GenKind } from './generation'

export interface StreamSlot {
  label: string
  text: string
  busy: boolean
  error: string | null
  /** True when the user stopped this stream mid-flight (normal cancel). */
  aborted: boolean
}

export interface RewriteMeta {
  target: 'scene' | 'passage'
  /** Exact original text captured when the rewrite started. */
  original: string
  instruction: string
}

export interface GenJob {
  id: string
  kind: GenKind
  /** Scene the generation was started from (accept targets this scene). */
  sceneId: ID
  slots: StreamSlot[]
  rewrite?: RewriteMeta
}

export interface StreamRequest {
  label: string
  system: string
  user: string
  temperature: number
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException || e instanceof Error) && e.name === 'AbortError'
  )
}

/**
 * Manages one generation job at a time: 1..n parallel streams, a shared
 * AbortController, and per-slot accumulation of streamed text.
 */
export function useGeneration() {
  const [job, setJob] = useState<GenJob | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const busy = job !== null && job.slots.some((s) => s.busy)

  // Abort in-flight streams when the page unmounts — otherwise navigating
  // away leaves the API requests running with no way to recover the output.
  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(
    (kind: GenKind, sceneId: ID, requests: StreamRequest[], rewrite?: RewriteMeta) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const jobId = uid()

      setJob({
        id: jobId,
        kind,
        sceneId,
        rewrite,
        slots: requests.map((r) => ({
          label: r.label,
          text: '',
          busy: true,
          error: null,
          aborted: false,
        })),
      })

      const update = (i: number, fn: (s: StreamSlot) => StreamSlot) => {
        setJob((j) => {
          if (!j || j.id !== jobId) return j
          const slots = j.slots.slice()
          slots[i] = fn(slots[i])
          return { ...j, slots }
        })
      }

      void Promise.allSettled(
        requests.map((r, i) =>
          streamMessage({
            system: r.system,
            messages: [{ role: 'user', content: r.user }],
            temperature: r.temperature,
            signal: controller.signal,
            onDelta: (t) => update(i, (s) => ({ ...s, text: s.text + t })),
          })
            .then(() => update(i, (s) => ({ ...s, busy: false })))
            .catch((e: unknown) => {
              if (isAbortError(e)) {
                update(i, (s) => ({ ...s, busy: false, aborted: true }))
              } else {
                const message = e instanceof Error ? e.message : String(e)
                update(i, (s) => ({ ...s, busy: false, error: message }))
              }
            }),
        ),
      )
    },
    [],
  )

  /** Stop all in-flight streams; partial text is kept (normal cancel). */
  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** Discard the whole job (aborts anything still streaming). */
  const dismiss = useCallback(() => {
    abortRef.current?.abort()
    setJob(null)
  }, [])

  /** Discard a single slot; clears the job when the last slot goes. */
  const dismissSlot = useCallback((i: number) => {
    setJob((j) => {
      if (!j) return j
      const slots = j.slots.filter((_, idx) => idx !== i)
      return slots.length > 0 ? { ...j, slots } : null
    })
  }, [])

  return { job, busy, run, stop, dismiss, dismissSlot }
}
