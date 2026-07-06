// ---------- Full/partial backup + validated import (pure functions) ----------

import type { Project, StyleProfile } from '../../types'

const APP_MARKER = 'tomeforge'
const BACKUP_VERSION = 1

export interface BackupPayload {
  projects: Project[]
  styleProfiles: StyleProfile[]
}

/** Serialize every project and style profile to a versioned backup JSON. */
export function fullBackup(projects: Project[], styleProfiles: StyleProfile[]): string {
  return JSON.stringify(
    {
      app: APP_MARKER,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
      styleProfiles,
    },
    null,
    2,
  )
}

/** Serialize a single project to the same backup format. */
export function projectBackup(project: Project): string {
  return JSON.stringify(
    {
      app: APP_MARKER,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      projects: [project],
      styleProfiles: [],
    },
    null,
    2,
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

/**
 * Coerce a validated-but-possibly-incomplete project into a fully-formed
 * Project. Backups trimmed by hand or produced by older/third-party tools may
 * omit the codex/characters/threads/timeline/branches arrays; without this,
 * pages that map over them crash the whole app (and re-crash on every reload,
 * since the bad project is persisted). Every field gets a safe default.
 */
function normalizeProject(p: Record<string, unknown>): Project {
  const chapters = asArray(p.chapters).map((ch) => {
    const c = isRecord(ch) ? ch : {}
    return {
      id: asString(c.id) || Math.random().toString(36).slice(2, 10),
      title: asString(c.title, 'Untitled Chapter'),
      scenes: asArray(c.scenes).map((sc) => {
        const s = isRecord(sc) ? sc : {}
        return {
          id: asString(s.id) || Math.random().toString(36).slice(2, 10),
          title: asString(s.title, 'Untitled Scene'),
          content: asString(s.content),
          summary: typeof s.summary === 'string' ? s.summary : undefined,
          snapshots: Array.isArray(s.snapshots) ? (s.snapshots as never) : undefined,
        }
      }),
    }
  })
  const canonModes = ['loose', 'guided', 'strict', 'sandbox']
  return {
    id: asString(p.id),
    name: asString(p.name, 'Untitled'),
    genre: asString(p.genre),
    logline: asString(p.logline),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    chapters,
    memory: asString(p.memory),
    authorNote: asString(p.authorNote),
    canonMode: (canonModes.includes(p.canonMode as string) ? p.canonMode : 'guided') as Project['canonMode'],
    codex: asArray(p.codex) as never,
    characters: asArray(p.characters) as never,
    threads: asArray(p.threads) as never,
    timeline: asArray(p.timeline) as never,
    notes: asString(p.notes),
    styleProfileId: typeof p.styleProfileId === 'string' ? p.styleProfileId : null,
    presetId: asString(p.presetId, 'clean-continuation'),
    quest: isRecord(p.quest) ? (p.quest as never) : null,
    branches: asArray(p.branches) as never,
    castWeb: isRecord(p.castWeb) ? (p.castWeb as never) : null,
    wordLog: isRecord(p.wordLog) ? (p.wordLog as never) : undefined,
    wordLogStart: typeof p.wordLogStart === 'number' ? p.wordLogStart : undefined,
  }
}

/**
 * Parse and validate backup JSON. Returns the projects and style profiles
 * it contains, or throws a descriptive Error explaining what is wrong.
 */
export function parseBackup(text: string): BackupPayload {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isRecord(data)) {
    throw new Error('Backup must be a JSON object.')
  }
  if (data.app !== APP_MARKER) {
    throw new Error("Not a TomeForge backup — missing the 'tomeforge' app marker.")
  }
  if (data.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${JSON.stringify(data.version)} — this build reads version ${BACKUP_VERSION}.`,
    )
  }
  if (!Array.isArray(data.projects)) {
    throw new Error("Backup is missing its 'projects' array.")
  }
  const rawProfiles = data.styleProfiles ?? []
  if (!Array.isArray(rawProfiles)) {
    throw new Error("'styleProfiles' must be an array when present.")
  }

  data.projects.forEach((p: unknown, i: number) => {
    const label = `Project #${i + 1}`
    if (!isRecord(p)) throw new Error(`${label} is not an object.`)
    if (typeof p.id !== 'string' || !p.id) {
      throw new Error(`${label} is missing a string 'id'.`)
    }
    if (typeof p.name !== 'string') {
      throw new Error(`${label} is missing a string 'name'.`)
    }
    if (!Array.isArray(p.chapters)) {
      throw new Error(`${label} ("${p.name}") is missing its 'chapters' array.`)
    }
    p.chapters.forEach((ch: unknown, j: number) => {
      if (!isRecord(ch) || !Array.isArray(ch.scenes)) {
        throw new Error(
          `${label} ("${p.name}") chapter #${j + 1} is malformed — expected an object with a 'scenes' array.`,
        )
      }
    })
  })

  rawProfiles.forEach((sp: unknown, i: number) => {
    const label = `Style profile #${i + 1}`
    if (!isRecord(sp)) throw new Error(`${label} is not an object.`)
    if (typeof sp.id !== 'string' || !sp.id) {
      throw new Error(`${label} is missing a string 'id'.`)
    }
    if (typeof sp.name !== 'string') {
      throw new Error(`${label} is missing a string 'name'.`)
    }
  })

  return {
    // Normalize so trimmed/legacy projects can't crash pages after import.
    projects: (data.projects as Record<string, unknown>[]).map(normalizeProject),
    styleProfiles: rawProfiles as unknown as StyleProfile[],
  }
}
