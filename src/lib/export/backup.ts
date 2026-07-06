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
    projects: data.projects as unknown as Project[],
    styleProfiles: rawProfiles as unknown as StyleProfile[],
  }
}
