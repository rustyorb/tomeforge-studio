import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Project, STBookStored, STCardStored, StyleProfile } from '../types'
import { DEFAULT_STYLE_CONTROLS } from '../types'
import { uid } from '../lib/id'
import { seedProject, seedStyleProfiles } from './seed'

interface Store {
  projects: Project[]
  styleProfiles: StyleProfile[]
  activeProjectId: string | null
  /** SillyTavern library — imported cards/lorebooks, reusable across tomes */
  stLibrary: (STCardStored | STBookStored)[]
  addToSTLibrary: (items: (STCardStored | STBookStored)[]) => void
  removeFromSTLibrary: (id: string) => void
  updateSTLibraryItem: (id: string, recipe: (item: STCardStored | STBookStored) => void) => void

  setActiveProject: (id: string | null) => void
  createProject: (name: string, genre: string, logline: string) => string
  deleteProject: (id: string) => void
  /**
   * Central mutation entry point. Pass an immer recipe that mutates the
   * project draft in place. Automatically bumps updatedAt.
   */
  updateProject: (id: string, recipe: (draft: Project) => void) => void

  /**
   * Push a version snapshot of a scene's current content (newest first,
   * capped). Call before any destructive AI accept/replace.
   */
  snapshotScene: (projectId: string, sceneId: string, label: string) => void

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
const SNAPSHOT_CAP = 20

/**
 * Record today's manuscript word count on the project's writing log, at most
 * once every few seconds (counting the whole manuscript per keystroke would
 * be wasteful). The log keeps the highest total seen per day, so "words
 * written today" survives deletions and mid-day edits.
 */
const lastLogAt = new Map<string, number>()
function maybeLogWords(project: Project): void {
  const now = Date.now()
  if (now - (lastLogAt.get(project.id) ?? 0) < 3000) return
  lastLogAt.set(project.id, now)
  const text = project.chapters.flatMap((c) => c.scenes.map((s) => s.content)).join(' ')
  const total = text.trim() ? text.trim().split(/\s+/).length : 0
  const day = new Date().toISOString().slice(0, 10)
  if (!project.wordLog) project.wordLog = {}
  project.wordLog[day] = Math.max(project.wordLog[day] ?? 0, total)
}

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
      stLibrary: [],

      addToSTLibrary: (items) =>
        set((s) => {
          if (!s.stLibrary) s.stLibrary = []
          s.stLibrary.unshift(...items)
        }),

      removeFromSTLibrary: (id) =>
        set((s) => {
          s.stLibrary = (s.stLibrary ?? []).filter((x) => x.id !== id)
        }),

      updateSTLibraryItem: (id, recipe) =>
        set((s) => {
          const item = (s.stLibrary ?? []).find((x) => x.id === id)
          if (item) recipe(item)
        }),

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
            wordLogStart: 0,
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
          maybeLogWords(project)
        }),

      snapshotScene: (projectId, sceneId, label) =>
        set((s) => {
          const project = s.projects.find((p) => p.id === projectId)
          if (!project) return
          for (const ch of project.chapters) {
            const scene = ch.scenes.find((sc) => sc.id === sceneId)
            if (!scene) continue
            if (!scene.snapshots) scene.snapshots = []
            // Skip no-op snapshots (identical to the latest one).
            if (scene.snapshots[0]?.content === scene.content) return
            scene.snapshots.unshift({
              id: uid(),
              label,
              createdAt: Date.now(),
              content: scene.content,
            })
            if (scene.snapshots.length > SNAPSHOT_CAP) {
              scene.snapshots.length = SNAPSHOT_CAP
            }
            return
          }
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
