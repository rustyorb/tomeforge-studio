// Card Forge — export Cast Ledger characters as SillyTavern-compatible
// chara_card_v2 / v3 files: raw .json, or a generated .png cover with the
// card data embedded in 'chara' (v2) and 'ccv3' (v3) tEXt chunks.

import type { CharacterCard, Project, STCardStored, STEntry } from '../../types'

// ---------- card data assembly ----------

export interface CardDraft {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  tags: string[]
}

const LORE_TYPES = new Set([
  'location', 'faction', 'species', 'magic', 'technology', 'religion',
  'artifact', 'language', 'event', 'prophecy', 'law', 'rule',
])

/** Prefill a card draft from the Cast Ledger + Codex. All fields editable before export. */
export function draftFromCharacter(project: Project, ch: CharacterCard): CardDraft {
  const codexEntry = project.codex.find(
    (e) => e.type === 'character' && e.name.toLowerCase() === ch.name.toLowerCase(),
  )
  const sheet = [
    ch.relationships && `Relationships: ${ch.relationships}`,
    ch.secrets && `Secrets: ${ch.secrets}`,
    ch.arcStage && `Arc: ${ch.arcStage}`,
    ch.goal && `Current goal: ${ch.goal}`,
    ch.forbidden && `Would never: ${ch.forbidden}`,
  ].filter(Boolean)
  return {
    name: ch.name,
    description: [codexEntry?.content.trim(), sheet.join('\n')].filter(Boolean).join('\n\n'),
    personality: [ch.voiceNotes, ch.emotionalState && `Currently: ${ch.emotionalState}`]
      .filter(Boolean)
      .join('\n'),
    scenario: [project.logline, project.memory.slice(0, 400)].filter(Boolean).join('\n'),
    first_mes: `*${ch.name} looks up as you approach${ch.location ? `, here in ${ch.location}` : ''}.*\n\n"Well. I wondered when you'd find me."`,
    mes_example: '',
    tags: [project.genre, 'tomeforge'].filter(Boolean),
  }
}

interface SpecBookEntry {
  keys: string[]
  content: string
  extensions: Record<string, never>
  enabled: boolean
  insertion_order: number
  name: string
  constant: boolean
  selective?: boolean
  secondary_keys?: string[]
}

function specBook(name: string, entries: SpecBookEntry[]) {
  return entries.length ? { name, extensions: {}, entries } : undefined
}

/** World lore that should travel with the card, as a spec character_book. */
function characterBook(project: Project, cardName: string) {
  const entries: SpecBookEntry[] = project.codex
    .filter(
      (e) =>
        e.name.toLowerCase() !== cardName.toLowerCase() &&
        (e.alwaysInclude || LORE_TYPES.has(e.type)) &&
        e.content.trim(),
    )
    .slice(0, 25)
    .map((e, i) => ({
      keys: [e.name, ...e.aliases].slice(0, 8),
      content: e.content.trim(),
      extensions: {},
      enabled: true,
      insertion_order: i,
      name: e.name,
      constant: e.alwaysInclude,
      selective: !!e.secondaryKeys?.length,
      secondary_keys: e.secondaryKeys?.length ? e.secondaryKeys : undefined,
    }))
  return specBook(`${project.name} — world lore`, entries)
}

function bookFromEntries(name: string, entries: STEntry[]) {
  return specBook(
    name,
    entries.map((e, i) => ({
      keys: e.keys.slice(0, 10),
      content: e.content,
      extensions: {},
      enabled: true,
      insertion_order: i,
      name: e.name,
      constant: e.constant,
      selective: !!e.secondaryKeys?.length,
      secondary_keys: e.secondaryKeys?.length ? e.secondaryKeys : undefined,
    })),
  )
}

interface CardMeta {
  creator_notes: string
  system_prompt: string
  post_history_instructions: string
  alternate_greetings: string[]
  creator: string
}

function assembleData(
  draft: CardDraft,
  meta: CardMeta,
  book: ReturnType<typeof specBook>,
) {
  return {
    name: draft.name,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    first_mes: draft.first_mes,
    mes_example: draft.mes_example,
    creator_notes: meta.creator_notes,
    system_prompt: meta.system_prompt,
    post_history_instructions: meta.post_history_instructions,
    alternate_greetings: meta.alternate_greetings,
    character_book: book,
    tags: draft.tags,
    creator: meta.creator,
    character_version: '1.0',
    extensions: {},
  }
}

function cardData(project: Project, draft: CardDraft) {
  return assembleData(
    draft,
    {
      creator_notes: `Forged in TomeForge Studio from the tome "${project.name}".`,
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      creator: 'TomeForge Studio',
    },
    characterBook(project, draft.name),
  )
}

/** Library items export with full round-trip fidelity — nothing imported is lost. */
function libraryData(card: STCardStored) {
  return assembleData(
    {
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.firstMes ?? '',
      mes_example: card.mesExample,
      tags: card.tags,
    },
    {
      creator_notes: card.creatorNotes ?? '',
      system_prompt: card.systemPrompt ?? '',
      post_history_instructions: card.postHistory ?? '',
      alternate_greetings: card.alternateGreetings ?? [],
      creator: card.creator || 'TomeForge Studio',
    },
    bookFromEntries(`${card.name} — lorebook`, card.book),
  )
}

export function libraryToV2Json(card: STCardStored): string {
  return JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: libraryData(card) }, null, 2)
}

