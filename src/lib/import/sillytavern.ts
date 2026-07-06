// SillyTavern / Character Card importer.
// Supports: chara_card_v2, chara_card_v3, legacy v1 flat JSON — as raw .json
// or embedded in .png tEXt chunks ('chara' = v2/v1, 'ccv3' = v3) — plus
// lorebooks in both the spec character_book shape (entries: []) and the
// SillyTavern world-info shape (entries: {id: {...}}).

export interface STBookEntry {
  name: string
  keys: string[]
  content: string
  constant: boolean
}

export interface STCard {
  kind: 'card'
  name: string
  description: string
  personality: string
  scenario: string
  firstMes: string
  mesExample: string
  creatorNotes: string
  tags: string[]
  book: STBookEntry[]
}

export interface STLorebook {
  kind: 'lorebook'
  name: string
  entries: STBookEntry[]
}

export type STImport = STCard | STLorebook

// ---------- PNG tEXt extraction ----------

/** Read base64 payload of a tEXt chunk with the given keyword, or null. */
function pngTextChunk(bytes: Uint8Array, keyword: string): string | null {
  // PNG signature is 8 bytes; chunks: len(4 BE) type(4) data(len) crc(4).
  if (bytes.length < 16 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let off = 8
  while (off + 12 <= bytes.length) {
    const len = view.getUint32(off)
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7])
    if (type === 'tEXt') {
      const data = bytes.subarray(off + 8, off + 8 + len)
      const nul = data.indexOf(0)
      if (nul > 0) {
        const kw = String.fromCharCode(...data.subarray(0, nul))
        if (kw === keyword) {
          let b64 = ''
          const payload = data.subarray(nul + 1)
          // Chunked to avoid arg-length limits on big cards.
          for (let i = 0; i < payload.length; i += 8192) {
            b64 += String.fromCharCode(...payload.subarray(i, i + 8192))
          }
          return b64
        }
      }
    }
    if (type === 'IEND') break
    off += 12 + len
  }
  return null
}

function decodeBase64Json(b64: string): unknown {
  const bin = atob(b64.trim())
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(bytes))
}

// ---------- normalizers ----------

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function normalizeBookEntries(raw: unknown): STBookEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const container = raw as Record<string, unknown>
  const entriesRaw = container.entries ?? raw
  const list: Record<string, unknown>[] = Array.isArray(entriesRaw)
    ? (entriesRaw as Record<string, unknown>[])
    : typeof entriesRaw === 'object' && entriesRaw !== null
      ? Object.values(entriesRaw as Record<string, unknown>).filter(
          (e): e is Record<string, unknown> => typeof e === 'object' && e !== null,
        )
      : []

  const out: STBookEntry[] = []
  for (const e of list) {
    if (e.enabled === false || e.disable === true) continue
    // spec: keys[]; ST world info: key[] (+ keysecondary)
    const keys = [
      ...(Array.isArray(e.keys) ? e.keys : []),
      ...(Array.isArray(e.key) ? e.key : []),
    ].filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    const content = str(e.content)
    if (!content.trim()) continue
    out.push({
      name: str(e.name) || str(e.comment) || keys[0] || 'Imported entry',
      keys,
      content,
      constant: e.constant === true,
    })
  }
  return out
}

function normalizeCard(data: Record<string, unknown>): STCard {
  return {
    kind: 'card',
    name: str(data.name) || str(data.nickname) || 'Unnamed character',
    description: str(data.description),
    personality: str(data.personality),
    scenario: str(data.scenario),
    firstMes: str(data.first_mes),
    mesExample: str(data.mes_example),
    creatorNotes: str(data.creator_notes),
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [],
    book: normalizeBookEntries(data.character_book),
  }
}

function parseJsonObject(obj: unknown): STImport {
  if (!obj || typeof obj !== 'object') throw new Error('Not a JSON object.')
  const o = obj as Record<string, unknown>

  // chara_card_v2 / v3 wrapper
  if (
    (o.spec === 'chara_card_v2' || o.spec === 'chara_card_v3') &&
    o.data && typeof o.data === 'object'
  ) {
    return normalizeCard(o.data as Record<string, unknown>)
  }
  // Legacy v1 flat card: has name + description-ish fields
  if (typeof o.name === 'string' && ('description' in o || 'personality' in o || 'first_mes' in o)) {
    return normalizeCard(o)
  }
  // Lorebook / world info: has entries
  if ('entries' in o) {
    const entries = normalizeBookEntries(o)
    if (!entries.length) throw new Error('Lorebook has no enabled entries with content.')
    return { kind: 'lorebook', name: str(o.name) || 'Imported lorebook', entries }
  }
  throw new Error(
    'Unrecognized format — expected a chara_card_v2/v3 card, a legacy character JSON, or a lorebook with entries.',
  )
}

// ---------- entry point ----------

/** Parse a SillyTavern .json or card .png file into a normalized import. */
export async function parseSillyTavernFile(file: File): Promise<STImport> {
  if (/\.png$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const b64 = pngTextChunk(bytes, 'ccv3') ?? pngTextChunk(bytes, 'chara')
    if (!b64) {
      throw new Error(
        `${file.name}: no embedded character data found (missing 'chara'/'ccv3' PNG chunk).`,
      )
    }
    return parseJsonObject(decodeBase64Json(b64))
  }
  try {
    return parseJsonObject(JSON.parse(await file.text()))
  } catch (e) {
    throw new Error(`${file.name}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
