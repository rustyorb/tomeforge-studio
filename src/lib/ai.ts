import { useSettings } from '../store/useSettings'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamOptions {
  system: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onDelta?: (text: string) => void
}

export class AIKeyMissingError extends Error {
  constructor() {
    super('No API key configured. Add your Anthropic API key in Settings.')
    this.name = 'AIKeyMissingError'
  }
}

/**
 * Stream a completion from the Anthropic Messages API directly from the
 * browser. Resolves with the full text; calls onDelta with each chunk.
 */
export async function streamMessage(opts: StreamOptions): Promise<string> {
  const { apiKey, model, maxTokens } = useSettings.getState()
  if (!apiKey) throw new AIKeyMissingError()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? maxTokens,
      temperature: opts.temperature ?? 0.8,
      system: opts.system,
      messages: opts.messages,
      stream: true,
    }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body?.error?.message ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`API error (${res.status}): ${detail}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const event = JSON.parse(payload)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          full += event.delta.text
          opts.onDelta?.(event.delta.text)
        }
        if (event.type === 'error') {
          throw new Error(event.error?.message ?? 'Stream error')
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue // partial JSON line
        throw e
      }
    }
  }
  return full
}

/** Extract the first fenced ```json block from model output, if any. */
export function extractJsonBlock(text: string): unknown | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const MODELS = [
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 (recommended)' },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8 (strongest)' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (fastest)' },
]