export function libraryToV3Json(card: STCardStored): string {
  return JSON.stringify(
    {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        ...libraryData(card),
        nickname: '',
        creator_notes_multilingual: {},
        source: ['tomeforge-studio'],
        group_only_greetings: [],
        creation_date: Math.floor(Date.now() / 1000),
        modification_date: Math.floor(Date.now() / 1000),
      },
    },
    null,
    2,
  )
}

export async function libraryCardPng(card: STCardStored): Promise<Blob> {
  const base = await coverPng(card.name)
  const withData = embedInPng(base, [
    { keyword: 'chara', json: libraryToV2Json(card) },
    { keyword: 'ccv3', json: libraryToV3Json(card) },
  ])
  const buf = new ArrayBuffer(withData.length)
  new Uint8Array(buf).set(withData)
  return new Blob([buf], { type: 'image/png' })
}

export function toV2Json(project: Project, draft: CardDraft): string {
  return JSON.stringify(
    { spec: 'chara_card_v2', spec_version: '2.0', data: cardData(project, draft) },
    null,
    2,
  )
}

export function toV3Json(project: Project, draft: CardDraft): string {
  return JSON.stringify(
    {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        ...cardData(project, draft),
        nickname: '',
        creator_notes_multilingual: {},
        source: ['tomeforge-studio'],
        group_only_greetings: [],
        creation_date: Math.floor(Date.now() / 1000),
        modification_date: Math.floor(Date.now() / 1000),
      },
    },
    null,
    2,
  )
}

// ---------- PNG embedding ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function textChunk(keyword: string, asciiText: string): Uint8Array {
  const data = new Uint8Array(keyword.length + 1 + asciiText.length)
  for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i)
  data[keyword.length] = 0
  for (let i = 0; i < asciiText.length; i++) data[keyword.length + 1 + i] = asciiText.charCodeAt(i)

  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set([0x74, 0x45, 0x58, 0x74], 4) // 'tEXt'
  chunk.set(data, 8)
  const crcInput = chunk.subarray(4, 8 + data.length)
  view.setUint32(8 + data.length, crc32(crcInput))
  return chunk
}

/** Insert tEXt chunks (keyword + base64 payload) into a PNG before IEND. */
export function embedInPng(png: Uint8Array, payloads: { keyword: string; json: string }[]): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let off = 8
  let iendOffset = -1
  while (off + 12 <= png.length) {
    const len = view.getUint32(off)
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7])
    if (type === 'IEND') {
      iendOffset = off
      break
    }
    off += 12 + len
  }
  if (iendOffset < 0) throw new Error('Malformed PNG (no IEND chunk).')

  const chunks = payloads.map((p) => {
    const utf8 = new TextEncoder().encode(p.json)
    let bin = ''
    for (let i = 0; i < utf8.length; i += 8192) {
      bin += String.fromCharCode(...utf8.subarray(i, i + 8192))
    }
    return textChunk(p.keyword, btoa(bin))
  })
  const extra = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(png.length + extra)
  out.set(png.subarray(0, iendOffset), 0)
  let at = iendOffset
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  out.set(png.subarray(iendOffset), at)
  return out
}

// ---------- generated cover ----------

const COVER_PALETTE = ['#e0763a', '#c9a35c', '#6fae9b', '#a34434', '#5b6ee1', '#9a5b8f']

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** Paint a 400×600 card cover (gradient + initial + name) and return PNG bytes. */
export async function coverPng(name: string): Promise<Uint8Array> {
  const W = 400
  const H = 600
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const h = hash(name || 'card')
  const c1 = COVER_PALETTE[h % COVER_PALETTE.length]
  const c2 = COVER_PALETTE[(h >> 3) % COVER_PALETTE.length === h % COVER_PALETTE.length
    ? ((h >> 3) + 1) % COVER_PALETTE.length
    : (h >> 3) % COVER_PALETTE.length]

  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, '#14110e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W * 0.7, H * 0.25, 20, W * 0.7, H * 0.25, 320)
  glow.addColorStop(0, c2 + 'cc')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(233, 224, 205, 0.16)'
  ctx.font = '300 300px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((name[0] ?? '?').toUpperCase(), W / 2, H / 2 - 20)

  ctx.fillStyle = 'rgba(233, 224, 205, 0.92)'
  ctx.font = '600 30px Georgia, serif'
  const display = name.length > 20 ? name.slice(0, 19) + '…' : name
  ctx.fillText(display, W / 2, H - 70)
  ctx.fillStyle = 'rgba(233, 224, 205, 0.45)'
  ctx.font = '13px monospace'
  ctx.fillText('· TOMEFORGE STUDIO ·', W / 2, H - 36)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card cover.')
  return new Uint8Array(await blob.arrayBuffer())
}

/** Full pipeline: cover + embedded v2 ('chara') and v3 ('ccv3') data. */
export async function characterCardPng(project: Project, draft: CardDraft): Promise<Blob> {
  const base = await coverPng(draft.name)
  const withData = embedInPng(base, [
    { keyword: 'chara', json: toV2Json(project, draft) },
    { keyword: 'ccv3', json: toV3Json(project, draft) },
  ])
  // Copy into a fresh ArrayBuffer so TS accepts it as a BlobPart.
  const buf = new ArrayBuffer(withData.length)
  new Uint8Array(buf).set(withData)
  return new Blob([buf], { type: 'image/png' })
}
