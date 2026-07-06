import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Project, StyleProfile } from '../types'
import { DEFAULT_STYLE_CONTROLS } from '../types'
import { uid } from '../lib/id'
import { seedProject, seedStyleProfiles } from './seed'

interface Store {
  projects: Project[]
  styleProfiles: StyleProfile[]
  activeProjectId: string | null

  setActiveProject: (id: string | null) => void
  createProject: (name: string, genre: string, logline: string) => string
  deleteProject: (id: string) => void
  /**
   * Central mutation entry point. Pass an immer recipe that mutates the
   * project draft in place. Automatically bumps updatedAt.
   */
  updateProject: (id: string, recipe: (draft: Project) => void) => void

  createStyleProfile: (name: string) => string
  updateStyleProfile: (id: string, recipe: (draft: StyleProfile) => void) => void
  deleteStyleProfile: (id: string) => void
}

/**
 * localStorage wrapper that survives QuotaExceededError. zustand's persist
 * writes synchronously on every set; without this, a manuscript that outgrows
 * the ~5 MB quota makes every keystroke throw and silently stops persisting.
 * Failures are broadcast so the UI can warn that changes aren't being saved.
 * NOTE: must be declared before the store — createJSONStorage reads it eagerly.
 */
export const STORAGE_EVENT = 'tomeforge-storage'
const safeLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { ok: true } }))
    } catch {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { ok: false } }))
    }
  },
  removeItem: (key: string) => localStorage.removeItem(key),
}

export const useStore = create<Store>()(
  persist(
    immer((set) => ({
      projects: [seedProject()],
      styleProfiles: seedStyleProfiles(),
      activeProjectId: null,

      setActiveProject: (id) =>
        set((s) => {
          s.activeProjectId = id
        }),

      createProject: (name, genre, logline) => {
        const id = uid()
        set((s) => {
          const now = Date.now()
          s.projects.push({
            id,
            name,
            genre,
            logline,
            createdAt: now,
            updatedAt: now,
            chapters: [
              {
                id: uid(),
                title: 'Chapter 1',
                scenes: [{ id: uid(), title: 'Opening Scene', content: '' }],
              },
            ],
            memory: '',
            authorNote: '',
            canonMode: 'guided',
            codex: [],
            characters: [],
            threads: [],
            timeline: [],
            notes: '',
            styleProfileId: null,
            presetId: 'clean-continuation',
            quest: null,
            branches: [],
          })
          s.activeProjectId = id
        })
        return id
      },

      deleteProject: (id) =>
        set((s) => {
          s.projects = s.projects.filter((p) => p.id !== id)
          if (s.activeProjectId === id) s.activeProjectId = null
        }),

      updateProject: (id, recipe) =>
        set((s) => {
          const project = s.projects.find((p) => p.id === id)
          if (!project) return
          recipe(project)
          project.updatedAt = Date.now()
        }),

      createStyleProfile: (name) => {
        const id = uid()
        set((s) => {
          s.styleProfiles.push({
            id,
            name,
            description: '',
            controls: { ...DEFAULT_STYLE_CONTROLS },
            povLock: '',
            tenseLock: '',
            voiceNotes: '',
          })
        })
        return id
      },

      updateStyleProfile: (id, recipe) =>
        set((s) => {
          const profile = s.styleProfiles.find((p) => p.id === id)
          if (profile) recipe(profile)
        }),

      deleteStyleProfile: (id) =>
        set((s) => {
          s.styleProfiles = s.styleProfiles.filter((p) => p.id !== id)
          for (const project of s.projects) {
            if (project.styleProfileId === id) project.styleProfileId = null
          }
        }),
    })),
    {
      name: 'tomeforge-projects',
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
)

/** Convenience hook: the currently active project, or null. */
export function useActiveProject(): Project | null {
  return useStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null)
}

/** Convenience hook: the style profile assigned to a project. */
export function useProjectStyle(project: Project | null): StyleProfile | null {
  return useStore(
    (s) => s.styleProfiles.find((sp) => sp.id === project?.styleProfileId) ?? null,
  )
}
