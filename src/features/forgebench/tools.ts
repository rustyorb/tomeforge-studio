// ---------- Forgebench tool registry ----------
// Pure data: every creative tool is described here and rendered by the
// generic runner in index.tsx. No per-tool components.

import type { CodexType, Project } from '../../types'
import { tailOfManuscript } from '../../lib/context'

export type ToolCategory =
  | 'idea' | 'plot' | 'character' | 'dialogue' | 'world' | 'revision' | 'publishing'

export interface ToolField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  options?: string[]        // for select
  placeholder?: string
  useCurrentScene?: boolean // textarea gets a "Use manuscript tail" fill button
}

export interface ForgeTool {
  id: string
  name: string
  category: ToolCategory
  glyph: string             // single decorative unicode char
  description: string       // one line
  temperature?: number
  fields: ToolField[]
  buildDirective: (values: Record<string, string>) => string
  /** Extra project data appended to the user message (manuscript, cast, codex…) */
  projectPayload?: (project: Project) => string
  /** Default codex type offered by the "Save to Codex" action (world tools) */
  codexType?: CodexType
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'plot', label: 'Plot' },
  { id: 'character', label: 'Character' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'world', label: 'World' },
  { id: 'revision', label: 'Revision' },
  { id: 'publishing', label: 'Publishing' },
]

const NO_PREAMBLE =
  'Output only the deliverable itself — no preamble, no closing remarks, no meta-commentary.'

// ---------- shared field factories ----------

const pasteField = (label: string, placeholder = 'Paste the passage here, or pull in the manuscript tail…'): ToolField => ({
  id: 'text',
  label,
  type: 'textarea',
  placeholder,
  useCurrentScene: true,
})

const genreField: ToolField = {
  id: 'genre', label: 'Genre / flavor', type: 'text',
  placeholder: 'Leave blank to use the project genre',
}

const seedField = (placeholder: string): ToolField => ({
  id: 'seed', label: 'Seed / notes (optional)', type: 'textarea', placeholder,
})

// ---------- project payload helpers ----------

function manuscriptBlock(p: Project, chars = 9000): string {
  const tail = tailOfManuscript(p, chars)
  return tail.trim()
    ? `MANUSCRIPT (most recent ${chars} characters):\n${tail}`
    : 'MANUSCRIPT: (empty so far)'
}

function castBlock(p: Project): string {
  if (!p.characters.length) return 'CAST LEDGER: (no character cards yet)'
  const rows = p.characters.map((c) => {
    const bits = [
      c.location && `location: ${c.location}`,
      c.goal && `goal: ${c.goal}`,
      c.emotionalState && `feeling: ${c.emotionalState}`,
      c.arcStage && `arc stage: ${c.arcStage}`,
      c.relationships && `relationships: ${c.relationships}`,
      c.secrets && `secrets: ${c.secrets}`,
      c.voiceNotes && `voice: ${c.voiceNotes}`,
    ].filter(Boolean)
    return `• ${c.name} — ${bits.join('; ') || 'no details yet'}`
  })
  return `CAST LEDGER:\n${rows.join('\n')}`
}

function codexBlock(p: Project): string {
  if (!p.codex.length) return 'CODEX: (empty)'
  const rows = p.codex.map(
    (e) => `• ${e.name} [${e.type}]: ${e.content.trim().slice(0, 400)}`,
  )
  return `CODEX ENTRIES:\n${rows.join('\n')}`
}

function threadsBlock(p: Project): string {
  if (!p.threads.length) return 'PLOT THREADS: (none tracked)'
  const rows = p.threads.map(
    (t) => `• "${t.title}" [${t.kind}, ${t.status}] — setup: ${t.setup}${t.payoffNotes ? `; payoff notes: ${t.payoffNotes}` : ''}`,
  )
  return `PLOT THREADS:\n${rows.join('\n')}`
}

function timelineBlock(p: Project): string {
  if (!p.timeline.length) return 'TIMELINE: (empty)'
  const rows = [...p.timeline]
    .sort((a, b) => a.order - b.order)
    .map((e) => `• ${e.when || '?'} — ${e.title} @ ${e.location || '?'} (${e.characters || 'unknown cast'})`)
  return `TIMELINE:\n${rows.join('\n')}`
}

function storyBrainBlock(p: Project): string {
  return [
    `PROJECT: "${p.name}" — ${p.genre || 'fiction'}. ${p.logline}`,
    p.memory.trim() ? `CONTINUITY CORE:\n${p.memory.trim()}` : '',
    codexBlock(p),
    castBlock(p),
    threadsBlock(p),
    timelineBlock(p),
    p.notes.trim() ? `PROJECT NOTES:\n${p.notes.trim().slice(0, 3000)}` : '',
    manuscriptBlock(p, 6000),
  ].filter(Boolean).join('\n\n')
}

// ============================================================
// IDEA
// ============================================================

const ideaTools: ForgeTool[] = [
  {
    id: 'premise-generator',
    name: 'Premise Generator',
    category: 'idea',
    glyph: '✶',
    description: 'Fresh story premises with built-in conflict and a hook.',
    temperature: 1.0,
    fields: [genreField, seedField('An image, a feeling, half an idea — anything to spark from')],
    buildDirective: (v) =>
      `Generate 5 original story premises${v.genre ? ` in the genre "${v.genre}"` : ' fitting this project'}. ` +
      'Each premise: a bold title line, then 2-3 sentences naming the protagonist, the central conflict, the stakes, and one striking hook that makes it feel unlike anything shelved beside it. ' +
      'Number them 1-5. Keep the whole output under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'what-if-engine',
    name: 'What-If Engine',
    category: 'idea',
    glyph: '⁇',
    description: 'Provocative what-if questions that crack a story open.',
    temperature: 1.0,
    fields: [seedField('A topic, setting, character, or situation to interrogate')],
    buildDirective: () =>
      'Produce 10 provocative "What if…?" questions that could each anchor a novel. ' +
      'Mix scales: personal, societal, cosmic. Each question is one sentence followed by a single em-dash clause hinting at the darkest or strangest consequence. ' +
      'Number them 1-10, one per line. ' + NO_PREAMBLE,
  },
  {
    id: 'story-seed-generator',
    name: 'Story Seed Generator',
    category: 'idea',
    glyph: '❋',
    description: 'Compact seeds: character + want + obstacle + twist.',
    temperature: 1.0,
    fields: [genreField],
    buildDirective: (v) =>
      `Generate 6 story seeds${v.genre ? ` for the genre "${v.genre}"` : ''}. ` +
      'Format each as four labeled lines: CHARACTER (one vivid person), WANT (a concrete desire), OBSTACLE (what stands in the way), TWIST (the complication nobody sees coming). ' +
      'Separate seeds with a blank line. Under 300 words total. ' + NO_PREAMBLE,
  },
  {
    id: 'title-generator',
    name: 'Title Generator',
    category: 'idea',
    glyph: '⌖',
    description: 'Ten title options across different registers.',
    temperature: 1.0,
    fields: [
      seedField('What the story is about — or leave blank to use the project logline'),
      { id: 'mood', label: 'Mood', type: 'select', options: ['evocative', 'stark', 'literary', 'commercial', 'mixed'] },
    ],
    buildDirective: (v) =>
      `Generate exactly 10 title options for this story, leaning ${v.mood ?? 'mixed'} in register. ` +
      'Vary the shapes: one-word, noun phrase, "The X of Y", a stolen line of imagery, a character name construction. ' +
      'Numbered list 1-10, each title followed by an em-dash and a five-word-max note on its angle. ' + NO_PREAMBLE,
  },
  {
    id: 'logline-generator',
    name: 'Logline Generator',
    category: 'idea',
    glyph: '➳',
    description: 'Five loglines that sell the story in one breath.',
    temperature: 0.9,
    fields: [seedField('Premise or synopsis to distill — or leave blank to use the project')],
    buildDirective: () =>
      'Write exactly 5 loglines for this story. Each is one sentence, 25-40 words, naming the protagonist (by role, not name), the inciting event, the goal, and the stakes if they fail. ' +
      'Vary emphasis across the five: character-first, threat-first, irony-first, world-first, stakes-first. Numbered 1-5. ' + NO_PREAMBLE,
  },
  {
    id: 'genre-mashup',
    name: 'Genre Mashup',
    category: 'idea',
    glyph: '⧉',
    description: 'Collide two genres and mine the wreckage.',
    temperature: 1.0,
    fields: [
      { id: 'genreA', label: 'Genre A', type: 'text', placeholder: 'e.g. cozy mystery' },
      { id: 'genreB', label: 'Genre B', type: 'text', placeholder: 'e.g. space opera' },
    ],
    buildDirective: (v) =>
      `Fuse the genres "${v.genreA || 'pick one'}" and "${v.genreB || 'pick a clashing one'}" into 3 distinct story concepts. ` +
      'For each: a title, a 2-sentence premise, which conventions of each genre survive the collision, and the one convention that gets gloriously broken. ' +
      'Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'trope-inverter',
    name: 'Trope Inverter',
    category: 'idea',
    glyph: '⇅',
    description: 'Turn a tired trope inside out.',
    temperature: 1.0,
    fields: [{ id: 'trope', label: 'Trope to invert', type: 'text', placeholder: 'e.g. the chosen one, the mentor dies' }],
    buildDirective: (v) =>
      `Take the trope "${v.trope || 'a trope common to this genre'}" and produce 5 inversions. ` +
      'For each: name the inversion in a short bold phrase, explain the reversal in one sentence, and give one sentence on the story it unlocks. ' +
      'Numbered 1-5, under 300 words. ' + NO_PREAMBLE,
  },
  {
    id: 'plot-twist-generator',
    name: 'Plot Twist Generator',
    category: 'idea',
    glyph: '☈',
    description: 'Twists earned by what the story has already promised.',
    temperature: 0.95,
    fields: [seedField('Current situation, suspects, secrets — the more the better')],
    buildDirective: () =>
      'Generate 5 plot twists that could strike this story. For each: a one-line name, the reveal itself in 1-2 sentences, what earlier detail would need to be seeded so it lands as inevitable rather than cheap, and the immediate fallout. ' +
      'Rank from safest to most audacious. Numbered 1-5, under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'ending-generator',
    name: 'Ending Generator',
    category: 'idea',
    glyph: '⌛',
    description: 'Candidate endings, from triumphant to devastating.',
    temperature: 0.95,
    fields: [seedField('Where the story stands and what remains unresolved')],
    buildDirective: () =>
      'Propose 5 possible endings for this story: one triumphant, one bittersweet, one tragic, one ambiguous, one subversive. ' +
      'For each: a title line, a 3-sentence sketch of the final movement, and the closing image the reader is left with. ' +
      'Under 450 words. ' + NO_PREAMBLE,
  },
  {
    id: 'theme-finder',
    name: 'Theme Finder',
    category: 'idea',
    glyph: '☉',
    description: 'Reads the manuscript and names what it is really about.',
    temperature: 0.7,
    fields: [],
    projectPayload: (p) => manuscriptBlock(p, 12000),
    buildDirective: () =>
      'Analyze the manuscript excerpt provided and identify its themes. Deliver: (1) the dominant theme in one sentence; (2) 3-4 secondary themes, each with one quoted or paraphrased moment from the text as evidence; (3) two suggestions for imagery or scene choices that would sharpen the dominant theme going forward. ' +
      'Use short labeled sections. Under 350 words. ' + NO_PREAMBLE,
  },
]

