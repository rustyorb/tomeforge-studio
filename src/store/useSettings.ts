import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Settings } from '../types'

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      model: 'claude-sonnet-5',
      maxTokens: 2048,
      set: (patch) => set(patch),
    }),
    { name: 'tomeforge-settings' },
  ),
)
