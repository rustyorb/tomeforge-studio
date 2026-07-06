import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import type {
  CastWeb, CastWebEdge, CastWebNode, CastWebTone, Project, StyleProfile,
} from '../../types'
import { streamMessage, extractJsonBlock } from '../../lib/ai'
import { buildStoryContext } from '../../lib/context'
import { EmptyState, ErrorBanner, StreamView } from '../../components/ui'
import { PALETTE, hashString } from '../insights/stats'

const VIEW_W = 900
const VIEW_H = 620
const CX = VIEW_W / 2
const CY = VIEW_H / 2
const REST_LENGTH = 160

const TONES: CastWebTone[] = ['ally', 'enemy', 'family', 'romance', 'tension', 'other']

const TONE_COLORS: Record<CastWebTone, string> = {
  ally: 'var(--verdigris)',
  enemy: 'var(--blood)',
  family: 'var(--brass)',
  romance: '#c98ba4',
  tension: 'var(--ember)',
  other: 'var(--line)',
}

interface Pt {
  x: number
  y: number
}

/**
 * Deterministic force layout: seed on a circle by node index, then ~200
 * iterations of pairwise repulsion + edge springs + gentle centering.
 * Computed once per castWeb (useMemo) — no animation frames.
 */
function computeLayout(web: CastWeb): Record<string, Pt> {
  const n = web.nodes.length
  if (n === 0) return {}
  const pos: Pt[] = web.nodes.map((_, i) => {
    const angle = (i / n) * Math.PI * 2
    return { x: CX + Math.cos(angle) * 220, y: CY + Math.sin(angle) * 190 }
  })
  const index = new Map(web.nodes.map((nd, i) => [nd.id, i]))
  const springs = web.edges
    .map((e) => ({ a: index.get(e.from) ?? -1, b: index.get(e.to) ?? -1 }))
    .filter((s) => s.a >= 0 && s.b >= 0 && s.a !== s.b)

  for (let iter = 0; iter < 200; iter++) {
    const fx = new Array<number>(n).fill(0)
    const fy = new Array<number>(n).fill(0)

    // Pairwise repulsion.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x
        let dy = pos[i].y - pos[j].y
        let d2 = dx * dx + dy * dy
        if (d2 < 0.01) {
          // Coincident nodes: deterministic nudge so d is never zero.
          dx = (i - j) * 0.1
          dy = (i + 1) * 0.05
          d2 = dx * dx + dy * dy
        }
        const d = Math.sqrt(d2)
        const f = 22000 / d2
        fx[i] += (dx / d) * f
        fy[i] += (dy / d) * f
        fx[j] -= (dx / d) * f
        fy[j] -= (dy / d) * f
      }
    }

    // Spring attraction along edges toward rest length.
    for (const s of springs) {
      const dx = pos[s.b].x - pos[s.a].x
      const dy = pos[s.b].y - pos[s.a].y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = (d - REST_LENGTH) * 0.02
      fx[s.a] += (dx / d) * f
      fy[s.a] += (dy / d) * f
      fx[s.b] -= (dx / d) * f
      fy[s.b] -= (dy / d) * f
    }

    // Gentle centering pull, cooled displacement, keep inside the canvas.
    const cool = 1 - iter / 220
    for (let i = 0; i < n; i++) {
      fx[i] += (CX - pos[i].x) * 0.005
      fy[i] += (CY - pos[i].y) * 0.005
      const mag = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 1
      const step = Math.min(mag, 18 * cool)
      pos[i].x = Math.min(VIEW_W - 50, Math.max(50, pos[i].x + (fx[i] / mag) * step))
      pos[i].y = Math.min(VIEW_H - 60, Math.max(50, pos[i].y + (fy[i] / mag) * step))
    }
  }

  const out: Record<string, Pt> = {}
  web.nodes.forEach((nd, i) => {
    out[nd.id] = pos[i]
  })
  return out
}

/** Defensive validation of the model's JSON. Returns null when unusable. */
function parseWeb(raw: unknown): { nodes: CastWebNode[]; edges: CastWebEdge[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(obj.nodes)) return null

  const nodes: CastWebNode[] = []
  const seen = new Set<string>()
  for (const item of obj.nodes) {
    if (!item || typeof item !== 'object') continue
    const { id, name, group } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) continue
    if (seen.has(id)) continue
    seen.add(id)
    nodes.push({ id, name, group: typeof group === 'string' ? group : undefined })
  }
  if (!nodes.length) return null

  const edges: CastWebEdge[] = []
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : []
  for (const item of rawEdges) {
    if (!item || typeof item !== 'object') continue
    const { from, to, label, tone } = item as Record<string, unknown>
    if (typeof from !== 'string' || typeof to !== 'string') continue
    if (!seen.has(from) || !seen.has(to)) continue
    edges.push({
      from,
      to,
      label: typeof label === 'string' ? label : '',
      tone: TONES.includes(tone as CastWebTone) ? (tone as CastWebTone) : 'other',
    })
  }
  return { nodes, edges }
}

function groupColor(group: string | undefined): string {
  return PALETTE[hashString(group ?? 'other') % PALETTE.length]
}