// ============================================================
// PLOT
// ============================================================

const plotTools: ForgeTool[] = [
  {
    id: 'three-act-structure',
    name: 'Three-Act Structure Builder',
    category: 'plot',
    glyph: '𝍢',
    description: 'Classic three-act skeleton for your premise.',
    temperature: 0.8,
    fields: [seedField('Premise and any fixed plot points — or leave blank to use the project')],
    buildDirective: () =>
      'Build a three-act structure for this story. Format: ACT I (setup — ordinary world, inciting incident, first threshold), ACT II (confrontation — rising complications, midpoint reversal, low point), ACT III (resolution — climax, denouement). ' +
      'Each act gets 4-6 bullet beats, one sentence each, concrete and causal ("because of X, Y"). End with the story\'s dramatic question in one line. Under 500 words. ' + NO_PREAMBLE,
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat Beat Sheet',
    category: 'plot',
    glyph: '⌁',
    description: 'All 15 Blake Snyder beats, mapped to your story.',
    temperature: 0.8,
    fields: [seedField('Premise, protagonist, ending if known')],
    buildDirective: () =>
      'Produce a full Save the Cat beat sheet for this story: Opening Image, Theme Stated, Set-Up, Catalyst, Debate, Break into Two, B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost, Dark Night of the Soul, Break into Three, Finale, Final Image. ' +
      'Each beat: the beat name in caps, then 1-2 concrete sentences of what happens in THIS story. Under 600 words. ' + NO_PREAMBLE,
  },
  {
    id: 'heros-journey',
    name: "Hero's Journey Builder",
    category: 'plot',
    glyph: '☍',
    description: 'The monomyth stages, tailored to your hero.',
    temperature: 0.8,
    fields: [
      { id: 'hero', label: 'Hero', type: 'text', placeholder: 'Name or role of the protagonist' },
      seedField('Premise and world details'),
    ],
    buildDirective: (v) =>
      `Map ${v.hero ? `"${v.hero}"` : 'the protagonist'} onto the 12-stage Hero's Journey: Ordinary World, Call to Adventure, Refusal, Mentor, Crossing the Threshold, Tests/Allies/Enemies, Approach, Ordeal, Reward, Road Back, Resurrection, Return with Elixir. ` +
      'Each stage: stage name, then 1-2 sentences of the concrete event in this story. Flag any stage worth subverting with "(SUBVERT: …)". Under 550 words. ' + NO_PREAMBLE,
  },
  {
    id: 'mystery-clue-map',
    name: 'Mystery Clue Map',
    category: 'plot',
    glyph: '⌕',
    description: 'Clues, red herrings, and the reveal schedule.',
    temperature: 0.85,
    fields: [
      { id: 'crime', label: 'The crime / central mystery', type: 'textarea', placeholder: 'What happened, who did it (if decided), what the detective knows' },
    ],
    buildDirective: () =>
      'Design a clue map for this mystery. Deliver four sections: TRUE CLUES (6-8 clues pointing at the real solution, each with where/when it surfaces and what it seems to mean vs. what it actually means), RED HERRINGS (3-4, each with the false trail it opens and how it is eventually neutralized), REVEAL SCHEDULE (ordered list of when the reader learns what), FAIR-PLAY CHECK (one sentence confirming the reader could solve it). Under 550 words. ' + NO_PREAMBLE,
  },
  {
    id: 'romance-arc',
    name: 'Romance Arc Builder',
    category: 'plot',
    glyph: '❦',
    description: 'The full relationship arc, meet-cute to resolution.',
    temperature: 0.85,
    fields: [
      { id: 'pair', label: 'The pairing', type: 'text', placeholder: 'Who falls for whom' },
      { id: 'heat', label: 'Ending', type: 'select', options: ['happily ever after', 'happy for now', 'bittersweet', 'tragic'] },
    ],
    buildDirective: (v) =>
      `Build a romance arc${v.pair ? ` for ${v.pair}` : ''} ending ${v.heat ?? 'happily ever after'}. ` +
      'Beats: First Collision, Spark & Friction, Growing Intimacy, the Lie They Each Believe, First Kiss / Point of No Return, the Breakup Wound, Grand Gesture or Quiet Truth, Resolution. ' +
      'Each beat: 1-2 sentences, naming the internal obstacle at play, not just the event. Under 450 words. ' + NO_PREAMBLE,
  },
  {
    id: 'villain-plan',
    name: 'Villain Plan Generator',
    category: 'plot',
    glyph: '♆',
    description: 'What the antagonist is doing while the hero sleeps.',
    temperature: 0.9,
    fields: [
      { id: 'villain', label: 'Villain', type: 'text', placeholder: 'Name or archetype' },
      seedField('Their resources, their grudge, what they want'),
    ],
    buildDirective: (v) =>
      `Construct ${v.villain ? `"${v.villain}"` : "the antagonist"}'s master plan as they would write it. Sections: OBJECTIVE (one sentence), WHY IT'S JUSTIFIED (their internal logic, 2 sentences), THE PLAN (5-7 phased steps with contingencies), WHAT THEY UNDERESTIMATE (the flaw that will undo them), TIMELINE PRESSURE (why now). ` +
      'Write it cold and competent — a plan that would work if no one stopped it. Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'chapter-outline',
    name: 'Chapter Outline Generator',
    category: 'plot',
    glyph: '☰',
    description: 'A chapter-by-chapter outline from your premise.',
    temperature: 0.8,
    fields: [
      seedField('Premise, structure notes, target length'),
      { id: 'count', label: 'Chapter count', type: 'select', options: ['12', '20', '30', '40'] },
    ],
    buildDirective: (v) =>
      `Write a ${v.count ?? '20'}-chapter outline for this story. Each chapter: "Ch N — Title" then one sentence of what happens and one clause of what changes (new information, new wound, new decision). ` +
      'Ensure escalation: every 5 chapters something irreversible occurs. One chapter per line-pair. ' + NO_PREAMBLE,
  },
  {
    id: 'scene-card-generator',
    name: 'Scene Card Generator',
    category: 'plot',
    glyph: '▤',
    description: 'Beat cards for the next scenes to write.',
    temperature: 0.85,
    fields: [seedField('Where the story stands and what must happen soon')],
    projectPayload: (p) => manuscriptBlock(p, 5000),
    buildDirective: () =>
      'Generate 5 scene cards for upcoming scenes. Each card: SCENE (title), POV, GOAL (what the POV character wants entering), CONFLICT (what resists), TURN (how the scene ends differently than it began), EXIT HOOK (the line of tension pulling to the next scene). ' +
      'Separate cards with a blank line. Under 450 words. ' + NO_PREAMBLE,
  },
  {
    id: 'reverse-outline',
    name: 'Reverse Outline',
    category: 'plot',
    glyph: '⮌',
    description: 'Extracts the outline hiding inside your manuscript.',
    temperature: 0.5,
    fields: [],
    projectPayload: (p) => manuscriptBlock(p, 14000),
    buildDirective: () =>
      'Reverse-outline the manuscript excerpt provided. For each scene or major movement detected: a numbered entry with a 6-10 word title, one sentence of what happens, and one clause naming its structural function (setup, escalation, reversal, breather, payoff). ' +
      'After the list, add STRUCTURAL NOTES: 2-3 sentences on pacing shape and any function that appears missing. ' + NO_PREAMBLE,
  },
  {
    id: 'plot-hole-detector',
    name: 'Plot Hole Detector',
    category: 'plot',
    glyph: '◍',
    description: 'Hunts contradictions, dropped threads, and logic gaps.',
    temperature: 0.4,
    fields: [],
    projectPayload: (p) => [manuscriptBlock(p, 12000), threadsBlock(p), castBlock(p)].join('\n\n'),
    buildDirective: () =>
      'Audit the manuscript excerpt and tracked plot threads for problems. Report in three sections: CONTRADICTIONS (facts, timeline, or character knowledge that conflict — quote or cite the moments), DROPPED THREADS (setups with no visible payoff, including any tracked threads marked open that the recent text ignores), LOGIC GAPS (actions or events lacking motivation or causality). ' +
      'For each item: one sentence describing it, one sentence proposing the cheapest fix. If a section is clean, say "None detected." Under 450 words. ' + NO_PREAMBLE,
  },
]

// ============================================================
// CHARACTER
// ============================================================

