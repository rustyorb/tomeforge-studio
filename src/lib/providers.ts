// Provider registry: every AI backend TomeForge can talk to.
// Two wire protocols cover all of them: Anthropic's Messages API and the
// OpenAI-compatible chat/completions API (OpenAI, OpenRouter, Groq, Mistral,
// LM Studio, Ollama all speak the latter).

export type Protocol = 'anthropic' | 'openai'

export interface ProviderDef {
  id: string
  name: string
  protocol: Protocol
  baseUrl: string
  needsKey: boolean
  local?: boolean
  keyHint?: string
  corsNote?: string
  /** Shown before the user fetches the live list */
  fallbackModels: string[]
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    keyHint: 'console.anthropic.com → API Keys',
    fallbackModels: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    keyHint: 'platform.openai.com → API Keys',
    fallbackModels: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    keyHint: 'openrouter.ai → Keys (one key, hundreds of models)',
    fallbackModels: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct'],
  },
  {
    id: 'groq',
    name: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    keyHint: 'console.groq.com → API Keys',
    fallbackModels: ['llama-3.3-70b-versatile'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    needsKey: true,
    keyHint: 'console.mistral.ai → API Keys',
    fallbackModels: ['mistral-large-latest', 'mistral-small-latest'],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    protocol: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false,
    local: true,
    corsNote:
      'In LM Studio: Developer tab → start the server and enable CORS, then load a model.',
    fallbackModels: [],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    local: true,
    corsNote:
      'Ollama must allow browser origins: set OLLAMA_ORIGINS=* (env var) and restart Ollama.',
    fallbackModels: [],
  },
]

export function getProviderDef(id: string): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}