export default function RelationWeb(props: {
  project: Project
  styleProfile: StyleProfile | null
}) {
  const { project, styleProfile } = props
  const updateProject = useStore((s) => s.updateProject)

  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Pt>>({})

  const web = project.castWeb ?? null
  const layout = useMemo(() => (web ? computeLayout(web) : {}), [web])

  // A freshly woven web resets any drag positions.
  useEffect(() => {
    setOverrides({})
    setDragId(null)
  }, [web])

  // Drag: pointermove/pointerup on window while a node is held; cleaned up
  // on release and on unmount.
  useEffect(() => {
    if (!dragId) return
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = ((e.clientX - rect.left) / rect.width) * VIEW_W
      const y = ((e.clientY - rect.top) / rect.height) * VIEW_H
      setOverrides((prev) => ({
        ...prev,
        [dragId]: {
          x: Math.min(VIEW_W - 20, Math.max(20, x)),
          y: Math.min(VIEW_H - 20, Math.max(20, y)),
        },
      }))
    }
    const onUp = () => setDragId(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragId])

  // Abort any in-flight weave on unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = () => abortRef.current?.abort()

  const weave = async () => {
    setBusy(true)
    setError(null)
    setStreamText('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const directive =
        'Analyze the Cast Ledger above and the character-type Codex entries supplied by the user. ' +
        'Map every named character and every meaningful relationship between them. ' +
        'Output ONLY a fenced ```json code block — no prose before or after — of exactly this shape: ' +
        '{"nodes":[{"id":"slug","name":"Display Name","group":"faction-or-role"}],' +
        '"edges":[{"from":"slug","to":"slug","label":"3-6 word relationship","tone":"ally|enemy|family|romance|tension|other"}]}. ' +
        'Every node id must be a short lowercase slug. Every edge from/to must reference an existing node id. ' +
        'Each label is 3-6 words. Each tone is exactly one of the six listed values.'
      const charCodex = project.codex.filter((e) => e.type === 'character')
      const codexBlock = charCodex.length
        ? 'CHARACTER CODEX ENTRIES:\n' +
          charCodex.map((e) => `• ${e.name}: ${e.content.trim()}`).join('\n')
        : '(No character-type codex entries — rely on the Cast Ledger.)'
      const full = await streamMessage({
        system: buildStoryContext(project, styleProfile, { taskDirective: directive }),
        messages: [
          {
            role: 'user',
            content: codexBlock + '\n\nWeave the relationship web now. Return only the JSON block.',
          },
        ],
        temperature: 0.4,
        signal: controller.signal,
        onDelta: (t) => setStreamText((prev) => prev + t),
      })
      const parsed = parseWeb(extractJsonBlock(full))
      if (!parsed) {
        setError('The model returned an unreadable web — try again')
        return
      }
      updateProject(project.id, (d) => {
        d.castWeb = { nodes: parsed.nodes, edges: parsed.edges, generatedAt: Date.now() }
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStreamText('')
      abortRef.current = null
    }
  }

  if (!web) {
    return (
      <div>
        <ErrorBanner error={error} />
        {busy ? (
          <div className="stack">
            <div className="row between">
              <span className="kicker">
                <span className="spinner" /> Weaving the web…
              </span>
              <button className="btn small" onClick={stop}>■ Stop</button>
            </div>
            <StreamView text={streamText} busy />
          </div>
        ) : (
          <EmptyState glyph="⟡" title="No web woven yet">
            <p style={{ marginBottom: 14 }}>
              Let the AI read the Cast Ledger and character codex, then chart every bond,
              grudge, and secret between your characters.
            </p>
            <button className="btn primary" onClick={weave}>⟡ Weave the Web</button>
          </EmptyState>
        )}
      </div>
    )
  }

  const posOf = (id: string): Pt => overrides[id] ?? layout[id] ?? { x: CX, y: CY }
  const showEdgeLabels = web.edges.length <= 14

  return (
    <div className="rise">
      <ErrorBanner error={error} />
      <div className="row between wrap" style={{ marginBottom: 10 }}>
        <span className="kicker">
          woven {new Date(web.generatedAt).toLocaleDateString()}
        </span>
        <div className="row">
          {busy && (
            <button className="btn small" onClick={stop}>■ Stop</button>
          )}
          <button className="btn small" disabled={busy} onClick={weave}>
            {busy ? <span className="spinner" /> : '⟡'} Re-weave
          </button>
        </div>
      </div>
      <div className="br-web-legend">
        {TONES.map((t) => (
          <span className="br-web-key" key={t}>
            <i style={{ background: TONE_COLORS[t] }} /> {t}
          </span>
        ))}
      </div>
      {busy && <StreamView text={streamText} busy />}
      <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="br-web-svg">
        {web.edges.map((e, i) => {
          const a = posOf(e.from)
          const b = posOf(e.to)
          const color = TONE_COLORS[e.tone ?? 'other']
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1.5} opacity={0.7}>
                {!showEdgeLabels && e.label && <title>{e.label}</title>}
              </line>
              {showEdgeLabels && e.label && (
                <text
                  className="br-web-edge-label"
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 4}
                  fill={color}
                >
                  {e.label}
                </text>
              )}
            </g>
          )
        })}
        {web.nodes.map((node) => {
          const p = posOf(node.id)
          return (
            <g
              key={node.id}
              className="br-web-node"
              transform={`translate(${p.x}, ${p.y})`}
              onPointerDown={(e) => {
                e.preventDefault()
                setDragId(node.id)
              }}
            >
              <circle r={24} fill={groupColor(node.group)} stroke="var(--ink-0)" strokeWidth={2} />
              <text className="br-web-node-letter" y={6} textAnchor="middle">
                {(node.name[0] ?? '?').toUpperCase()}
              </text>
              <text className="br-web-node-name" y={42} textAnchor="middle">
                {node.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
