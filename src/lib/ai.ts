import { activeProviderConfig, useSettings } from '../store/useSettings'
import { getProviderDef } from './providers'
import type { ProviderDef } from './providers'

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
  constructor(providerName: string) {
    super(`No API key configured for ${providerName}. Add it in Settings.`)
    this.name = 'AIKeyMissingError'
  }
}

async function errorDetail(res: Response): Promise<string> {
  let detail = res.statusText
  try {
    const body = await res.json()
    detail = body?.error?.message ?? body?.error ?? detail
    if (typeof detail !== 'string') detail = JSON.stringify(detail)
  } catch {
    /* non-JSON error body */
  }
  return `API error (${res.status}): ${detail}`
}

/**
 * Iterate SSE `data:` payloads from a streaming response, invoking onEvent
 * for each JSON payload. Handles chunk boundaries and skips non-JSON lines.
 */
async function readSSE(res: Response, onEvent: (event: any) => void): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
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
        onEvent(JSON.parse(payload))
      } catch (e) {
        if (e instanceof SyntaxError) continue // partial/keep-alive line
        throw e
      }
    }
  }
}

async function streamAnthropic(
  def: ProviderDef,
  conf: { apiKey: string; baseUrl: string; model: string },
  maxTokens: number,
  opts: StreamOptions,
): Promise<string> {
  const res = await fetch(`${conf.baseUrl}/messages`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': conf.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: conf.model,
      max_tokens: opts.maxTokens ?? maxTokens,
      temperature: opts.temperature ?? 0.8,
      system: opts.system,
      messages: opts.messages,
      stream: true,
    }),
  })
  if (!res.ok) throw new Error(await errorDetail(res))

  let full = ''
  await readSSE(res, (event) => {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      full += event.delta.text
      opts.onDelta?.(event.delta.text)
    }
    if (event.type === 'error') {
      throw new Error(event.error?.message ?? 'Stream error')
    }
  })
  return full
}

async function streamOpenAI(
  def: ProviderDef,
  conf: { apiKey: string; baseUrl: string; model: string },
  maxTokens: number,
  opts: StreamOptions,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (conf.apiKey) headers.authorization = `Bearer ${conf.apiKey}`

  const res = await fetch(`${conf.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers,
    body: JSON.stringify({
      model: conf.model,
      max_tokens: opts.maxTokens ?? maxTokens,
      temperature: opts.temperature ?? 0.8,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
      stream: true,
    }),
  })
  if (!res.ok) throw new Error(await errorDetail(res))

  let full = ''
  await readSSE(res, (event) => {
    const delta: string | undefined = event.choices?.[0]?.delta?.content
    if (delta) {
      full += delta
      opts.onDelta?.(delta)
    }
    if (event.error) {
      throw new Error(event.error?.message ?? 'Stream error')
    }
  })
  return full
}

/**
 * Stream a completion from the active provider (see Settings). Resolves with
 * the full text; calls onDelta with each chunk.
 */
export async function streamMessage(opts: StreamOptions): Promise<string> {
  const { id, config } = activeProviderConfig()
  const def = getProviderDef(id)
  const { maxTokens } = useSettings.getState()

  if (def.needsKey && !config.apiKey) throw new AIKeyMissingError(def.name)
  if (!config.model) {
    throw new Error(`No model selected for ${def.name}. Pick one in Settings.`)
  }

  return def.protocol === 'anthropic'
    ? streamAnthropic(def, config, maxTokens, opts)
    : streamOpenAI(def, config, maxTokens, opts)
}

/**
 * Fetch the model list from a provider's server. Works for Anthropic's
 * /models and all OpenAI-compatible /models endpoints (incl. LM Studio,
 * Ollama, OpenRouter, Groq, Mistral).
 */
export async function fetchModels(providerId: string): Promise<string[]> {
  const def = getProviderDef(providerId)
  const conf = useSettings.getState().providers[providerId]
  if (def.needsKey && !conf.apiKey && providerId !== 'openrouter') {
    // OpenRouter's model list is public; everyone else needs the key.
    throw new AIKeyMissingError(def.name)
  }

  const headers: Record<string, string> = {}
  if (def.protocol === 'anthropic') {
    headers['x-api-key'] = conf.apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (conf.apiKey) {
    headers.authorization = `Bearer ${conf.apiKey}`
  }

  const url =
    def.protocol === 'anthropic' ? `${conf.baseUrl}/models?limit=1000` : `${conf.baseUrl}/models`
  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch {
    throw new Error(
      def.local
        ? `Could not reach ${def.name} at ${conf.baseUrl}. Is the server running? ${def.corsNote ?? ''}`
        : `Could not reach ${def.name} at ${conf.baseUrl}.`,
    )
  }
  if (!res.ok) throw new Error(await errorDetail(res))

  const body = await res.json()
  const ids = (body?.data ?? [])
    .map((m: { id?: string }) => m?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b))
  if (!ids.length) {
    throw new Error(
      def.local
        ? `${def.name} returned no models — load/pull a model in ${def.name} first.`
        : `${def.name} returned no models.`,
    )
  }
  return ids
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
