import type { Preset } from '../types'

export const PRESETS: Preset[] = [
  {
    id: 'clean-continuation',
    name: 'Clean Continuation',
    description: 'Faithful, seamless continuation of the current prose.',
    temperature: 0.8,
    directive:
      'Continue the story seamlessly. Match the established voice exactly. Introduce nothing that changes the scene direction. Prioritize coherence over novelty.',
  },
  {
    id: 'wild-brainstorm',
    name: 'Wild Brainstorm',
    description: 'High creativity, surprising turns, looser canon.',
    temperature: 1.0,
    directive:
      'Be bold and surprising. Take creative risks, introduce unexpected turns and vivid invention, while staying emotionally truthful to the characters.',
  },
  {
    id: 'strict-canon',
    name: 'Strict Canon',
    description: 'Maximum fidelity to established lore and facts.',
    temperature: 0.6,
    directive:
      'Treat every established fact as inviolable. Invent no new world facts, names, or history. When in doubt, stay small and grounded in what is known.',
  },
  {
    id: 'lyrical-prose',
    name: 'Lyrical Prose',
    description: 'Musical, image-rich literary style.',
    temperature: 0.9,
    directive:
      'Write with lyrical, image-rich prose. Attend to rhythm and sound. Favor sensory metaphor over exposition, but never let style obscure clarity.',
  },
  {
    id: 'dialogue-heavy',
    name: 'Dialogue Heavy',
    description: 'Scene driven by conversation and subtext.',
    temperature: 0.85,
    directive:
      'Drive the scene through dialogue. Give each speaker a distinct cadence. Let subtext carry the conflict; keep narration lean between lines.',
  },
  {
    id: 'action-scene',
    name: 'Action Scene',
    description: 'Kinetic, punchy, high-momentum sequences.',
    temperature: 0.85,
    directive:
      'Write kinetic action. Short sentences at peaks. Concrete physical detail, clear spatial logic, real consequences. Keep momentum relentless.',
  },
  {
    id: 'slow-burn',
    name: 'Slow Burn',
    description: 'Patient, atmospheric, tension accumulating.',
    temperature: 0.8,
    directive:
      'Slow the pace. Accumulate atmosphere and small tensions. Let silences and gestures do the work. Delay gratification deliberately.',
  },
  {
    id: 'horror-descent',
    name: 'Horror Descent',
    description: 'Dread, isolation, sensory pressure.',
    temperature: 0.85,
    directive:
      'Build dread steadily. Use isolation, wrongness in small details, and sensory pressure. Withhold the full horror; imply more than you show.',
  },
  {
    id: 'mystery-logic',
    name: 'Mystery Clue Logic',
    description: 'Fair-play clues, precise continuity of facts.',
    temperature: 0.7,
    directive:
      'Honor fair-play mystery logic. Every clue must be consistent with established facts. Plant details precisely; never contradict the timeline.',
  },
  {
    id: 'comedy-timing',
    name: 'Comedy Timing',
    description: 'Wit, rhythm, and comic escalation.',
    temperature: 0.95,
    directive:
      'Write with comic timing: setup, escalation, release. Let humor arise from character logic taken seriously. Punchlines land at sentence ends.',
  },
  {
    id: 'epic-fantasy',
    name: 'Epic Fantasy Mode',
    description: 'Mythic scope, weighty diction, grand stakes.',
    temperature: 0.85,
    directive:
      'Write with mythic weight and epic scope. Ground grandeur in human detail. Names, oaths, and omens matter. Avoid modern idiom entirely.',
  },
  {
    id: 'text-adventure-gm',
    name: 'Text Adventure GM',
    description: 'Responsive game-master narration.',
    temperature: 0.9,
    directive:
      'Act as a responsive game master. React to player intent, keep the world alive and consequential, and end each beat with an implicit invitation to act.',
  },
]

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
