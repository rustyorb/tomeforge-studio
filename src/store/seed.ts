import type { Project, StyleProfile } from '../types'
import { uid } from '../lib/id'

/** Demo project so the app breathes on first launch. */
export function seedProject(): Project {
  const now = Date.now()
  return {
    id: 'seed-drowned-observatory',
    name: 'The Drowned Observatory',
    genre: 'Dark Fantasy',
    logline:
      'A cartographer with a half-burned map leads a doomed expedition to an observatory sunk beneath a lake that remembers being a kingdom.',
    createdAt: now,
    updatedAt: now,
    chapters: [
      {
        id: uid(),
        title: 'Chapter 1 — The Lake That Lies',
        scenes: [
          {
            id: uid(),
            title: 'Arrival at Lake Veyr',
            content:
              'They reached Lake Veyr at dusk, when the water was the color of an old bruise and twice as tender. Mara kept the map folded against her ribs, beneath two shirts and a lie.\n\n"It\'s smaller than the songs say," Corvin said, in the tone of a man determined to be disappointed before the world could disappoint him first.\n\n"The songs were written by people who never had to row across it." Mara crouched at the shoreline. The stones there were wrong — fitted, worked, mortared. A road ran down into the dark water and did not stop being a road just because it drowned.\n\nSomewhere beneath them, under a hundred years of cold and silence, the observatory was still counting stars it could no longer see.',
          },
        ],
      },
    ],
    memory:
      'The party is searching for the drowned observatory beneath Lake Veyr. Mara secretly knows the map is incomplete — its final third burned away and she has been improvising. Current chapter goal: cross the lake and find the sunken stair. Tone: tense, intimate, mythic. Do NOT reveal the identity of the Hollow King yet.',
    authorNote:
      '[Style: dark fantasy, slow pace, sensory detail, restrained dialogue, 19th-century cadence, rising dread]',
    canonMode: 'guided',
    codex: [
      {
        id: uid(),
        name: 'Lake Veyr',
        type: 'location',
        aliases: ['the lake', 'Veyr'],
        content:
          'A cold mountain lake covering the drowned kingdom of Veyr. The old royal road runs visibly into its waters. Locals refuse to fish its center. On windless nights, bells are heard from below.',
        alwaysInclude: true,
        updatedAt: now,
      },
      {
        id: uid(),
        name: 'Mara Quill',
        type: 'character',
        aliases: ['Mara'],
        content:
          'Expedition cartographer, early thirties, grey-eyed, burn scars on her left hand. Carries the only surviving map to the observatory — and knows its final third is missing. Precise, guarded, allergic to being rescued.',
        alwaysInclude: true,
        updatedAt: now,
      },
      {
        id: uid(),
        name: 'The Hollow King',
        type: 'secret',
        aliases: ['the king below'],
        content:
          'SECRET — identity must not be revealed yet. The entity the observatory was built to watch. Referenced only in fragments: an empty crown, a throne of waterlogged astrolabes.',
        alwaysInclude: false,
        updatedAt: now,
      },
      {
        id: uid(),
        name: 'The Observatory of Veyr',
        type: 'artifact',
        aliases: ['the observatory', 'drowned observatory'],
        content:
          'A royal star-chamber built to chart "the lights that move against the current of heaven." Sunk with the kingdom a century ago. Its brass orrery is said to still turn.',
        alwaysInclude: false,
        updatedAt: now,
      },
    ],
    characters: [
      {
        id: uid(),
        name: 'Mara Quill',
        location: 'Lake Veyr, northern shore',
        goal: 'Find the sunken stair before the others learn the map is incomplete',
        secrets: 'The final third of the map burned; she has been improvising the route',
        injuries: 'Old burn scars, left hand — stiff in cold weather',
        relationships: 'Distrusts Corvin; owes an unnamed debt to the expedition patron',
        emotionalState: 'Controlled dread',
        arcStage: 'Reluctant deceiver → will be forced to confess',
        lastAppearance: 'Ch. 1, arrival at the shore',
        voiceNotes: 'Dry, clipped, deflects with precision. Never exclaims.',
        forbidden: 'Never asks for help directly. Never cries in front of others.',
      },
      {
        id: uid(),
        name: 'Corvin Ashe',
        location: 'Lake Veyr, northern shore',
        goal: 'Return alive and paid; secretly, to see the orrery turn',
        secrets: 'Grew up in a village drowned by the same flood',
        injuries: 'None yet',
        relationships: 'Needles Mara; respects her more than he shows',
        emotionalState: 'Performative cynicism over real fear',
        arcStage: 'Cynic → believer',
        lastAppearance: 'Ch. 1, arrival at the shore',
        voiceNotes: 'Sardonic, superstitious under pressure, gallows humor',
        forbidden: 'Never admits fear in daylight.',
      },
    ],
    threads: [
      {
        id: uid(),
        title: 'The map is incomplete',
        kind: 'secret',
        setup: 'Mara conceals that the final third of the map burned away.',
        chapterIntroduced: 'Ch. 1',
        status: 'open',
        payoffNotes: 'Confession should come at the worst possible moment — mid-descent.',
      },
      {
        id: uid(),
        title: 'Bells heard from below',
        kind: 'clue',
        setup: 'Locals report bells from the lake on windless nights.',
        chapterIntroduced: 'Ch. 1',
        status: 'open',
        payoffNotes: 'The bells are the observatory\'s hour-chimes — someone is winding them.',
      },
    ],
    timeline: [
      {
        id: uid(),
        title: 'The Drowning of Veyr',
        when: 'One century before the story',
        location: 'Kingdom of Veyr',
        characters: 'The Hollow King (unnamed)',
        chapterRef: 'Backstory',
        notes: 'The kingdom sank in a single night. The observatory kept counting.',
        order: 0,
      },
      {
        id: uid(),
        title: 'Expedition reaches Lake Veyr',
        when: 'Day 12 of the expedition, dusk',
        location: 'Northern shore, Lake Veyr',
        characters: 'Mara, Corvin',
        chapterRef: 'Ch. 1',
        notes: 'The drowned road is found running into the water.',
        order: 1,
      },
    ],
    notes: '',
    styleProfileId: 'style-dark-literary',
    presetId: 'slow-burn',
    quest: null,
    branches: [],
  }
}

