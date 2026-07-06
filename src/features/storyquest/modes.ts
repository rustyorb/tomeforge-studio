import type { QuestMode } from '../../types'

export interface QuestModeInfo {
  id: QuestMode
  title: string
  glyph: string
  tagline: string
  gmInstructions: string
}

export const QUEST_MODES: QuestModeInfo[] = [
  {
    id: 'novel',
    title: 'Novel',
    glyph: '✒',
    tagline: 'Prose quality & interiority',
    gmInstructions:
      'GM STYLE — NOVEL: This is literary interactive fiction. Prioritize prose quality, sensory ' +
      'specificity, and the player character\'s interiority — thought, memory, and emotion woven ' +
      'through every beat. Let scenes breathe; quiet moments matter as much as action.',
  },
  {
    id: 'rpg',
    title: 'RPG',
    glyph: '⚔',
    tagline: 'Stats, inventory, consequences',
    gmInstructions:
      'GM STYLE — RPG: Run this like a rigorous tabletop campaign. Track inventory, injuries, and ' +
      'resources faithfully in the world state. Every action has costs and consequences; risky ' +
      'actions can fail. Reward clever use of items and knowledge, and keep continuity of gear ' +
      'and wounds airtight.',
  },
  {
    id: 'mystery',
    title: 'Mystery',
    glyph: '⌕',
    tagline: 'Clues, suspects, contradictions',
    gmInstructions:
      'GM STYLE — MYSTERY: Seed concrete clues, maintain a cast of suspects with motives and ' +
      'alibis, and let contradictions surface for an observant player. Never reveal the solution ' +
      'outright; reward inspection and deduction. Record discovered clues under secretsDiscovered ' +
      'in the world state.',
  },
  {
    id: 'horror',
    title: 'Horror',
    glyph: '†',
    tagline: 'Dread, isolation, sensory pressure',
    gmInstructions:
      'GM STYLE — HORROR: Build dread through isolation, silence, and sensory pressure — sound, ' +
      'smell, cold, the wrongness of small details. Keep threats half-seen for as long as ' +
      'possible. Escalate slowly and let the player\'s imagination do the worst work.',
  },
  {
    id: 'romance',
    title: 'Romance',
    glyph: '❦',
    tagline: 'Chemistry, tension, thresholds',
    gmInstructions:
      'GM STYLE — ROMANCE: Center chemistry and tension between characters. Charge small gestures ' +
      '— a look held too long, a hand not taken. Move relationships across thresholds only when ' +
      'earned, and track their state faithfully under relationships in the world state.',
  },
  {
    id: 'sandbox',
    title: 'Sandbox',
    glyph: '✦',
    tagline: 'Free wandering',
    gmInstructions:
      'GM STYLE — SANDBOX: Free wandering. Follow the player\'s curiosity wherever it goes, ' +
      'inventing places, people, and diversions generously. No fixed plot — the world simply ' +
      'keeps being interesting in every direction.',
  },
]

export function gmInstructionsFor(mode: QuestMode): string {
  return QUEST_MODES.find((m) => m.id === mode)?.gmInstructions ?? ''
}