const characterTools: ForgeTool[] = [
  {
    id: 'character-generator',
    name: 'Character Generator',
    category: 'character',
    glyph: '☺',
    description: 'A full character with contradictions built in.',
    temperature: 0.95,
    fields: [
      { id: 'role', label: 'Role in story', type: 'text', placeholder: 'e.g. rival, mentor, love interest, wildcard' },
      seedField('Constraints: age, world, vibe, anything fixed'),
    ],
    buildDirective: (v) =>
      `Create one fully-realized character${v.role ? ` to serve as: ${v.role}` : ''}. Sections: NAME & SNAPSHOT (2 sentences), WANT vs NEED (surface desire vs. buried one), WOUND (the past event that shaped them), CONTRADICTION (two true things about them that don't fit), VOICE (how they talk, with one sample line of dialogue), SECRET, HOW THEY COMPLICATE THIS STORY (2 sentences). ` +
      'Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'character-arc-builder',
    name: 'Character Arc Builder',
    category: 'character',
    glyph: '↝',
    description: 'A transformation arc from lie to truth.',
    temperature: 0.85,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Who is transforming' },
      seedField('Who they are now and roughly where they should end up'),
    ],
    buildDirective: (v) =>
      `Build a character arc for ${v.name ? `"${v.name}"` : 'this character'}. Stages: THE LIE THEY BELIEVE, HOW THE LIE PROTECTS THEM, FIRST CRACK (the event that stresses the lie), DOUBLING DOWN (how they defend it harder), THE COST (what the lie finally takes from them), THE TRUTH (what replaces it), PROOF ON THE PAGE (the concrete action in the climax that shows the change). ` +
      'Each stage 1-2 sentences. Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'backstory-generator',
    name: 'Backstory Generator',
    category: 'character',
    glyph: '⌂',
    description: 'A past that explains the present without excusing it.',
    temperature: 0.9,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Name or role' },
      seedField('Everything already known about them'),
    ],
    buildDirective: (v) =>
      `Write a backstory for ${v.name ? `"${v.name}"` : 'this character'} in three movements: ORIGIN (family, place, early shaping — 3-4 sentences), THE FORGE (the one formative event told as a short vivid scene, 5-6 sentences), RESIDUE (4 bullet points: a habit, a fear, a belief, and a relationship pattern that survive into the present story). ` +
      'Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'motivation-mapper',
    name: 'Motivation Mapper',
    category: 'character',
    glyph: '➢',
    description: 'Layers of want, from stated goal to buried hunger.',
    temperature: 0.75,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Whose motivations to map' },
      seedField('Their situation and behavior so far'),
    ],
    buildDirective: (v) =>
      `Map the motivations of ${v.name ? `"${v.name}"` : 'this character'} in five layers: STATED GOAL (what they tell others), ACTUAL GOAL (what they tell themselves), EMOTIONAL DRIVE (the feeling they are chasing or fleeing), CORE FEAR (what they will do anything to avoid), BURIED HUNGER (the need they cannot admit). ` +
      'Then add LEVERAGE: 2 sentences on how another character could exploit these layers. Under 300 words. ' + NO_PREAMBLE,
  },
  {
    id: 'relationship-web',
    name: 'Relationship Web',
    category: 'character',
    glyph: '❖',
    description: 'Maps tensions and bonds across the cast.',
    temperature: 0.8,
    fields: [seedField('Extra characters or relationship facts not in the cast ledger')],
    projectPayload: (p) => [castBlock(p), codexBlock(p)].join('\n\n'),
    buildDirective: () =>
      'Map the relationship web of this cast. For every significant pairing: "A ↔ B — bond: (one clause); tension: (one clause); unspoken: (one clause)". ' +
      'Then TRIANGLES: identify 2-3 three-way dynamics with dramatic potential, one sentence each. Then UNDERUSED: name the one relationship the story should develop next and why. Under 450 words. ' + NO_PREAMBLE,
  },
  {
    id: 'voice-profile',
    name: 'Voice Profile Generator',
    category: 'character',
    glyph: '♪',
    description: 'A speech fingerprint: rhythm, vocabulary, tells.',
    temperature: 0.85,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Whose voice' },
      seedField('Personality, background, education, region'),
    ],
    buildDirective: (v) =>
      `Create a voice profile for ${v.name ? `"${v.name}"` : 'this character'}. Sections: RHYTHM (sentence length, pace, interruptions), VOCABULARY (register, favorite domains, words they'd never use), TELLS (3 verbal habits or crutch phrases), UNDER PRESSURE (how the voice changes when stressed or lying), SAMPLE (4 lines of dialogue in the voice: one casual, one angry, one vulnerable, one deflecting). ` +
      'Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'character-conflict',
    name: 'Character Conflict Generator',
    category: 'character',
    glyph: '⚔',
    description: 'Collisions between two characters, values-first.',
    temperature: 0.9,
    fields: [
      { id: 'a', label: 'Character A', type: 'text', placeholder: 'First character' },
      { id: 'b', label: 'Character B', type: 'text', placeholder: 'Second character' },
    ],
    buildDirective: (v) =>
      `Generate 4 conflicts between ${v.a ? `"${v.a}"` : 'character A'} and ${v.b ? `"${v.b}"` : 'character B'}, escalating in severity. ` +
      'For each: THE CLASH (one sentence — root it in colliding values or needs, not misunderstanding), THE FLASHPOINT (the concrete scene where it ignites), COLLATERAL (who or what gets damaged), WHY IT CAN\'T BE TALKED OUT (one clause). ' +
      'Numbered 1-4, under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'character-interview',
    name: 'Character Interview',
    category: 'character',
    glyph: '☙',
    description: 'An interviewer presses; the character answers in voice.',
    temperature: 0.95,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Who sits for the interview' },
      { id: 'topic', label: 'Interview focus', type: 'text', placeholder: 'e.g. the night of the fire, their rival, their regrets' },
    ],
    buildDirective: (v) =>
      `Write an interview with ${v.name ? `"${v.name}"` : 'this character'}${v.topic ? ` focused on: ${v.topic}` : ''}. ` +
      'Format: "Q:" lines from a perceptive interviewer who notices evasions and presses harder, "A:" answers fully in the character\'s voice — including deflections, half-truths, and one moment where the mask slips. 8-10 exchanges. The last answer should reveal something the character didn\'t mean to. ' + NO_PREAMBLE,
  },
  {
    id: 'cast-balance',
    name: 'Cast Balance Report',
    category: 'character',
    glyph: '⚖',
    description: 'Audits the cast for redundancy, gaps, and dead weight.',
    temperature: 0.5,
    fields: [],
    projectPayload: (p) => [castBlock(p), codexBlock(p), manuscriptBlock(p, 6000)].join('\n\n'),
    buildDirective: () =>
      'Audit this cast for balance. Sections: FUNCTION MAP (each character and the story function they serve, one line each), REDUNDANCIES (characters overlapping in function or personality — recommend merge or differentiate), GAPS (missing functions: no foil, no pressure source, no comic release, etc.), DEAD WEIGHT (anyone the story could lose, and what it would cost), ONE MOVE (the single cast change with the highest payoff). ' +
      'Be honest, not polite. Under 400 words. ' + NO_PREAMBLE,
  },
]

// ============================================================
// DIALOGUE
// ============================================================

const dialogueTools: ForgeTool[] = [
  {
    id: 'full-conversation',
    name: 'Full Conversation Generator',
    category: 'dialogue',
    glyph: '❝',
    description: 'A complete scene of dialogue with subtext and turns.',
    temperature: 0.9,
    fields: [
      { id: 'participants', label: 'Participants', type: 'text', placeholder: 'Who is talking' },
      { id: 'objective', label: 'Objective', type: 'textarea', placeholder: 'What each person wants from this conversation' },
      { id: 'tone', label: 'Type / tone', type: 'select', options: ['tense negotiation', 'quiet confession', 'argument', 'flirtation', 'interrogation', 'reunion', 'goodbye', 'casual with an undertow'] },
      { id: 'subtext', label: 'Subtext', type: 'textarea', placeholder: 'What is NOT being said out loud' },
      { id: 'length', label: 'Length', type: 'select', options: ['brief (6-10 exchanges)', 'medium (12-20 exchanges)', 'extended (25+ exchanges)'] },
    ],
    buildDirective: (v) =>
      `Write a complete dialogue scene — a ${v.tone ?? 'tense negotiation'}, ${v.length ?? 'medium (12-20 exchanges)'}. ` +
      'Written as manuscript prose: dialogue lines with minimal but pointed action beats, no headings. Every line must do work — advance the objective, dodge, or wound. The stated subtext must pressure the surface without ever being spoken. End on a line that shifts the power balance. ' + NO_PREAMBLE,
  },
  {
    id: 'one-liner',
    name: 'One-Liner Generator',
    category: 'dialogue',
    glyph: '⚡',
    description: 'Killer single lines: comebacks, threats, last words.',
    temperature: 1.0,
    fields: [
      { id: 'speaker', label: 'Speaker', type: 'text', placeholder: 'Who delivers it' },
      { id: 'kind', label: 'Kind', type: 'select', options: ['comeback', 'threat', 'declaration of love', 'last words', 'battle cry', 'devastating truth', 'deadpan aside'] },
      { id: 'situation', label: 'Situation', type: 'textarea', placeholder: 'The moment the line lands in' },
    ],
    buildDirective: (v) =>
      `Generate 10 ${v.kind ?? 'comeback'} one-liners${v.speaker ? ` for "${v.speaker}"` : ''}, in their voice. ` +
      'Each under 20 words. No two share a rhythm. At least three should work through understatement rather than force. Numbered 1-10, one per line. ' + NO_PREAMBLE,
  },
  {
    id: 'subtext-enhancer',
    name: 'Subtext Enhancer',
    category: 'dialogue',
    glyph: '≋',
    description: 'Rewrites on-the-nose dialogue to say less, mean more.',
    temperature: 0.8,
    fields: [
      pasteField('Dialogue to rework', 'Paste the on-the-nose dialogue…'),
      { id: 'hidden', label: 'What should stay unsaid', type: 'text', placeholder: 'The feeling or fact to bury under the surface' },
    ],
    buildDirective: (v) =>
      `Rewrite the provided dialogue so its emotional content goes underground${v.hidden ? ` — specifically, "${v.hidden}" must never be stated directly` : ''}. ` +
      'Characters talk about something adjacent or trivial while the real matter moves beneath: deflections, loaded object talk, answers to questions that weren\'t asked. Keep roughly the same length and the same speakers. Output only the rewritten passage. ' + NO_PREAMBLE,
  },
  {
    id: 'argument-builder',
    name: 'Argument Builder',
    category: 'dialogue',
    glyph: '⚑',
    description: 'A fight where both sides are right.',
    temperature: 0.9,
    fields: [
      { id: 'parties', label: 'Who is fighting', type: 'text', placeholder: 'The two (or more) combatants' },
      { id: 'about', label: 'Surface issue', type: 'text', placeholder: 'What the fight is nominally about' },
      { id: 'really', label: 'Real issue', type: 'text', placeholder: 'What it is actually about' },
    ],
    buildDirective: (v) =>
      `Write an argument scene${v.parties ? ` between ${v.parties}` : ''}${v.about ? ` ostensibly about ${v.about}` : ''}${v.really ? `, actually about ${v.really}` : ''}. ` +
      'Both sides must have a defensible position — no strawmen. Escalate in stages: needling, engagement, the low blow, the thing that can\'t be unsaid. 15-25 exchanges as manuscript prose with sparse beats. End before reconciliation. ' + NO_PREAMBLE,
  },
  {
    id: 'banter-generator',
    name: 'Banter Generator',
    category: 'dialogue',
    glyph: '⌣',
    description: 'Rapid back-and-forth with chemistry and rhythm.',
    temperature: 0.95,
    fields: [
      { id: 'pair', label: 'Who is bantering', type: 'text', placeholder: 'The duo' },
      { id: 'flavor', label: 'Flavor', type: 'select', options: ['flirty', 'competitive', 'old-friends', 'reluctant allies', 'sibling energy'] },
      { id: 'context', label: 'While doing what', type: 'text', placeholder: 'e.g. defusing a bomb, washing dishes, on stakeout' },
    ],
    buildDirective: (v) =>
      `Write a run of ${v.flavor ?? 'flirty'} banter${v.pair ? ` between ${v.pair}` : ''}${v.context ? ` while ${v.context}` : ''}. ` +
      '12-18 quick exchanges, mostly under 10 words per line. Rules: each speaker has a distinct comic angle, callbacks beat new jokes, and one exchange lands somewhere unexpectedly sincere before bouncing back. Manuscript prose, minimal beats. ' + NO_PREAMBLE,
  },
  {
    id: 'exposition-softener',
    name: 'Exposition Softener',
    category: 'dialogue',
    glyph: '☁',
    description: 'Melts info-dumps into scene and speech.',
    temperature: 0.8,
    fields: [pasteField('Exposition to soften', 'Paste the info-dump or as-you-know-Bob passage…')],
    buildDirective: () =>
      'Rework the provided exposition so the information arrives through friction instead of lecture: characters who disagree about the facts, information extracted reluctantly, details revealed through use rather than description. Cut any information the scene doesn\'t need right now — note cut items in a single bracketed line at the end like "[Deferred: …]". Keep the same POV and tense. Output the rewritten passage, then that one bracket line if needed. ' + NO_PREAMBLE,
  },
  {
    id: 'voice-consistency-checker',
    name: 'Voice Consistency Checker',
    category: 'dialogue',
    glyph: '✓',
    description: 'Checks pasted dialogue against a character\'s voice.',
    temperature: 0.4,
    fields: [
      { id: 'name', label: 'Character', type: 'text', placeholder: 'Whose voice to check against' },
      pasteField('Dialogue to check', 'Paste the dialogue passage…'),
    ],
    projectPayload: (p) => castBlock(p),
    buildDirective: (v) =>
      `Check the provided dialogue against the established voice of ${v.name ? `"${v.name}"` : 'the named character'} (use the cast ledger and any manuscript context). ` +
      'Report: VERDICT (consistent / drifting / off-voice, one sentence), OFF LINES (quote each suspect line, say why it breaks voice, offer a revised version in-voice), PATTERNS (any systematic drift — register, rhythm, vocabulary). If it all rings true, say so and name the two strongest lines. Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'screenplay-converter',
    name: 'Screenplay Format Converter',
    category: 'dialogue',
    glyph: '▭',
    description: 'Converts prose scenes into screenplay format.',
    temperature: 0.6,
    fields: [pasteField('Prose to convert', 'Paste the prose scene…')],
    buildDirective: () =>
      'Convert the provided prose into standard screenplay format: sluglines (INT./EXT. LOCATION — TIME), terse present-tense action lines, CHARACTER names centered-style in caps before dialogue, parentheticals only where essential. Interior monologue becomes visible action or is cut; keep V.O. only if the prose demands it. Preserve every plot beat and all dialogue content. Output only the screenplay. ' + NO_PREAMBLE,
  },
  {
    id: 'prose-dialogue-converter',
    name: 'Prose Dialogue Converter',
    category: 'dialogue',
    glyph: '¶',
    description: 'Turns scripts or summaries into flowing prose scenes.',
    temperature: 0.85,
    fields: [pasteField('Script or summary to convert', 'Paste screenplay, chat log, or scene summary…')],
    buildDirective: () =>
      'Convert the provided material into a polished prose scene matching the manuscript\'s voice, POV, and tense. Dialogue gets tags and beats that carry emotion; action lines become embodied narration; add interiority where the POV character would naturally think or feel. Do not add new plot events. Output only the prose scene. ' + NO_PREAMBLE,
  },
]

