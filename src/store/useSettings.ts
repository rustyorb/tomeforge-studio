import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PROVIDERS } from '../lib/providers'

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
  /** Default model used for all generations from this provider */
  model: string
  /** Model ids fetched from the provider's /models endpoint */
  models: string[]
}

export type ThemeId = 'ember' | 'parchment' | 'abyss'

interface SettingsStore {
  /** Active provider id — all AI calls go through this one */
  provider: string
  providers: Record<string, ProviderConfig>
  maxTokens: number
  theme: ThemeId
  /** Daily writing goal in words; 0 = goal off */
  dailyGoal: number
  /** Local image generation backend */
  imageProvider: 'off' | 'a1111' | 'comfy'
  a1111Url: string
  comfyUrl: string
  /** ComfyUI checkpoint filename; blank = first available (built-in workflow only) */
  comfyCheckpoint: string
  /** Custom ComfyUI workflow (API-format JSON text); '' = built-in txt2img */
  comfyWorkflow: string
  /** "widthxheight" for generated images */
  imageSize: string
  setProvider: (id: string) => void
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void
  setMaxTokens: (n: number) => void
  setTheme: (t: ThemeId) => void
  setDailyGoal: (n: number) => void
  setImageGen: (patch: Partial<Pick<SettingsStore, 'imageProvider' | 'a1111Url' | 'comfyUrl' | 'comfyCheckpoint' | 'comfyWorkflow' | 'imageSize'>>) => void
}

function defaultProviders(): Record<string, ProviderConfig> {
  const out: Record<string, ProviderConfig> = {}
  for (const p of PROVIDERS) {
    out[p.id] = {
      apiKey: '',
      baseUrl: p.baseUrl,
      model: p.fallbackModels[0] ?? '',
      models: [],
    }
  }
  return out
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      providers: defaultProviders(),
      maxTokens: 2048,
      theme: 'ember',
      dailyGoal: 0,
      imageProvider: 'off',
      // '/a1111' and '/comfy' ride the dev-server proxy (see vite.config.ts):
      // same-origin, so the backends need no CORS flags. Absolute http:// URLs
      // also work for direct calls.
      a1111Url: '/a1111',
      comfyUrl: '/comfy',
      comfyCheckpoint: '',
      comfyWorkflow: '',
      imageSize: '512x768',
      setProvider: (id) => set({ provider: id }),
      updateProvider: (id, patch) =>
        set((s) => ({
          providers: { ...s.providers, [id]: { ...s.providers[id], ...patch } },
        })),
      setMaxTokens: (n) => set({ maxTokens: n }),
      setTheme: (t) => set({ theme: t }),
      setDailyGoal: (n) => set({ dailyGoal: Math.max(0, Math.floor(n) || 0) }),
      setImageGen: (patch) => set(patch),
    }),
    {
      name: 'tomeforge-settings',
      version: 1,
      // v0 shape was { apiKey, model, maxTokens } (Anthropic only).
      migrate: (persisted, version) => {
        if (version === 0) {
          const old = persisted as { apiKey?: string; model?: string; maxTokens?: number }
          const providers = defaultProviders()
          providers.anthropic = {
            ...providers.anthropic,
            apiKey: old.apiKey ?? '',
            model: old.model || providers.anthropic.model,
          }
          return { provider: 'anthropic', providers, maxTokens: old.maxTokens ?? 2048 }
        }
        return persisted as Partial<SettingsStore>
      },
      // Deep-merge providers so newly added providers appear for existing users.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsStore>
        return {
          ...current,
          ...p,
          providers: { ...current.providers, ...(p.providers ?? {}) },
        }
      },
    },
  ),
)

/** Config for the active provider (always defined). */
export function activeProviderConfig(): { id: string; config: ProviderConfig } {
  const s = useSettings.getState()
  const config = s.providers[s.provider] ?? defaultProviders()[s.provider]
  return { id: s.provider, config }
}
