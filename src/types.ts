// ---------- Domain types for TomeForge Studio ----------
// This file is the single source of truth for the data model.
// All feature modules import from here. Do not fork these types.

export type ID = string

export type CanonMode = 'loose' | 'guided' | 'strict' | 'sandbox'

export const PACINGS = [
  'slow-burn', 'balanced', 'fast', 'cinematic', 'lyrical', 'sparse', 'high-intensity',
  'breakneck', 'meandering', 'staccato', 'dreamlike', 'pulse-pounding', 'contemplative',
  'creeping-dread', 'languid', 'whiplash', 'montage', 'simmering', 'clockwork',
  'elegiac', 'frenetic', 'hypnotic', 'jaunty', 'brooding', 'headlong',
] as const

export type Pacing = (typeof PACINGS)[number]

export const SCENE_STATUSES = ['draft', 'revising', 'final'] as const
export type SceneStatus = (typeof SCENE_STATUSES)[number]

export interface SceneSnapshot {
  id: ID
  label: string
  createdAt: number
  content: string
}

export interface Scene {
  id: ID
  title: string
  content: string
  summary?: string
  /** Version history — capped, newest first */
  snapshots?: SceneSnapshot[]
  /** Revision workflow state; undefined = draft */
  status?: SceneStatus
}

export interface Chapter {
  id: ID
  title: string
  scenes: Scene[]
}

export type CodexType =
  | 'character'
  | 'location'
  | 'faction'
  | 'species'
  | 'magic'
  | 'technology'
  | 'religion'
  | 'artifact'
  | 'language'
  | 'event'
  | 'prophecy'
  | 'law'
  | 'secret'
  | 'relationship'
  | 'rule'
  | 'other'

export const CODEX_TYPES: CodexType[] = [
  'character', 'location', 'faction', 'species', 'magic', 'technology',
  'religion', 'artifact', 'language', 'event', 'prophecy', 'law',
  'secret', 'relationship', 'rule', 'other',
]

export interface CodexEntry {
  id: ID
  name: string
  type: CodexType
  aliases: string[]
  content: string
  /** Always inject into AI context regardless of keyword match */
  alwaysInclude: boolean
  updatedAt: number
  /** ST-style AND matching: when set, a primary (name/alias) match also
   *  requires one of these to appear in the recent text */
  secondaryKeys?: string[]
}

export interface CharacterCard {
  id: ID
  name: string
  location: string
  goal: string
  secrets: string
  injuries: string
  relationships: string
  emotionalState: string
  arcStage: string
  lastAppearance: string
  voiceNotes: string
  forbidden: string
}

export type ThreadKind =
  | 'clue' | 'question' | 'prophecy' | 'weapon' | 'secret' | 'promise' | 'conflict'

export interface PlotThread {
  id: ID
  title: string
  kind: ThreadKind
  setup: string
  chapterIntroduced: string
  status: 'open' | 'paidoff' | 'abandoned'
  payoffNotes: string
}

export interface TimelineEvent {
  id: ID
  title: string
  when: string
  location: string
  characters: string
  chapterRef: string
  notes: string
  order: number
}

export interface StyleControls {
  proseDensity: number       // 0-10
  vocabulary: number         // 0-10
  dialogueFrequency: number  // 0-10
  interiorMonologue: number  // 0-10
  humor: number              // 0-10
  darkness: number           // 0-10
  romance: number            // 0-10
  violence: number           // 0-10
  surrealism: number         // 0-10
  pacing: Pacing
}

export interface StyleProfile {
  id: ID
  name: string
  description: string
  controls: StyleControls
  povLock: string   // e.g. "third person limited (Mara)" or "" for none
  tenseLock: string // e.g. "past tense" or "" for none
  voiceNotes: string
}

export type QuestMode = 'novel' | 'rpg' | 'mystery' | 'horror' | 'romance' | 'sandbox'

export type QuestCommand =
  | 'do' | 'say' | 'think' | 'inspect' | 'use' | 'travel' | 'wait' | 'remember'

export interface QuestTurn {
  id: ID
  role: 'player' | 'gm'
  command?: QuestCommand
  text: string
}

export interface QuestWorldState {
  location: string
  timeOfDay: string
  weather: string
  inventory: string[]
  injuries: string[]
  relationships: Record<string, string>
  quests: string[]
  secretsDiscovered: string[]
  npcs: Record<string, string>
}