// ============================================================
// WORLD
// ============================================================

const worldTools: ForgeTool[] = [
  {
    id: 'nation-generator',
    name: 'Nation Generator',
    category: 'world',
    glyph: '♜',
    description: 'A nation with history, power, and fault lines.',
    temperature: 0.95,
    codexType: 'location',
    fields: [seedField('Climate, neighbors, vibe — any constraints')],
    buildDirective: () =>
      'Create a nation for this world. Sections: NAME & EPITHET, GEOGRAPHY & CLIMATE (2 sentences), GOVERNMENT & POWER (who rules, how legitimacy is claimed), ECONOMY (what it exports, who it exploits), CULTURE (values, taboos, one vivid custom), HISTORY (two defining events), FAULT LINES (the internal tension likely to erupt), STORY HOOKS (2 one-line conflicts a story could enter through). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'city-generator',
    name: 'City Generator',
    category: 'world',
    glyph: '⌬',
    description: 'A city you can smell from the page.',
    temperature: 0.95,
    codexType: 'location',
    fields: [seedField('Region, size, era, mood')],
    buildDirective: () =>
      'Create a city for this world. Sections: NAME & FIRST IMPRESSION (what a newcomer sees, smells, hears — 3 sentences), DISTRICTS (4-5, one line each: name + character), WHO RUNS IT (official power vs. actual power), THE UNDERBELLY (what thrives in its shadows), ONE LANDMARK (described in 2 sentences), CITY SECRET (something the city itself seems to hide), STORY HOOKS (2 one-liners). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'magic-system',
    name: 'Magic System Builder',
    category: 'world',
    glyph: '✦',
    description: 'Magic with rules, costs, and consequences.',
    temperature: 0.9,
    codexType: 'magic',
    fields: [seedField('Source, aesthetic, hard vs soft — any preferences')],
    buildDirective: () =>
      'Design a magic system. Sections: SOURCE (where power comes from), ACCESS (who can use it and why), MECHANICS (how it is actually performed, 2-3 sentences), COST (what it takes from the user — make it hurt), LIMITS (what it cannot do, hard lines), SOCIAL CONSEQUENCE (how its existence has warped society), LOOPHOLE (one exploit clever characters might find), SENSORY SIGNATURE (what magic looks/sounds/feels like on the page). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'technology-system',
    name: 'Technology System Builder',
    category: 'world',
    glyph: '⚙',
    description: 'A technology and the world bent around it.',
    temperature: 0.9,
    codexType: 'technology',
    fields: [seedField('Era, hardness of the sci-fi, the itch to scratch')],
    buildDirective: () =>
      'Design a signature technology for this world. Sections: THE TECH (what it does, one paragraph), HOW IT WORKS (plausible-sounding principle, 2 sentences), WHO CONTROLS IT, WHAT IT COSTS (resources, side effects, externalities), HOW IT BROKE SOCIETY (2-3 second-order effects people didn\'t predict), THE BLACK MARKET VERSION, FAILURE MODE (what happens when it goes wrong — vividly). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'religion-generator',
    name: 'Religion Generator',
    category: 'world',
    glyph: '☨',
    description: 'A faith with doctrine, ritual, and heresy.',
    temperature: 0.95,
    codexType: 'religion',
    fields: [seedField('Deity count, tone, relationship to truth')],
    buildDirective: () =>
      'Create a religion for this world. Sections: NAME & CORE CLAIM (what it says the universe is), THE DIVINE (god, gods, or absence — 2 sentences), PRACTICE (daily observance + one major rite described vividly), CLERGY & POWER (structure, and what corruption looks like here), THE COMFORT (what it genuinely gives believers), THE HERESY (the forbidden variant and why it threatens the orthodoxy), WHAT IF IT\'S TRUE / FALSE (one line each on the story implications). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'creature-generator',
    name: 'Creature Generator',
    category: 'world',
    glyph: '𓆉',
    description: 'A creature with ecology, not just teeth.',
    temperature: 1.0,
    codexType: 'species',
    fields: [seedField('Habitat, threat level, mundane or mythic')],
    buildDirective: () =>
      'Create a creature for this world. Sections: NAME & FIRST SIGHTING (2-3 sentences of a character encountering it — sensory, unsettling or wondrous), BIOLOGY (size, diet, senses, one bizarre adaptation), BEHAVIOR (how it hunts/hides/mates — something readers won\'t expect), ECOLOGY (its niche; what eats it, what it keeps in check), HUMAN RELATIONS (feared, farmed, worshipped, misunderstood?), THE MYTH VS THE TRUTH (what locals believe vs. what is real). Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'artifact-generator',
    name: 'Artifact Generator',
    category: 'world',
    glyph: '⚱',
    description: 'An object of power with a price and a past.',
    temperature: 0.95,
    codexType: 'artifact',
    fields: [seedField('Power level, aesthetic, who might want it')],
    buildDirective: () =>
      'Create an artifact for this world. Sections: NAME & APPEARANCE (2 sentences — worn, specific, tactile), POWER (what it actually does, precisely bounded), PRICE (what use extracts from the wielder), PROVENANCE (its history in three brief episodes: making, infamy, disappearance), CURRENT LOCATION (and what guards it), WHY IT CORRUPTS (the temptation pattern), THE RUMOR THAT\'S WRONG (a widely believed falsehood about it). Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'language-seed',
    name: 'Language Seed Generator',
    category: 'world',
    glyph: 'ᛃ',
    description: 'Enough conlang to flavor a manuscript.',
    temperature: 0.9,
    codexType: 'language',
    fields: [seedField('Phonetic vibe (harsh, liquid, tonal), culture that speaks it')],
    buildDirective: () =>
      'Create a language seed — not a full conlang, but enough to write with. Sections: NAME & SOUND (its phonetic character in 2 sentences, which consonants and vowels dominate), NAMING PATTERNS (how people and places are named, with 6 example names), LEXICON (12 useful words with meanings: greetings, curses, kinship, one untranslatable concept), GRAMMAR FLAVOR (2 quirks, e.g. no future tense, honorific suffixes), SPEECH ON THE PAGE (how to render accented dialogue without phonetic spelling). Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'political-faction',
    name: 'Political Faction Builder',
    category: 'world',
    glyph: '♞',
    description: 'A faction with ideology, methods, and rot.',
    temperature: 0.9,
    codexType: 'faction',
    fields: [seedField('The conflict they exist inside; scale; legality')],
    buildDirective: () =>
      'Create a political faction. Sections: NAME & BANNER (name, symbol, slogan), IDEOLOGY (what they believe, stated as they would state it), WHAT THEY ACTUALLY WANT (the interest beneath the ideology), METHODS (how they operate, from public to deniable), MEMBERSHIP (who joins and why it feels good to belong), LEADERSHIP (the figurehead and the real operator), INTERNAL ROT (the contradiction that will split them), PRESSURE ON THE STORY (2 one-line ways they complicate this narrative). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'economy-builder',
    name: 'Economy Builder',
    category: 'world',
    glyph: '⚖',
    description: 'Who has what, who wants it, who starves.',
    temperature: 0.85,
    codexType: 'other',
    fields: [seedField('Setting, tech/magic level, scarcity to explore')],
    buildDirective: () =>
      'Design the economy of this setting. Sections: THE SPINE (the one resource or trade everything depends on), CURRENCY & VALUE (what money is, what it is quietly backed by), WHO HAS IT (the wealthy class and how they keep it), WHO MAKES IT (labor, and what it does to laborers), THE CHOKE POINT (the vulnerability — route, monopoly, harvest — that a plot could squeeze), BLACK & GREY MARKETS, WHAT A LOAF OF BREAD COSTS (ground-level texture: 3 everyday prices in local terms). Under 400 words. ' + NO_PREAMBLE,
  },
  {
    id: 'map-prompt',
    name: 'Map Prompt Generator',
    category: 'world',
    glyph: '✧',
    description: 'An image-generation prompt for your world\'s map.',
    temperature: 0.85,
    codexType: 'other',
    fields: [
      seedField('Regions, landmarks, coastlines — everything the map must show'),
      { id: 'style', label: 'Map style', type: 'select', options: ['inked fantasy atlas', 'aged parchment & sepia', 'nautical chart', 'art-nouveau city plan', 'star chart / orbital', 'hand-drawn journal sketch'] },
    ],
    buildDirective: (v) =>
      `Write one detailed image-generation prompt for a map of this story's world in the style: ${v.style ?? 'inked fantasy atlas'}. ` +
      'Single paragraph, 120-180 words: name the geography and named locations to depict (drawn from the provided notes and story context), spatial relationships, decorative elements (compass rose, sea monsters, border cartouche as fits the style), medium and texture keywords, palette, and lighting. Then a second line beginning "Negative:" listing what to avoid (modern labels, photorealism, etc.). ' + NO_PREAMBLE,
  },
  {
    id: 'cultural-conflict',
    name: 'Cultural Conflict Generator',
    category: 'world',
    glyph: '⨯',
    description: 'Two cultures grinding against each other.',
    temperature: 0.9,
    codexType: 'other',
    fields: [
      { id: 'a', label: 'Culture A', type: 'text', placeholder: 'First culture (or leave blank to invent)' },
      { id: 'b', label: 'Culture B', type: 'text', placeholder: 'Second culture (or leave blank to invent)' },
    ],
    buildDirective: (v) =>
      `Generate a cultural conflict${v.a || v.b ? ` between ${v.a || 'an invented culture'} and ${v.b || 'an invented culture'}` : ' between two cultures of this world'}. ` +
      'Sections: THE INCOMPATIBILITY (the value or practice each side finds intolerable in the other — make both positions sympathetic from inside), HISTORY OF FRICTION (two past flashpoints), HOW IT LOOKS DAILY (3 small ground-level frictions: markets, marriages, manners), WHO PROFITS from the tension, THE TRAGEDY (why good people on both sides make it worse), STORY PRESSURE (2 one-line scene ideas). Under 400 words. ' + NO_PREAMBLE,
  },
]

