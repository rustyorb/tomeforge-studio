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
  // ---- genre modes ----
  {
    id: 'grimdark',
    name: 'Grimdark',
    description: 'Mud, moral rot, and hard-won survival.',
    temperature: 0.85,
    directive:
      'Write grimdark: morally compromised characters, visceral physical detail, no plot armor, gallows pragmatism. Beauty appears only briefly, so it cuts. Never let cynicism become cartoonish.',
  },
  {
    id: 'cozy-hearth',
    name: 'Cozy Hearth',
    description: 'Low stakes, warm hearts, tea that matters.',
    temperature: 0.85,
    directive:
      'Write cozy fiction: gentle stakes, sensory comfort (food, firelight, rain on windows), kindness as plot. Conflict is friction between good people, and every chapter earns a small warmth.',
  },
  {
    id: 'cosmic-horror',
    name: 'Cosmic Horror',
    description: 'Vast indifference, knowledge that costs.',
    temperature: 0.85,
    directive:
      'Write cosmic horror: scale that dwarfs the human, wrongness in geometry and time, curiosity punished by understanding. Never fully show the thing; let implication and aftermath do the damage.',
  },
  {
    id: 'gothic',
    name: 'Gothic',
    description: 'Decaying houses, buried sins, candlelit dread.',
    temperature: 0.85,
    directive:
      'Write gothic: architecture as psychology, weather as omen, family secrets fermenting under propriety. Long shadows, repressed longing, and the past refusing burial.',
  },
  {
    id: 'space-opera',
    name: 'Space Opera',
    description: 'Grand scale, bright ships, operatic stakes.',
    temperature: 0.9,
    directive:
      'Write space opera: sweeping scale grounded in human moments, vivid ship-and-station texture, factions with real ideologies. Wonder first, physics second, momentum always.',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Chrome, rain, corporate rot, street poetry.',
    temperature: 0.9,
    directive:
      'Write cyberpunk: high tech pressed against low life, brand-saturated streets, bodies as hardware. Clipped noir cadence, tech described by feel not spec sheet, resistance priced in flesh.',
  },
  {
    id: 'sword-sorcery',
    name: 'Sword & Sorcery',
    description: 'Pulpy blades, dark magic, red-blooded adventure.',
    temperature: 0.95,
    directive:
      'Write sword-and-sorcery: fast pulpy adventure, physical heroes with appetites, sorcery that is rare and sinister. Short chapters of muscle and cunning; keep the pace hot and the treasure cursed.',
  },
  {
    id: 'urban-fantasy',
    name: 'Urban Fantasy',
    description: 'Magic under streetlights, myth on the subway.',
    temperature: 0.9,
    directive:
      'Write urban fantasy: the mythic negotiating with the mundane, hidden economies of favors and glamours, modern voice with old powers. Ground every wonder in a recognizable city texture.',
  },
  {
    id: 'western-dust',
    name: 'Western Dust',
    description: 'Laconic riders, moral reckonings, open sky.',
    temperature: 0.85,
    directive:
      'Write western: spare declarative prose, weather and distance as characters, violence brief and consequential. Men and women of few words; let landscape and silence carry judgment.',
  },
  {
    id: 'historical-grain',
    name: 'Historical Grain',
    description: 'Period texture without the museum tour.',
    temperature: 0.8,
    directive:
      'Write historical fiction: period-true detail worn casually (work, food, money, manners), dialogue flavored but readable, worldview of the era honored without endorsing it. No anachronisms.',
  },
  {
    id: 'fairy-tale',
    name: 'Fairy-Tale Voice',
    description: 'Once-upon-a-time cadence with teeth.',
    temperature: 0.95,
    directive:
      'Write in fairy-tale register: formal rhythmic cadence, rule-of-three structures, archetypes with sudden specificity, and the old cruelty fairy tales never apologized for.',
  },
  {
    id: 'heist-caper',
    name: 'Heist Caper',
    description: 'Slick plans, banter, the double-cross you missed.',
    temperature: 0.95,
    directive:
      'Write caper: competence porn, crackling ensemble banter, plans explained just enough to be misdirection. Every scene either tightens the plan or springs a leak. Style is confidence.',
  },
  {
    id: 'political-intrigue',
    name: 'Political Intrigue',
    description: 'Knives in smiles, leverage, the long game.',
    temperature: 0.8,
    directive:
      'Write intrigue: conversations as duels, information as currency, favors with interest rates. Subtext over statement; every courtesy conceals a maneuver. Track who knows what ruthlessly.',
  },
  {
    id: 'military-line',
    name: 'Military Line',
    description: 'Unit cohesion, chain of command, cost of orders.',
    temperature: 0.8,
    directive:
      'Write military fiction: procedure and jargon worn naturally, camaraderie built in downtime, action with clear spatial logic and real costs. Orders have weight; grief is handled like gear.',
  },
  // ---- mood & vibe modes ----
  {
    id: 'melancholy-rain',
    name: 'Melancholy Rain',
    description: 'Quiet grief, grey light, beauty in loss.',
    temperature: 0.8,
    directive:
      'Write melancholic: muted palette, memory intruding on the present, losses acknowledged sidelong. Sentences fall gently. Find the ache in ordinary objects, and permit small unresolved hope.',
  },
  {
    id: 'found-family',
    name: 'Found Family Warmth',
    description: 'Chosen bonds, soft loyalty, home as people.',
    temperature: 0.85,
    directive:
      'Write found-family warmth: prickly people learning to be claimed, care expressed through action and insult, belonging built scene by scene. Sentiment earned, never syrupy.',
  },
  {
    id: 'coming-of-age',
    name: 'Coming of Age',
    description: 'First everythings, widening world, tender cringe.',
    temperature: 0.85,
    directive:
      'Write coming-of-age: a narrator slightly behind the reader\'s understanding, firsts felt at full voltage, adults glimpsed as suddenly human. Embarrassment and wonder in equal measure.',
  },
  {
    id: 'romantic-tension',
    name: 'Romantic Tension',
    description: 'Charged glances, denied wants, slow gravity.',
    temperature: 0.9,
    directive:
      'Write romantic tension: attraction conducted through attention — what they notice, what they refuse to notice. Banter as armor, proximity as event. Delay the touch; make the almost unbearable.',
  },
  {
    id: 'whimsy',
    name: 'Whimsical Wonder',
    description: 'Playful logic, delighted absurdity, light feet.',
    temperature: 1.05,
    directive:
      'Write whimsy: cheerfully sideways logic, personified oddments, narration that winks without smirking. Absurd premises honored with complete internal seriousness.',
  },
  {
    id: 'satire-blade',
    name: 'Satire Blade',
    description: 'Comedy with a target and a point.',
    temperature: 1.0,
    directive:
      'Write satire: institutions and vanities skewered through escalating straight-faced absurdity. The narrator never laughs; precision does the cutting. Punch upward.',
  },
  {
    id: 'weird-fiction',
    name: 'Weird Fiction',
    description: 'Dream logic, unstable reality, beautiful unease.',
    temperature: 1.05,
    directive:
      'Write weird fiction: reality with loosened joints, images that follow dream logic yet feel inevitable, explanations withheld on principle. Commit to the strangeness; never wink.',
  },
  {
    id: 'thriller-tick',
    name: 'Thriller Tick',
    description: 'Countdown pressure, paranoia, short chapters.',
    temperature: 0.85,
    directive:
      'Write thriller: relentless forward pressure, information doled in dangerous fragments, trust always provisional. Short paragraphs at peaks, chapter ends that shove the reader onward.',
  },
  {
    id: 'literary-interior',
    name: 'Literary Interior',
    description: 'Consciousness up close, style as substance.',
    temperature: 0.85,
    directive:
      'Write literary interiority: thought rendered with precision, perception filtered through personality, plot advanced through shifts in understanding. Trust the reader; resist summary.',
  },
  {
    id: 'minimalist-flash',
    name: 'Minimalist Flash',
    description: 'Every word load-bearing; white space speaks.',
    temperature: 0.75,
    directive:
      'Write minimalist: short declarative sentences, concrete nouns, emotion displaced into objects and gesture. Cut every adverb you can. What is omitted must press against what remains.',
  },
  {
    id: 'poetic-vignette',
    name: 'Poetic Vignette',
    description: 'Image-first prose, moments over plot.',
    temperature: 1.0,
    directive:
      'Write vignette: a single moment dilated, imagery doing narrative work, sound and rhythm audible. Plot may idle; perception may not. End on an image that reframes everything before it.',
  },
  {
    id: 'epistolary',
    name: 'Epistolary',
    description: 'Letters, logs, and documents tell the story.',
    temperature: 0.9,
    directive:
      'Write epistolary: the scene conveyed through in-world documents — letters, journal entries, reports, messages — each in its writer\'s voice, each revealing more than its author intends.',
  },
  // ---- heat ladder (romance spice levels, adult fiction) ----
  {
    id: 'heat-1-sweet',
    name: 'Heat 🌶 Sweet',
    description: 'Closed door. Butterflies, hand-brushes, one kiss that lands.',
    temperature: 0.85,
    directive:
      'Write sweet romance, heat level 1 of 4: attraction lives in nerves, glances, and almost-touches. ' +
      'Physical intimacy peaks at kissing; anything further happens behind a firmly closed door. ' +
      'Emotional vulnerability is the real event of every scene.',
  },
  {
    id: 'heat-2-simmer',
    name: 'Heat 🌶🌶 Simmer',
    description: 'Door ajar. Sensory desire, interrupted moments, ache.',
    temperature: 0.9,
    directive:
      'Write simmering romance, heat level 2 of 4: desire is explicit in the characters\' bodies and thoughts — heat, breath, the catalog of small details wanting makes. ' +
      'Intimate scenes begin on the page and fade artfully at the threshold. Interruption and denial are your best instruments; the ache matters more than the act.',
  },
  {
    id: 'heat-3-steam',
    name: 'Heat 🌶🌶🌶 Steam',
    description: 'Open door. On-page intimacy, emotionally grounded.',
    temperature: 0.9,
    directive:
      'Write steamy adult romance, heat level 3 of 4: intimate scenes play out on the page, sensual and unhurried, rendered through emotion and sensation in the manuscript\'s literary voice. ' +
      'Enthusiastic consent is textual and part of the charge. Every intimate beat must change something between the characters — no scene is only physical.',
  },
  {
    id: 'heat-4-scorch',
    name: 'Heat 🌶🌶🌶🌶 Scorch',
    description: 'Frank adult heat — still literary, still character-first.',
    temperature: 0.95,
    directive:
      'Write high-heat adult romance, level 4 of 4: intimacy on the page with frank, unblushing sensuality, in the manuscript\'s voice — literary, never crude for its own sake. ' +
      'Consent is enthusiastic and explicit. Power, trust, and vulnerability are the true subjects; the body is how the characters finally tell each other the truth. ' +
      'Interiority stays switched on throughout — desire narrated from inside, not observed like choreography.',
  },
]

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
