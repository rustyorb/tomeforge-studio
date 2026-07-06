import type { Chapter, ID, Project, Scene } from '../../types'

export function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export function manuscriptWordCount(project: Project): number {
  return project.chapters.reduce(
    (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + wordCount(sc.content), 0),
    0,
  )
}

export interface SceneRef {
  chapter: Chapter
  scene: Scene
}

/** Locate a scene (and its chapter) by id. */
export function findScene(project: Project, sceneId: ID | null): SceneRef | null {
  if (!sceneId) return null
  for (const chapter of project.chapters) {
    const scene = chapter.scenes.find((s) => s.id === sceneId)
    if (scene) return { chapter, scene }
  }
  return null
}

/** First scene of the manuscript, if any. */
export function firstScene(project: Project): SceneRef | null {
  for (const chapter of project.chapters) {
    if (chapter.scenes.length > 0) return { chapter, scene: chapter.scenes[0] }
  }
  return null
}

/** Find a scene inside an immer draft for mutation. */
export function sceneDraft(draft: Project, sceneId: ID): Scene | null {
  for (const chapter of draft.chapters) {
    const scene = chapter.scenes.find((s) => s.id === sceneId)
    if (scene) return scene
  }
  return null
}

/** Append generated prose to scene content with a blank-line separator. */
export function appendToScene(content: string, addition: string): string {
  const base = content.replace(/\s+$/, '')
  const add = addition.trim()
  if (!base) return add
  return `${base}\n\n${add}`
}