// ============================================================
// REVISION
// ============================================================

const revisionTools: ForgeTool[] = [
  {
    id: 'developmental-edit',
    name: 'Developmental Edit',
    category: 'revision',
    glyph: '⌗',
    description: 'Big-picture notes: structure, stakes, character logic.',
    temperature: 0.5,
    fields: [pasteField('Text to assess')],
    buildDirective: () =>
      'Give a developmental edit of the provided passage. Sections: WHAT\'S WORKING (2-3 genuine strengths, cited), STRUCTURE (does the scene have a turn? does it start and end in the right place?), STAKES & TENSION (what the reader is worried about, and whether that is enough), CHARACTER LOGIC (any action or emotion that isn\'t earned), PRIORITY FIXES (the 3 changes with the highest payoff, ordered). Big picture only — no line notes. Under 450 words. ' + NO_PREAMBLE,
  },
  {
    id: 'line-edit',
    name: 'Line Edit',
    category: 'revision',
    glyph: '✎',
    description: 'Sentence-level rewrite for rhythm, clarity, force.',
    temperature: 0.6,
    fields: [pasteField('Text to line edit')],
    buildDirective: () =>
      'Line edit the provided passage: rewrite it sentence by sentence for rhythm, clarity, and force while preserving the author\'s voice, meaning, POV, and tense. Tighten flab, vary sentence lengths, sharpen verbs, kill unintentional repetition. Do not add plot content. Output the full edited passage, then a line "—" and 3-5 bullet notes on the recurring habits you corrected. ' + NO_PREAMBLE,
  },
  {
    id: 'copy-edit',
    name: 'Copy Edit',
    category: 'revision',
    glyph: '§',
    description: 'Grammar, punctuation, continuity, consistency.',
    temperature: 0.3,
    fields: [pasteField('Text to copy edit')],
    buildDirective: () =>
      'Copy edit the provided passage: correct grammar, punctuation, spelling, tense slips, and dialogue punctuation; enforce consistency in capitalization, hyphenation, and number style. Change nothing stylistic — the voice stays exactly as written. Output the corrected passage, then a line "—" and a bullet list of every category of error fixed (with counts). ' + NO_PREAMBLE,
  },
  {
    id: 'tone-check',
    name: 'Tone Check',
    category: 'revision',
    glyph: '♫',
    description: 'Is the passage singing in the right key?',
    temperature: 0.4,
    fields: [
      pasteField('Text to check'),
      { id: 'target', label: 'Intended tone', type: 'text', placeholder: 'e.g. creeping dread, wistful, screwball' },
    ],
    buildDirective: (v) =>
      `Analyze the tone of the provided passage${v.target ? ` against the intended tone: "${v.target}"` : ''}. ` +
      'Report: CURRENT TONE (name it precisely, 1-2 sentences), DRIFT POINTS (quote each moment where the tone slips — a jokey word in a grave scene, purple flare in spare prose — and say what it does to the reader), CARRIERS (which specific words/images are doing the tonal work well), TUNING (3 concrete word- or image-level adjustments). Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'pacing-report',
    name: 'Pacing Report',
    category: 'revision',
    glyph: '∿',
    description: 'Where the passage drags, rushes, or breathes.',
    temperature: 0.4,
    fields: [pasteField('Text to analyze')],
    buildDirective: () =>
      'Analyze the pacing of the provided passage. Report: SHAPE (a one-line description of the tempo curve, e.g. "slow build, spike, long exhale"), DRAG (quote where momentum dies and diagnose why — summary where scene is needed, over-description, repeated beats), RUSH (quote where the prose outruns the emotion and the reader needs a beat), BREATH (whether tension is ever released, and where it should be), FIXES (3 ordered interventions, each one sentence). Under 350 words. ' + NO_PREAMBLE,
  },
  {
    id: 'scene-compression',
    name: 'Scene Compression',
    category: 'revision',
    glyph: '⇲',
    description: 'The same scene at two-thirds the length.',
    temperature: 0.6,
    fields: [pasteField('Text to compress')],
    buildDirective: () =>
      'Compress the provided passage to roughly 60-70% of its length while preserving every plot beat, all essential dialogue, the POV, tense, and voice. Cut: redundant beats, over-explained emotion, weather that isn\'t doing work, dialogue that circles. Merge sentences where two do one job. Output only the compressed passage. ' + NO_PREAMBLE,
  },
  {
    id: 'scene-expansion',
    name: 'Scene Expansion',
    category: 'revision',
    glyph: '⇱',
    description: 'Opens a rushed scene into its full breath.',
    temperature: 0.8,
    fields: [
      pasteField('Text to expand'),
      { id: 'focus', label: 'Expand toward', type: 'select', options: ['interiority & emotion', 'sensory grounding', 'dialogue & confrontation', 'tension & dread', 'all of it'] },
    ],
    buildDirective: (v) =>
      `Expand the provided passage to roughly 150-200% of its length, deepening especially: ${v.focus ?? 'all of it'}. ` +
      'Do not add new plot events — open up what is already there: slow the key beats, let reactions land, ground the body in the space. Keep POV, tense, and voice exactly. Output only the expanded passage. ' + NO_PREAMBLE,
  },
  {
    id: 'show-dont-tell',
    name: 'Show-Don\'t-Tell Pass',
    category: 'revision',
    glyph: '◉',
    description: 'Converts named emotions into behavior and image.',
    temperature: 0.7,
    fields: [pasteField('Text to convert')],
    buildDirective: () =>
      'Rewrite the provided passage converting told emotion into shown behavior: named feelings ("she was furious") become action, physiology, dialogue, and image that produce the feeling in the reader. Leave deliberate summary alone where compression is clearly intended. Keep length within 120% of the original, same POV/tense/voice. Output the rewritten passage, then a line "—" and bullets quoting each told phrase you converted. ' + NO_PREAMBLE,
  },
  {
    id: 'sensory-detail-pass',
    name: 'Sensory Detail Pass',
    category: 'revision',
    glyph: '❉',
    description: 'Grounds the scene in all five senses.',
    temperature: 0.75,
    fields: [pasteField('Text to enrich')],
    buildDirective: () =>
      'Rewrite the provided passage weaving in sensory grounding — prioritize the neglected senses (usually sound, smell, touch, temperature) over more visuals. Details must be specific to this place and filtered through the POV character\'s state of mind; no generic garnish. Add no plot events; keep length within 130% of the original. Output only the rewritten passage. ' + NO_PREAMBLE,
  },
  {
    id: 'dialogue-tightening',
    name: 'Dialogue Tightening',
    category: 'revision',
    glyph: '✂',
    description: 'Cuts throat-clearing; sharpens every spoken line.',
    temperature: 0.6,
    fields: [pasteField('Dialogue-heavy passage to tighten')],
    buildDirective: () =>
      'Tighten the dialogue in the provided passage: cut greetings, filler ("well," "look," "I mean") unless characterizing, on-the-nose restatement, and any line that neither advances nor reveals. Replace weak tags-plus-adverbs with action beats or plain "said." Narration between lines stays untouched except where a cut orphans it. Output the tightened passage, then a line "—" and a one-line note of roughly how much dialogue was cut. ' + NO_PREAMBLE,
  },
  {
    id: 'prose-polish',
    name: 'Prose Polish',
    category: 'revision',
    glyph: '✵',
    description: 'A final gloss: word choice, cadence, shine.',
    temperature: 0.6,
    fields: [pasteField('Text to polish')],
    buildDirective: () =>
      'Give the provided passage a final polish pass: upgrade flat word choices, smooth cadence stumbles, break or fuse sentences for rhythm, eliminate echoes (repeated words within close range), and sharpen the final line of each paragraph. This is a gloss, not a rewrite — a reader comparing versions should feel the improvement without being able to say the passage changed. Output only the polished passage. ' + NO_PREAMBLE,
  },
  {
    id: 'readability-pass',
    name: 'Readability Pass',
    category: 'revision',
    glyph: '☲',
    description: 'Untangles knots that make readers reread.',
    temperature: 0.5,
    fields: [pasteField('Text to clarify')],
    buildDirective: () =>
      'Rewrite the provided passage for readability: untangle sentences that force rereading, resolve ambiguous pronouns, break up stacked clauses, clarify who is doing what in action sequences, and make time-jumps and scene geography trackable. Preserve the voice — clarity, not simplification. Output the clarified passage, then a line "—" and bullets quoting the 3 worst original knots. ' + NO_PREAMBLE,
  },
  {
    id: 'chapter-summary',
    name: 'Chapter Summary',
    category: 'revision',
    glyph: '≡',
    description: 'A working summary for your outline or scene list.',
    temperature: 0.3,
    fields: [pasteField('Chapter or scene text to summarize')],
    buildDirective: () =>
      'Summarize the provided text for the author\'s working notes. Deliver: SUMMARY (one tight paragraph, 4-6 sentences, past tense, plot-complete), then labeled single lines — POV:, LOCATION:, TIME:, ADVANCES: (which plotlines move), REVEALS: (new information surfaced), SEEDS: (setups planted needing future payoff), STATE CHANGES: (character or world changes that persist). ' + NO_PREAMBLE,
  },
]

