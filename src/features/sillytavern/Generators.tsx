import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { STCardStored, STEntry } from '../../types'
import { uid } from '../../lib/id'
import { streamMessage } from '../../lib/ai'
import { looseJson } from '../../lib/looseJson'
import { ErrorBanner, Field } from '../../components/ui'

const str = (v: unknown, cap = 4000): string => (typeof v === 'string' ? v.slice(0, cap) : '')
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function parseEntries(raw: unknown): STEntry[] {
  if (!Array.isArray(raw)) return []
  const out: STEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const content = str(o.content)
    if (!content.trim()) continue
    const keys = strArr(o.keys)
    const secondary = strArr(o.secondaryKeys ?? o.secondary_keys)
    out.push({
      name: str(o.name, 120) || keys[0] || 'Entry',
      keys: keys.length ? keys : [str(o.name, 60)].filter(Boolean),
      content,
      constant: o.constant === true,
      secondaryKeys: secondary.length ? secondary : undefined,
    })
  }
  return out
}

const EXTRACTOR =
  'You are a structured-data generation engine for a fiction studio. Respond with ONLY a ' +
  'fenced ```json code block — no prose before or after, no commentary.\n\nTASK:\n'

/**
 * Forge original SillyTavern content from a prompt: full character cards or
 * standalone worldbooks, straight into the library — export-ready.
 */
export default function Generators() {
  const addToLibrary = useStore((s) => s.addToSTLibrary)
  const [kind, setKind] = useState<'character' | 'lorebook'>('character')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('12')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      if (kind === 'character') {
        const full = await streamMessage({
          system:
            EXTRACTOR +
            'Create ONE original roleplay character as a JSON object with exactly these keys: ' +
            '"name" (string), "description" (rich 150-300 word portrait: appearance, history, drives), ' +
            '"personality" (traits and manner, 50-120 words), "scenario" (the situation a chat opens in), ' +
            '"first_mes" (their opening message: actions in *asterisks*, dialogue in quotes, ends inviting a reply), ' +
            '"mes_example" (one short example exchange formatted as {{user}}: … / {{char}}: …), ' +
            '"tags" (array of 3-6 lowercase strings), ' +
            '"book" (array of 2-5 supporting lore entries, each {"name","keys":["…"],"content","constant":false}). ' +
            'Make them specific and surprising — no generic archetypes.',
          messages: [{ role: 'user', content: `Character concept: ${prompt.trim()}\n\nReturn the JSON object now.` }],
          temperature: 1.0,
          maxTokens: 2500,
        })
        const raw = looseJson(full)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error(`Could not read the result. Model said: "${full.trim().slice(0, 160)}…"`)
        }
        const o = raw as Record<string, unknown>
        const name = str(o.name, 100).trim()
        if (!name) throw new Error('The generated character has no name — try again.')
        const card: STCardStored = {
          id: uid(),
          kind: 'card',
          name,
          description: str(o.description),
          personality: str(o.personality),
          scenario: str(o.scenario),
          mesExample: str(o.mes_example),
          firstMes: str(o.first_mes),
          tags: strArr(o.tags).slice(0, 8),
          book: parseEntries(o.book),
          creator: 'TomeForge Studio',
          creatorNotes: `Forged from prompt: ${prompt.trim().slice(0, 140)}`,
          importedAt: Date.now(),
        }
        addToLibrary([card])
        setDone(`"${name}" forged and added to the library — edit or export whenever.`)
      } else {
        const n = Number(size)
        const full = await streamMessage({
          system:
            EXTRACTOR +
            `Create an original worldbook of exactly ${n} lore entries as a JSON array. Each element: ` +
            '{"name": "entry title", "keys": ["2-5 trigger words/phrases"], ' +
            '"secondaryKeys": [] (usually empty; use only for entries that need AND matching), ' +
            '"content": "80-160 words of concrete, usable lore", "constant": false} — ' +
            'mark at most ONE foundational entry constant:true. ' +
            'Cover breadth: places, factions, figures, customs, dangers, secrets. ' +
            'Entries must interlock — reference each other\'s names so the world feels whole.',
          messages: [{ role: 'user', content: `Worldbook concept: ${prompt.trim()}\n\nReturn the JSON array now.` }],
          temperature: 0.95,
          maxTokens: 4000,
        })
        const entries = parseEntries(looseJson(full))
        if (!entries.length) {
          throw new Error(`Could not read the result. Model said: "${full.trim().slice(0, 160)}…"`)
        }
        addToLibrary([
          {
            id: uid(),
            kind: 'lorebook',
            name: prompt.trim().slice(0, 60),
            entries,
            importedAt: Date.now(),
          },
        ])
        setDone(`Worldbook forged — ${entries.length} entries in the library, export-ready.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 15 }}>✨ Forge original ST content</h3>
      <p className="muted" style={{ fontSize: 13, maxWidth: 560, marginBottom: 10 }}>
        Generate a complete character card or a whole worldbook from one prompt. Results land
        in the library below — edit them, add them to a tome, or export straight to SillyTavern.
      </p>
      <div className="row wrap" style={{ gap: 10 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
          <label>Forge a…</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'character' | 'lorebook')}>
            <option value="character">Character card</option>
            <option value="lorebook">Worldbook</option>
          </select>
        </div>
        {kind === 'lorebook' && (
          <div className="field" style={{ marginBottom: 0, minWidth: 110 }}>
            <label>Entries</label>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              {['8', '12', '20', '30'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 260 }}>
          <label>Concept</label>
          <input
            type="text"
            value={prompt}
            placeholder={
              kind === 'character'
                ? 'a retired kraken-hunter who lies about being retired'
                : 'a rusted-out orbital station run by monastic salvage guilds'
            }
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void generate()
            }}
          />
        </div>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-end' }}
          disabled={busy || !prompt.trim()}
          onClick={() => void generate()}
        >
          {busy ? (
            <>
              <span className="spinner" /> Forging…
            </>
          ) : (
            '✨ Forge'
          )}
        </button>
      </div>
      <ErrorBanner error={error} />
      {done && <div className="tag green" style={{ marginTop: 10 }}>✓ {done}</div>}
    </div>
  )
}