export interface QuestState {
  mode: QuestMode
  playerName: string
  premise: string
  log: QuestTurn[]
  state: QuestWorldState
}

export interface CastWebNode {
  id: string
  name: string
  /** Loose grouping for color, e.g. "protagonists", "court", "the drowned" */
  group?: string
}

export type CastWebTone = 'ally' | 'enemy' | 'family' | 'romance' | 'tension' | 'other'

export interface CastWebEdge {
  from: string
  to: string
  label: string
  tone?: CastWebTone
}

/** AI-woven relationship graph, cached on the project */
export interface CastWeb {
  nodes: CastWebNode[]
  edges: CastWebEdge[]
  generatedAt: number
}

// ---------- SillyTavern library (imported cards & lorebooks, cross-project) ----------

export interface STEntry {
  name: string
  keys: string[]
  content: string
  constant: boolean
  /** ST "keysecondary": entry triggers only when a primary AND a secondary key match */
  secondaryKeys?: string[]
}

export interface STCardStored {
  id: ID
  kind: 'card'
  name: string
  description: string
  personality: string
  scenario: string
  mesExample: string
  tags: string[]
  book: STEntry[]
  importedAt: number
  /** Round-trip fidelity: fields ST cards carry that TomeForge doesn't display */
  firstMes?: string
  systemPrompt?: string
  postHistory?: string
  alternateGreetings?: string[]
  creatorNotes?: string
  creator?: string
}

export interface STBookStored {
  id: ID
  kind: 'lorebook'
  name: string
  entries: STEntry[]
  importedAt: number
}

/** A saved StoryQuest timeline branch — full quest state frozen at a moment */
export interface QuestSave {
  id: ID
  name: string
  note: string
  createdAt: number
  quest: QuestState
}

export interface Branch {
  id: ID
  name: string
  createdAt: number
  /** Where the branch was forked from */
  sourceSceneId: ID | null
  content: string
  note: string
}

/** A scene rescued from deletion — restorable from the manuscript's trash */
export interface TrashedScene {
  scene: Scene
  chapterTitle: string
  deletedAt: number
}

export interface Project {
  id: ID
  name: string
  genre: string
  logline: string
  createdAt: number
  updatedAt: number
  chapters: Chapter[]
  /** Continuity Core: high-priority current story direction */
  memory: string
  /** Director's Note: immediate style/mood steering, inserted late in context */
  authorNote: string
  canonMode: CanonMode
  codex: CodexEntry[]
  characters: CharacterCard[]
  threads: PlotThread[]
  timeline: TimelineEvent[]
  notes: string
  styleProfileId: ID | null
  presetId: string
  quest: QuestState | null
  /** Saved StoryQuest branches ("what if…" timelines) */
  questSaves?: QuestSave[]
  /** Recently deleted scenes, restorable (capped) */
  trashedScenes?: TrashedScene[]
  branches: Branch[]
  /** Relationship graph woven by AI, cached until regenerated */
  castWeb?: CastWeb | null
  /**
   * Writing log: date (YYYY-MM-DD) → highest total manuscript word count
   * observed that day. Words written on day D = wordLog[D] - max(earlier days).
   */
  wordLog?: Record<string, number>
  /**
   * Baseline word total captured when tracking began, so a pre-existing
   * manuscript's back-catalog isn't counted as "written" on the first logged
   * day. 0 for projects created after tracking existed.
   */
  wordLogStart?: number
}

export interface Preset {
  id: string
  name: string
  description: string
  temperature: number
  directive: string
}

export interface Settings {
  apiKey: string
  model: string
  maxTokens: number
}

export const DEFAULT_STYLE_CONTROLS: StyleControls = {
  proseDensity: 5,
  vocabulary: 5,
  dialogueFrequency: 5,
  interiorMonologue: 5,
  humor: 3,
  darkness: 5,
  romance: 2,
  violence: 3,
  surrealism: 2,
  pacing: 'balanced',
}

export const EMPTY_QUEST_WORLD: QuestWorldState = {
  location: '',
  timeOfDay: '',
  weather: '',
  inventory: [],
  injuries: [],
  relationships: {},
  quests: [],
  secretsDiscovered: [],
  npcs: {},
}