// ============================================================
// PUBLISHING
// ============================================================

const publishingTools: ForgeTool[] = [
  {
    id: 'back-cover-blurb',
    name: 'Back Cover Blurb',
    category: 'publishing',
    glyph: '❡',
    description: 'Jacket copy that sells without spoiling.',
    temperature: 0.9,
    fields: [seedField('Extra selling points, comps, or angle to emphasize')],
    projectPayload: (p) => [storyBrainBlock(p)].join('\n\n'),
    buildDirective: () =>
      'Write back cover blurb copy for this book: a one-line hook in italics-style emphasis, then 2-3 short paragraphs (120-170 words total) introducing protagonist, conflict, and stakes with rising urgency, ending on an unresolved question. Spoil nothing past the first act. Then provide one alternate hook line under the label "ALT HOOK:". Match the genre\'s marketing register. ' + NO_PREAMBLE,
  },
  {
    id: 'query-letter',
    name: 'Query Letter Draft',
    category: 'publishing',
    glyph: '✉',
    description: 'An agent-ready query letter draft.',
    temperature: 0.8,
    fields: [
      { id: 'wordcount', label: 'Word count', type: 'text', placeholder: 'e.g. 95,000' },
      { id: 'comps', label: 'Comp titles (optional)', type: 'text', placeholder: 'e.g. THE FIFTH SEASON meets KNIVES OUT' },
      { id: 'bio', label: 'Author bio notes (optional)', type: 'textarea', placeholder: 'Credits, expertise, platform' },
    ],
    projectPayload: (p) => storyBrainBlock(p),
    buildDirective: (v) =>
      `Draft a query letter for this novel${v.wordcount ? ` (${v.wordcount} words)` : ''}. Structure: personalized-greeting placeholder "[Agent name]", housekeeping line (title, genre, word count${v.comps ? `, comps: ${v.comps}` : ', with a [comp titles] placeholder'}), then 2 paragraphs of story pitch focused on protagonist, choice, and stakes (no more than 200 words of pitch), then a brief bio paragraph${v.bio ? ' from the provided notes' : ' with placeholders'}, then a professional closing. Under 400 words total. ` + NO_PREAMBLE,
  },
  {
    id: 'synopsis-generator',
    name: 'Synopsis Generator',
    category: 'publishing',
    glyph: '𝄞',
    description: 'The dreaded one-page synopsis, spoilers included.',
    temperature: 0.6,
    fields: [seedField('Ending and any midpoint events not in the manuscript yet')],
    projectPayload: (p) => storyBrainBlock(p),
    buildDirective: () =>
      'Write a one-page synopsis (450-550 words) of this novel in present tense, third person. Cover the full arc including the ending — synopses spoil by design. Character names in CAPS on first mention. Focus on causality (this happens BECAUSE of that) and the protagonist\'s emotional throughline; omit subplots that don\'t affect the climax. One continuous piece, minimal paragraphs. If the ending is not yet established, construct the most probable one from the material and mark it "[PROJECTED ENDING]". ' + NO_PREAMBLE,
  },
  {
    id: 'character-list-export',
    name: 'Character List Export',
    category: 'publishing',
    glyph: '☷',
    description: 'A clean dramatis personae from cast and codex.',
    temperature: 0.3,
    fields: [],
    projectPayload: (p) => [castBlock(p), codexBlock(p), manuscriptBlock(p, 4000)].join('\n\n'),
    buildDirective: () =>
      'Compile a dramatis personae from the provided cast, codex, and manuscript data. Group under headings: PRINCIPAL, SUPPORTING, MINOR (judge tier from the data). Each entry: "Name — role/epithet." then one sentence of who they are and one clause of their relationship to the protagonist. Alphabetical within groups. Include only characters present in the data — invent no one. ' + NO_PREAMBLE,
  },
  {
    id: 'series-bible-export',
    name: 'Series Bible Export',
    category: 'publishing',
    glyph: '⛃',
    description: 'The full Story Brain as an organized reference doc.',
    temperature: 0.3,
    fields: [],
    projectPayload: (p) => storyBrainBlock(p),
    buildDirective: () =>
      'Compile a series bible from the provided Story Brain data. Sections in order: OVERVIEW (title, genre, logline, current direction), WORLD (rules, magic/technology, locations — from codex), CAST (each character with state, goals, secrets, voice), FACTIONS & POWERS, OPEN THREADS (with setup and payoff status), TIMELINE, CANON RULES (anything writers must never contradict). Organize and normalize the data; flag conflicts between sources with "[CONFLICT: …]". Include only what the data supports — invent nothing. Use clear headings and tight bullets. ' + NO_PREAMBLE,
  },
  {
    id: 'ebook-metadata',
    name: 'Ebook Metadata Generator',
    category: 'publishing',
    glyph: '⌨',
    description: 'Retail metadata: description, keywords, categories.',
    temperature: 0.7,
    fields: [seedField('Target audience or comp authors, if known')],
    projectPayload: (p) => storyBrainBlock(p),
    buildDirective: () =>
      'Generate ebook retail metadata for this novel. Labeled sections: TITLE & SUBTITLE (subtitle optional — only if it adds search value), SHORT DESCRIPTION (one 150-character hook), LONG DESCRIPTION (retailer-ready, 150-200 words, short punchy paragraphs, may use rhetorical questions sparingly), KEYWORDS (7 search phrases readers actually type, comma-separated), CATEGORIES (3 BISAC-style category paths), AUDIENCE (one line), COMP TITLES (3, with a clause on the shared appeal of each). ' + NO_PREAMBLE,
  },
  {
    id: 'content-notes',
    name: 'Content Notes Generator',
    category: 'publishing',
    glyph: '⚠',
    description: 'Reader-advisory content notes for the manuscript.',
    temperature: 0.2,
    fields: [seedField('Content in later/unwritten sections the excerpt won\'t show')],
    projectPayload: (p) => manuscriptBlock(p, 14000),
    buildDirective: () =>
      'Generate reader-advisory content notes for this book from the manuscript excerpt and any author notes. Format: a spoiler-light bullet list of content categories present (e.g. violence, grief, substance use), each with an intensity tag (mild / moderate / strong) and a non-graphic one-clause description of context. Then DETAILED NOTES: a second list with slightly more specific (still restrained) detail, prefixed "Spoiler-adjacent:". List only what the material evidences — do not speculate categories into existence. ' + NO_PREAMBLE,
  },
  {
    id: 'adaptation-pitch',
    name: 'Adaptation Pitch Deck',
    category: 'publishing',
    glyph: '✪',
    description: 'A film/TV pitch outline for the property.',
    temperature: 0.85,
    fields: [
      { id: 'format', label: 'Format', type: 'select', options: ['limited series', 'ongoing series', 'feature film', 'animated series'] },
    ],
    projectPayload: (p) => storyBrainBlock(p),
    buildDirective: (v) =>
      `Outline an adaptation pitch deck for this story as a ${v.format ?? 'limited series'}. Slides as labeled sections: LOGLINE, WHY NOW (cultural relevance, one paragraph), TONE & COMPS ("X meets Y" plus a palette of 3 reference titles), THE WORLD (one paragraph), CHARACTERS (top 4-5, one line each with casting-archetype note), SEASON/STORY ARC (the shape in 5-7 beats${v.format === 'ongoing series' ? ', plus one line on future-season engine' : ''}), SET PIECES (3 unmissable visual sequences), AUDIENCE. Punchy, confident, under 550 words. ` + NO_PREAMBLE,
  },
]

// ============================================================
// EXPANSION — the road to 100
// ============================================================

