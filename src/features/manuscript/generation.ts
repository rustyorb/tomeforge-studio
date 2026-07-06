import type { Pacing, Project } from '../../types'
import { tailOfManuscript } from '../../lib/context'

export type GenKind =
  | 'continue'
  | 'extend'
  | 'fork'
  | 'opening'
  | 'transition'
  | 'climax'
  | 'ending'
  | 'rewrite'

/** Everything except rewrite shares the excerpt→prose flow. */
export type ProseKind = Exclude<GenKind, 'rewrite'>

export const GEN_LABELS: Record<GenKind, string> = {
  continue: 'Continuation',
  extend: 'Scene Extension',
  fork: 'Fork',
  opening: 'Chapter Opening',
  transition: 'Transition',
  climax: 'Climax Beat',
  ending: 'Chapter Ending',
  rewrite: 'Rewrite',
}

export interface GenOverrides {
  /** '' = use the style profile's pacing */
  pacing: Pacing | ''
  /** null = no override; 0 = interiority/description, 10 = conversation-driven */
  dialogueRatio: number | null
}

const BASE_DIRECTIVES: Record<ProseKind, string> = {
  continue:
    'Continue the story seamlessly from the exact point where the provided excerpt ends. ' +
    'Write 2-5 paragraphs of new prose. Do not repeat, rephrase, or summarize the excerpt.',
  extend:
    'Expand and deepen the current scene without advancing the plot or changing its direction. ' +
    'Enrich what is already happening — sensory texture, interiority, tension between the lines — ' +
    'in 2-5 paragraphs that flow naturally from the excerpt.',
  fork:
    'Continue the story from the exact point where the provided excerpt ends, committing boldly ' +
    'to one distinct direction it could take. Write 2-5 paragraphs of new prose. Do not repeat the excerpt.',
  opening:
    "Write a chapter-opening passage: ground the reader in place, time, and point of view within " +
    "the first lines, and set the chapter's dramatic question in motion. 2-4 paragraphs.",
  transition:
    "Write a transition passage that carries the story from the current moment into the chapter's " +
    'next movement — shift time, place, or focus without losing momentum. 1-3 paragraphs.',
  climax:
    'Write a climax beat for the current chapter: bring its central tension to its sharpest point ' +
    'and force a real consequence. 2-5 paragraphs.',
  ending:
    "Write a chapter-ending passage: land the chapter's emotional note and close on a hook that " +
    'pulls the reader onward. 1-3 paragraphs.',
}

function overridesText(o: GenOverrides): string {
  const parts: string[] = []
  if (o.pacing) parts.push(`Pacing override for this passage: ${o.pacing}.`)
  if (o.dialogueRatio !== null) {
    const v = o.dialogueRatio
    const flavor =
      v <= 1
        ? 'no dialogue — carry everything through interiority and description'
        : v <= 3
          ? 'very little dialogue; favor interiority and description'
          : v <= 6
            ? 'a balanced mix of dialogue and narration'
            : v <= 8
              ? 'dialogue-forward; let conversation carry most of the passage'
              : 'conversation-driven; nearly all dialogue with lean narration between lines'
    parts.push(`Dialogue ratio ${v}/10: ${flavor}.`)
  }
  return parts.join(' ')
}

export function buildDirective(kind: ProseKind, overrides: GenOverrides): string {
  return [BASE_DIRECTIVES[kind], overridesText(overrides)].filter(Boolean).join(' ')
}

export function buildRewriteDirective(
  target: 'scene' | 'passage',
  instruction: string,
  overrides: GenOverrides,
): string {
  return [
    target === 'scene'
      ? 'Rewrite the entire scene supplied in the user message.'
      : 'Rewrite the passage supplied in the user message.',
    instruction.trim() ? `Rewrite instruction: ${instruction.trim()}.` : '',
    'Preserve continuity and every established fact. Keep roughly the original length unless the ' +
      'instruction says otherwise. Return only the rewritten prose — no commentary.',
    overridesText(overrides),
  ]
    .filter(Boolean)
    .join(' ')
}

const EXCERPT_CHARS = 4000
const SHORT_SCENE_THRESHOLD = 600

/**
 * The prose the model continues from: the last ~4000 chars of the current
 * scene, or the whole-manuscript tail when the scene is still short.
 */
export function excerptFor(project: Project, sceneContent: string): string {
  const scene = sceneContent.trim()
  if (scene.length >= SHORT_SCENE_THRESHOLD) return scene.slice(-EXCERPT_CHARS)
  return tailOfManuscript(project, EXCERPT_CHARS)
}

export function userMessage(
  kind: ProseKind,
  excerpt: string,
  sceneTitle: string,
  chapterTitle: string,
): string {
  if (!excerpt.trim()) {
    return (
      `The manuscript is empty so far. The current chapter is "${chapterTitle}" and the current ` +
      `scene is "${sceneTitle}". Write the requested passage to begin it.`
    )
  }
  const closing =
    kind === 'extend'
      ? 'Expand and deepen this scene as instructed.'
      : kind === 'continue' || kind === 'fork'
        ? 'Continue from exactly where this excerpt ends.'
        : 'Write the requested chapter beat so it follows naturally from here.'
  return `Manuscript so far (most recent excerpt; current chapter "${chapterTitle}", scene "${sceneTitle}"):\n\n${excerpt}\n\n${closing}`
}