export function seedStyleProfiles(): StyleProfile[] {
  return [
    {
      id: 'style-dark-literary',
      name: 'Dark Literary Fantasy',
      description:
        'Dense but readable prose. Slow dread. Sensory description. Limited exposition. Dialogue carries subtext. Avoid modern slang.',
      controls: {
        proseDensity: 7, vocabulary: 7, dialogueFrequency: 4, interiorMonologue: 6,
        humor: 2, darkness: 8, romance: 2, violence: 4, surrealism: 4,
        pacing: 'slow-burn',
      },
      povLock: 'third person limited (Mara)',
      tenseLock: 'past tense',
      voiceNotes: '19th-century cadence, restrained dialogue, rising dread.',
    },
    {
      id: 'style-fast-ya',
      name: 'Fast YA Adventure',
      description:
        'Clear prose. Strong momentum. Witty dialogue. Short chapters. Emotional clarity. Frequent cliffhangers.',
      controls: {
        proseDensity: 3, vocabulary: 4, dialogueFrequency: 7, interiorMonologue: 5,
        humor: 6, darkness: 3, romance: 4, violence: 3, surrealism: 2,
        pacing: 'fast',
      },
      povLock: '',
      tenseLock: '',
      voiceNotes: 'End scenes on hooks. Keep paragraphs short.',
    },
    {
      id: 'style-noir',
      name: 'Noir Detective',
      description:
        'First person past tense. Cynical but poetic narration. Urban decay. Dry humor. Moral ambiguity. Sharp dialogue.',
      controls: {
        proseDensity: 5, vocabulary: 6, dialogueFrequency: 6, interiorMonologue: 7,
        humor: 5, darkness: 7, romance: 3, violence: 5, surrealism: 1,
        pacing: 'balanced',
      },
      povLock: 'first person',
      tenseLock: 'past tense',
      voiceNotes: 'Similes with teeth. Rain is a character.',
    },
  ]
}