const expansionTools: ForgeTool[] = [
  // ---- idea ----
  {
    id: 'opening-line-generator',
    name: 'Opening Line Generator',
    category: 'idea',
    glyph: '✒',
    description: 'Ten first lines that make putting the book down impossible.',
    temperature: 1.0,
    fields: [seedField('What the story is about — or leave blank to use the project logline')],
    buildDirective: () =>
      'Write exactly 10 opening lines for this story, each a complete first sentence. ' +
      'Vary the register: one voice-forward, one image, one mid-action, one unsettling statement of fact, one dialogue, one aphorism turned wrong, and four wildcards. ' +
      'Numbered 1-10, nothing after each line. ' + NO_PREAMBLE,
  },
  {
    id: 'dramatic-question-engine',
    name: 'Dramatic Question Engine',
    category: 'idea',
    glyph: '⁈',
    description: 'The questions a reader needs answered — engine of every page-turn.',
    fields: [seedField('Premise or situation — or leave blank to use the Story Brain')],
    buildDirective: () =>
      'Identify the dramatic questions this story raises. Output three labeled tiers: ' +
      'CENTRAL QUESTION (the one the ending must answer), ACT QUESTIONS (2-3 that structure the middle), SCENE FUEL (5 smaller questions that can each drive a chapter). ' +
      'One line each, phrased as questions a reader would actually feel. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
  {
    id: 'constraint-forge',
    name: 'Constraint Forge',
    category: 'idea',
    glyph: '⛓',
    description: 'Creative constraints that squeeze better work out of you.',
    temperature: 1.1,
    fields: [
      { id: 'target', label: 'Constrain what?', type: 'select', options: ['a scene', 'a chapter', 'a short story', 'the whole novel'] },
    ],
    buildDirective: (v) =>
      `Generate 8 creative constraints for writing ${v.target ?? 'a scene'}, in the spirit of Oulipo and writing-room dares. ` +
      'Mix types: structural (form, POV, time), linguistic (banned words, sentence rules), dramatic (what must/may not happen). ' +
      'Each: the constraint in one bold sentence, then one line on why it forces better craft. Numbered 1-8. ' + NO_PREAMBLE,
  },
  {
    id: 'comp-titles',
    name: 'Comp Titles Finder',
    category: 'idea',
    glyph: '≍',
    description: '"X meets Y" comparables agents and readers instantly get.',
    fields: [seedField('Premise — or leave blank to use the Story Brain')],
    buildDirective: () =>
      'Propose comparable titles for this story. Output: 5 "X meets Y" pairings (mix books, films, series; one line each on what the pairing captures), ' +
      'then 3 straight comps from the last decade with one line on the shared audience, then one line naming the shelf this book lives on. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },

  // ---- plot ----
  {
    id: 'midpoint-reversal',
    name: 'Midpoint Reversal Generator',
    category: 'plot',
    glyph: '↯',
    description: 'The turn that makes the second half a different story.',
    fields: [seedField('Where the story stands at the middle — or leave blank to use the Story Brain')],
    buildDirective: () =>
      'Propose 5 midpoint reversals for this story. For each: THE TURN (one sentence), WHAT IT REVEALS (a truth that recontextualizes act one), ' +
      'WHAT IT COSTS (the thing the protagonist can no longer do or believe), and NEW ENGINE (what now drives the second half). ' +
      'Separate with blank lines. Make at least one reversal quiet rather than explosive. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
  {
    id: 'subplot-weaver',
    name: 'Subplot Weaver',
    category: 'plot',
    glyph: '⧉',
    description: 'Subplots that echo the theme instead of padding the page count.',
    fields: [],
    buildDirective: () =>
      'Design 4 subplots for this story. For each: NAME, WHO CARRIES IT (prefer existing cast), the ARC in three beats, HOW IT ECHOES the main theme (mirror, inversion, or escalation), and WHERE IT TOUCHES the main plot (two concrete intersection points). ' +
      'A subplot that could be cut without loss is a failure — make each one load-bearing. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
  {
    id: 'stakes-escalator',
    name: 'Stakes Escalator',
    category: 'plot',
    glyph: '⇞',
    description: 'A ladder of rising stakes from bruised pride to the unthinkable.',
    fields: [seedField('The current conflict — or leave blank to use the Story Brain')],
    buildDirective: () =>
      'Build a stakes ladder for this story: 7 rungs, each raising what can be lost. ' +
      'Rung 1 is where the story currently stands; rung 7 is the worst credible loss (keep it inside the story\'s scale — intimate stories deserve intimate rung-7s). ' +
      'Each rung: one sentence of what is now at risk + one sentence of the event that could raise the stakes to the next rung. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
  {
    id: 'chekhov-auditor',
    name: 'Chekhov Auditor',
    category: 'plot',
    glyph: '⚷',
    description: 'Every gun on every mantle — planted elements awaiting their shot.',
    temperature: 0.4,
    fields: [],
    buildDirective: () =>
      'Audit the manuscript for Chekhov elements: objects, skills, wounds, promises, and facts given narrative weight that have not yet paid off. ' +
      'Output a table-like list: ELEMENT — WHERE PLANTED (chapter/scene) — WEIGHT (how loaded the planting felt, 1-3 🜂) — SUGGESTED PAYOFF (one sentence). ' +
      'End with any tracked plot threads that look abandoned. ' + NO_PREAMBLE,
    projectPayload: (p) => [manuscriptBlock(p, 12000), threadsBlock(p)].join('\n\n'),
  },
  {
    id: 'ticking-clock',
    name: 'Ticking Clock Generator',
    category: 'plot',
    glyph: '⌛',
    description: 'Deadlines and countdowns that turn tension into dread.',
    fields: [seedField('The situation that needs time pressure')],
    buildDirective: () =>
      'Design 5 ticking clocks for this situation. For each: THE CLOCK (what runs out), THE DEADLINE (when and why it\'s fixed), VISIBLE TICKS (2-3 ways the reader feels time passing on the page), and AT ZERO (the irreversible consequence). ' +
      'Vary the scales: one physical, one social, one emotional, one hidden-from-the-protagonist, one wildcard. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },

  // ---- character ----
  {
    id: 'foil-designer',
    name: 'Foil Designer',
    category: 'character',
    glyph: '☯',
    description: 'Characters who reveal your protagonist by contrast.',
    fields: [
      { id: 'who', label: 'Foil for whom?', type: 'text', placeholder: 'Character name (from the Cast Ledger)' },
    ],
    buildDirective: (v) =>
      `Design 3 possible foil characters for ${v.who || 'the protagonist'}. ` +
      'For each: NAME & ROLE, THE SHARED TRAIT (what makes comparison inevitable), THE DIVERGENCE (the one different choice or value), ' +
      'WHAT THE CONTRAST EXPOSES about the protagonist that no other device could, and ONE SCENE that would stage the contrast. ' +
      'Prefer foils who could also carry a subplot. ' + NO_PREAMBLE,
    projectPayload: (p) => castBlock(p),
  },
  {
    id: 'flaw-generator',
    name: 'Fatal Flaw Generator',
    category: 'character',
    glyph: '☒',
    description: 'Flaws wired to the arc — the crack the story pries open.',
    fields: [
      { id: 'who', label: 'Whose flaw?', type: 'text', placeholder: 'Character name, or blank for a new character' },
    ],
    buildDirective: (v) =>
      `Generate 5 fatal flaws${v.who ? ` for ${v.who}` : ''}. ` +
      'For each: THE FLAW (one phrase — a distortion of a virtue, not a vice), ITS ROOT (the wound or lesson that installed it), HOW IT HELPS (why they keep it), ' +
      'HOW IT WILL BETRAY THEM (the story moment where it costs everything), and THE CURE\'S PRICE (what facing it would cost). ' + NO_PREAMBLE,
    projectPayload: (p) => castBlock(p),
  },
  {
    id: 'minor-spotlight',
    name: 'Minor Character Spotlight',
    category: 'character',
    glyph: '✧',
    description: 'Give a walk-on part a whole life in four sentences.',
    fields: [
      { id: 'who', label: 'Which minor character?', type: 'text', placeholder: 'The innkeeper, the border guard, the sister who calls…' },
    ],
    buildDirective: (v) =>
      `Bring the minor character "${v.who || 'a walk-on from the recent pages'}" briefly, vividly to life. ` +
      'Output: a four-sentence interior portrait (what they want today, what they notice, what they will never say), ' +
      'ONE TELL (a physical habit the narrator could observe), ONE LINE of dialogue only they would say, and ONE SECRET connection to the main plot the author may ignore or use. ' + NO_PREAMBLE,
    projectPayload: (p) => [manuscriptBlock(p, 6000), castBlock(p)].join('\n\n'),
  },
  {
    id: 'name-forge',
    name: 'Name Forge',
    category: 'character',
    glyph: '✍',
    description: 'Names with texture — sound, meaning, and nickname potential.',
    temperature: 1.0,
    fields: [
      { id: 'kind', label: 'Naming', type: 'select', options: ['a character', 'a family/house', 'a place', 'a ship/vessel', 'an organization'] },
      { id: 'flavor', label: 'Cultural flavor / sound', type: 'text', placeholder: 'e.g. Norse-adjacent, Meiji Japan, decayed Latin, invented' },
    ],
    buildDirective: (v) =>
      `Generate 12 names for ${v.kind ?? 'a character'}${v.flavor ? ` with a ${v.flavor} flavor` : ' fitting this project\'s world'}. ` +
      'For each: the name, a syllable-stress note in brackets, the meaning or association it carries, and (for characters) the nickname it decays into among friends. ' +
      'No two names may share a first letter more than twice. ' + NO_PREAMBLE,
  },
  {
    id: 'secret-generator',
    name: 'Secret Generator',
    category: 'character',
    glyph: '⚿',
    description: 'Secrets worth keeping — and the moments they should detonate.',
    fields: [
      { id: 'who', label: 'Whose secret?', type: 'text', placeholder: 'Character name, or blank to spread across the cast' },
    ],
    buildDirective: (v) =>
      `Generate 6 secrets${v.who ? ` ${v.who} could be keeping` : ' distributed across this cast'}. ` +
      'For each: THE SECRET (one sentence), WHO MUST NEVER KNOW and why, THE COST OF KEEPING IT (daily, corrosive), THE PERFECT REVEAL MOMENT (worst possible timing), and THE LIE it forces them to tell on the page before then. ' +
      'At least one secret should be kept out of love rather than shame. ' + NO_PREAMBLE,
    projectPayload: (p) => castBlock(p),
  },

  // ---- dialogue ----
  {
    id: 'dialect-designer',
    name: 'Dialect & Speech Pattern Designer',
    category: 'dialogue',
    glyph: '¿',
    description: 'A voice fingerprint: rhythm, vocabulary, and verbal tics.',
    fields: [
      { id: 'who', label: 'For whom?', type: 'text', placeholder: 'Character name or archetype' },
      seedField('Background: region, class, education, era, trauma…'),
    ],
    buildDirective: (v) =>
      `Design a speech pattern for ${v.who || 'this character'}. Output labeled sections: ` +
      'RHYTHM (sentence length and music), VOCABULARY (five words they overuse, five they would never use), GRAMMAR QUIRKS (2-3, subtle — readable, never phonetic spelling), ' +
      'EVASIONS (how they dodge questions), UNDER PRESSURE (how the pattern breaks when stressed), and a 6-line SAMPLE EXCHANGE demonstrating all of it against a neutral speaker. ' + NO_PREAMBLE,
    projectPayload: (p) => castBlock(p),
  },
  {
    id: 'interruption-pass',
    name: 'Interruption Pass',
    category: 'dialogue',
    glyph: '—',
    description: 'Real conversations overlap — make the dialogue fight for air.',
    temperature: 0.6,
    fields: [pasteField('Dialogue to roughen up')],
    buildDirective: () =>
      'Rewrite this dialogue so it breathes like a real conversation: interruptions (em-dash cuts), talked-over half-lines, unanswered questions, a beat where someone replies to the thing said two lines ago. ' +
      'Preserve every plot fact and the scene\'s outcome. Do not add narration beyond minimal beats. Output only the rewritten passage. ' + NO_PREAMBLE,
  },
  {
    id: 'first-meeting',
    name: 'First Meeting Generator',
    category: 'dialogue',
    glyph: '≋',
    description: 'Two characters collide for the first time — sparks included.',
    fields: [
      { id: 'a', label: 'Character A', type: 'text', placeholder: 'Name' },
      { id: 'b', label: 'Character B', type: 'text', placeholder: 'Name' },
      { id: 'charge', label: 'Charge', type: 'select', options: ['instant friction', 'wary curiosity', 'unwanted attraction', 'false first impressions', 'one recognizes the other'] },
    ],
    buildDirective: (v) =>
      `Write the first meeting between ${v.a || 'Character A'} and ${v.b || 'Character B'}, charged with ${v.charge ?? 'instant friction'}. ` +
      'Dialogue-led scene, 250-400 words, in the project\'s voice. Each must want something from the exchange and neither may fully get it. ' +
      'End on the line that guarantees they\'ll meet again. ' + NO_PREAMBLE,
    projectPayload: (p) => castBlock(p),
  },
  {
    id: 'epistolary-composer',
    name: 'Epistolary Composer',
    category: 'dialogue',
    glyph: '✉',
    description: 'In-world documents: letters, diaries, reports, transmissions.',
    fields: [
      { id: 'kind', label: 'Document', type: 'select', options: ['letter', 'diary entry', 'official report', 'last testament', 'intercepted message', 'newspaper clipping'] },
      { id: 'who', label: 'Written by', type: 'text', placeholder: 'Character name' },
      seedField('What it must convey — and what it must accidentally reveal'),
    ],
    buildDirective: (v) =>
      `Compose an in-world ${v.kind ?? 'letter'} written by ${v.who || 'a character from the cast'}. ` +
      'Fully in their voice and period register, with plausible formalities. It should say what the writer intends — and betray one thing they didn\'t mean to reveal, visible only between the lines. ' +
      'Under 350 words. ' + NO_PREAMBLE,
    projectPayload: (p) => [castBlock(p), codexBlock(p)].join('\n\n'),
  },

  // ---- world ----
  {
    id: 'festival-generator',
    name: 'Festival & Holiday Generator',
    category: 'world',
    glyph: '☀',
    description: 'What this world celebrates — and what the feast papers over.',
    codexType: 'event',
    fields: [
      { id: 'where', label: 'Culture / place', type: 'text', placeholder: 'Leave blank to fit the project world' },
    ],
    buildDirective: (v) =>
      `Design a festival or holiday${v.where ? ` for ${v.where}` : ' for this world'}. ` +
      'Output labeled sections: NAME & SEASON, ORIGIN (the true event, then the prettier official story), OBSERVANCE (foods, rites, what children do, what drunks do), ' +
      'TABOO (the one thing never done that day), UNDERSIDE (who the festival quietly excludes or mocks), and STORY HOOKS (2 scenes that could only happen during it). Under 320 words. ' + NO_PREAMBLE,
    projectPayload: (p) => codexBlock(p),
  },
  {
    id: 'cuisine-generator',
    name: 'Cuisine & Food Culture',
    category: 'world',
    glyph: '♨',
    description: 'Meals, manners, and what eating together means here.',
    codexType: 'other',
    fields: [
      { id: 'where', label: 'Culture / place', type: 'text', placeholder: 'Leave blank to fit the project world' },
    ],
    buildDirective: (v) =>
      `Design the food culture${v.where ? ` of ${v.where}` : ' of this world'}. ` +
      'Sections: STAPLES (what the land makes possible), A COMMON MEAL (described sensorily, as prose a novel could lift), A FEAST DISH and what serving it signals, TABLE MANNERS (two rules, one class divide), ' +
      'HOSPITALITY LAW (what hosts owe guests), and SCARCITY (what people eat when it all goes wrong). Under 320 words. ' + NO_PREAMBLE,
    projectPayload: (p) => codexBlock(p),
  },
  {
    id: 'folk-tale-generator',
    name: 'Legend & Folk Tale Generator',
    category: 'world',
    glyph: '☾',
    description: 'The stories this world tells its children — with teeth.',
    codexType: 'other',
    temperature: 1.0,
    fields: [
      seedField('A place, figure, or fear the tale should orbit — or leave blank'),
      { id: 'length', label: 'Length', type: 'select', options: ['fireside version (200 words)', 'full telling (450 words)'] },
    ],
    buildDirective: (v) =>
      `Write an in-world folk tale (${v.length ?? 'fireside version (200 words)'}) as this world's people actually tell it — cadenced, repeatable, slightly wrong in the way oral stories are. ` +
      'Include one moral the tellers intend, one truth the tale accidentally preserves, and a closing formula ("and that is why…"). ' +
      'After the tale, add one line: WHAT REALLY HAPPENED, for the author\'s eyes. ' + NO_PREAMBLE,
    projectPayload: (p) => codexBlock(p),
  },
  {
    id: 'slang-generator',
    name: 'Slang & Idiom Generator',
    category: 'world',
    glyph: '»',
    description: 'How this world actually talks — curses, blessings, street shorthand.',
    codexType: 'language',
    fields: [
      { id: 'who', label: 'Spoken by', type: 'text', placeholder: 'Sailors, court nobles, gutter kids, the whole culture…' },
    ],
    buildDirective: (v) =>
      `Generate living slang${v.who ? ` for ${v.who}` : ' for this world'}: ` +
      '6 IDIOMS (each with literal origin story in one line), 4 CURSES/OATHS (graded mild → unforgivable, rooted in what this culture holds sacred), 3 BLESSINGS/GREETINGS, and 3 INSULTS with the social rule about who may say them to whom. ' +
      'Everything must be sayable aloud in prose without a glossary. ' + NO_PREAMBLE,
    projectPayload: (p) => codexBlock(p),
  },

  // ---- revision ----
  {
    id: 'echo-hunter',
    name: 'Echo Hunter',
    category: 'revision',
    glyph: '↻',
    description: 'Repeated words, pet phrases, and crutch constructions.',
    temperature: 0.3,
    fields: [pasteField('Text to sweep for echoes')],
    buildDirective: () =>
      'Hunt this text for echoes: words repeated in close proximity, pet phrases used more than once, crutch constructions (e.g. "seemed to", "began to", body-part reflexes), and rhythmic tics (same sentence shape thrice). ' +
      'Output: each echo with its count and locations paraphrased, severity (jarring / noticeable / subtle), and one alternative for the worst instance. End with the three worst offenders ranked. ' + NO_PREAMBLE,
  },
  {
    id: 'hook-audit',
    name: 'Opening Hook Audit',
    category: 'revision',
    glyph: '☄',
    description: 'A cold read of your first page — would a stranger turn it?',
    temperature: 0.4,
    fields: [pasteField('Your opening — first 300-600 words')],
    buildDirective: () =>
      'Audit this opening as a cold-reading acquisitions editor. Score five dials 1-5 with one-line justifications: VOICE, CLARITY (who/where/when grounded?), TENSION, PROMISE (what kind of book this signals), MOMENTUM (the page-turn pull). ' +
      'Then: THE LINE THAT WORKS (quote it), THE LINE THAT LOSES ME (quote + why), and the single highest-leverage revision. Honest, specific, kind. ' + NO_PREAMBLE,
  },
  {
    id: 'cliffhanger-pass',
    name: 'Cliffhanger Pass',
    category: 'revision',
    glyph: '☇',
    description: 'Sharpen a scene ending until putting the book down hurts.',
    fields: [pasteField('The scene ending (last few paragraphs)')],
    buildDirective: () =>
      'Strengthen this scene ending. Offer 3 versions of the final beats: THE CUT (end earlier than the author dared — show where), THE TURN (a late line that reframes the scene), THE DOOR (a new incoming pressure). ' +
      'Each version: the rewritten final 2-4 sentences, in the manuscript\'s voice. Then one line on which to choose and why. ' + NO_PREAMBLE,
  },
  {
    id: 'emotion-heatmap',
    name: 'Emotion Heatmap',
    category: 'revision',
    glyph: '∿',
    description: 'Beat-by-beat emotional temperature — find the flat stretches.',
    temperature: 0.4,
    fields: [pasteField('Scene or chapter to map')],
    buildDirective: () =>
      'Map the emotional temperature of this text beat by beat. Output a list: BEAT (five-word summary) — DOMINANT EMOTION — INTENSITY 1-5 — WHOSE emotion the reader is riding. ' +
      'Then diagnose: flat stretches (3+ beats at the same intensity), missing valleys before peaks, and whether the final beat lands higher or lower than the opening. One suggested adjustment. ' + NO_PREAMBLE,
  },

  // ---- publishing ----
  {
    id: 'author-bio',
    name: 'Author Bio Generator',
    category: 'publishing',
    glyph: '☙',
    description: 'Third-person bios that sound accomplished, not embarrassing.',
    fields: [
      seedField('Raw facts: day job, credits, hometown, odd hobbies — the truth, unpolished'),
      { id: 'tone', label: 'Tone', type: 'select', options: ['literary', 'warm', 'wry', 'commercial'] },
    ],
    buildDirective: (v) =>
      `Write 3 author bios in a ${v.tone ?? 'warm'} tone from these facts: a 100-word jacket bio (third person), a 50-word magazine bio, and a one-line social bio. ` +
      'No invented credentials, no "aspiring", no "wordsmith". If the facts are thin, let confidence and specificity do the work. ' + NO_PREAMBLE,
  },
  {
    id: 'social-teasers',
    name: 'Social Teaser Pack',
    category: 'publishing',
    glyph: '♯',
    description: 'Posts that sell the book without spoiling the book.',
    temperature: 1.0,
    fields: [],
    buildDirective: () =>
      'Create a social teaser pack for this book: 3 one-line hooks (under 120 characters, no hashtags), 2 "readers who loved X" posts, ' +
      '1 atmospheric mood-post built from an image in the manuscript, 1 character-voice post written as if the protagonist typed it, and 1 quote-graphic pull line taken verbatim from the prose if one qualifies. ' +
      'Label each. No spoilers past the first act. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
  {
    id: 'series-pitch',
    name: 'Series Pitch Builder',
    category: 'publishing',
    glyph: '♞',
    description: 'The next books — prove this world has more than one story in it.',
    fields: [
      { id: 'count', label: 'How many books?', type: 'select', options: ['trilogy', 'five-book series', 'open-ended series'] },
    ],
    buildDirective: (v) =>
      `Pitch this story as a ${v.count ?? 'trilogy'}. Output: SERIES TITLE + one-line series promise, then per book: TITLE, the core conflict in 2 sentences, and the ending's turn toward the next volume. ` +
      'Then THE LONG ARC (what only completes at series end), THE ENGINE (why the world keeps generating stories), and WHAT ESCALATES (scope, intimacy, or cost — pick the honest one). Under 450 words. ' + NO_PREAMBLE,
    projectPayload: (p) => storyBrainBlock(p),
  },
]

// ---------- registry ----------

export const FORGE_TOOLS: ForgeTool[] = [
  ...ideaTools,
  ...plotTools,
  ...characterTools,
  ...dialogueTools,
  ...worldTools,
  ...revisionTools,
  ...publishingTools,
  ...expansionTools,
]
