import { useRef, useState } from 'react'
import { useSettings } from '../../store/useSettings'
import { streamMessage } from '../../lib/ai'
import { comfySubmit, normalizeBase } from '../../lib/imageGen'
import { looseJson } from '../../lib/looseJson'
import { downloadText } from '../../lib/export/download'
import { ErrorBanner, Field } from '../../components/ui'
import {
  digestCatalog, exoticNodesUsed, fetchCatalog, sampleExotics, schemasFor, validateGraph,
} from './catalog'
import type { Catalog, Graph, ValidationIssue } from './catalog'

const RULES = `You build ComfyUI workflows in API format: a single JSON object where each key is a
node id string ("1", "2", …) and each value is {"class_type": "...", "inputs": {...}}.
RULES:
- Use ONLY class_types from the catalog below, with their exact input names.
- Link an input to another node's output as [<node_id_string>, <output_index_number>].
- Every ENUM input must use one of its listed legal values VERBATIM (checkpoints, samplers, etc.).
- Numeric inputs get sensible values (steps 20-30, cfg 5-8, denoise 1.0 for txt2img).
- Seeds: any integer.
- The graph MUST end in a SaveImage node fed by a VAEDecode.
- Keep it as simple as the request allows; do not invent nodes for features not requested.
Respond with ONLY a fenced \`\`\`json block containing the workflow object — no commentary.`

type Stage = 'idle' | 'catalog' | 'generating' | 'repairing' | 'running'

export default function WorkflowForgePage() {
  const comfyUrl = useSettings((s) => s.comfyUrl)
  const setImageGen = useSettings((s) => s.setImageGen)

  const [request, setRequest] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [repaired, setRepaired] = useState(false)
  const [resultImg, setResultImg] = useState<string | null>(null)
  const [runSecs, setRunSecs] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const catalogRef = useRef<Catalog | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const busy = stage !== 'idle'

  const askModel = async (
    digest: string,
    userContent: string,
    signal: AbortSignal,
  ): Promise<Graph | null> => {
    const full = await streamMessage({
      system: `${RULES}\n\n${digest}`,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.3,
      maxTokens: 4000,
      signal,
    })
    const parsed = looseJson(full)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Graph)
      : null
  }

  const forge = async (surprise = false) => {
    if ((!surprise && !request.trim()) || busy) return
    setError(null)
    setGraph(null)
    setIssues([])
    setRepaired(false)
    setResultImg(null)
    setNotice(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      // 1. Ground in the live server's catalog.
      setStage('catalog')
      if (!catalogRef.current) {
        catalogRef.current = await fetchCatalog(normalizeBase(comfyUrl))
      }
      const catalog = catalogRef.current
      let digest = digestCatalog(catalog)
      let ask = `Build this workflow: ${request.trim()}`

      // Surprise mode: dig 8 random exotic nodes out of the hoard, hand the
      // model their full schemas, and demand it actually uses one.
      if (surprise) {
        const exotics = sampleExotics(catalog, 8)
        digest +=
          '\n\nEXOTIC NODES (full schemas — the user owns these but has never used them):\n' +
          schemasFor(catalog, exotics)
        ask =
          `Build an interesting, working txt2img workflow that MEANINGFULLY uses at least one ` +
          `of these exotic nodes: ${exotics.join(', ')}. ` +
          (request.trim() ? `Theme/request: ${request.trim()}. ` : '') +
          'Only use an exotic node in a way its schema supports; wire everything else from core nodes.'
      }

      // 2. Generate.
      setStage('generating')
      let g = await askModel(digest, ask, controller.signal)
      if (!g) throw new Error('The model returned no readable workflow — try again.')
      let problems = validateGraph(g, catalog)

      // 3. One automatic repair pass with the exact validation errors.
      if (problems.length) {
        setStage('repairing')
        const fixed = await askModel(
          digest,
          `You built this workflow:\n\`\`\`json\n${JSON.stringify(g)}\n\`\`\`\n` +
            `The server rejected it with these validation errors:\n` +
            problems.map((p) => `- [node ${p.node}] ${p.message}`).join('\n') +
            `\n\nFix every error and return the corrected complete workflow.`,
          controller.signal,
        )
        if (fixed) {
          const fixedProblems = validateGraph(fixed, catalog)
          if (fixedProblems.length < problems.length) {
            g = fixed
            problems = fixedProblems
            setRepaired(true)
          }
        }
      }

      setGraph(g)
      setIssues(problems)
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setStage('idle')
      abortRef.current = null
    }
  }

  const run = async () => {
    if (!graph || busy) return
    setError(null)
    setResultImg(null)
    setNotice(null)
    const controller = new AbortController()
    abortRef.current = controller
    setStage('running')
    const t0 = Date.now()
    try {
      const url = await comfySubmit(normalizeBase(comfyUrl), graph, controller.signal)
      setResultImg(url)
      setRunSecs(Math.round((Date.now() - t0) / 1000))
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setStage('idle')
      abortRef.current = null
    }
  }

  const nodeSummary = graph
    ? Object.entries(graph)
        .map(([id, n]) => `${id}:${n.class_type}`)
        .join('  ·  ')
    : ''

  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">The Rig</div>
        <h1>Workflow Forge</h1>
        <p className="sub">
          Describe what you want in plain words — good text, bad text, half a thought — and the
          forge builds a working ComfyUI workflow from your server's <em>actual</em> installed
          nodes and models, validates every link and value against them, repairs itself once if
          needed, and runs live right here.
        </p>
      </header>

      <div className="card rise-1" style={{ marginBottom: 16 }}>
        <Field
          label="What should the workflow do?"
          hint="e.g. 'sdxl portrait with a lora at 0.7 then upscale 2x' — or just 'make it look cool idk'"
        >
          <textarea
            rows={3}
            value={request}
            placeholder="txt2img with DreamShaper, 768x1024, then upscale with an upscale model…"
            onChange={(e) => setRequest(e.target.value)}
          />
        </Field>
        <div className="row">
          {busy ? (
            <button className="btn danger" onClick={() => abortRef.current?.abort()}>
              ■ Stop
            </button>
          ) : (
            <>
              <button className="btn primary" disabled={!request.trim()} onClick={() => void forge()}>
                ⛭ Forge workflow
              </button>
              <button
                className="btn"
                title="Grab random exotic nodes from your collection and build something that actually uses one"
                onClick={() => void forge(true)}
              >
                🎲 Surprise me with my own nodes
              </button>
            </>
          )}
          {stage !== 'idle' && (
            <span className="mono faint">
              <span className="spinner" />{' '}
              {stage === 'catalog' && 'reading your server\'s node catalog…'}
              {stage === 'generating' && 'the model is wiring nodes…'}
              {stage === 'repairing' && 'validation failed — auto-repairing…'}
              {stage === 'running' && 'running on your GPU…'}
            </span>
          )}
        </div>
        <ErrorBanner error={error} />
      </div>

      {graph && (
        <div className="card rise-2">
          <div className="row between wrap">
            <div>
              <h3>
                {Object.keys(graph).length} nodes{' '}
                {issues.length === 0 ? (
                  <span className="tag green">✓ valid against your server</span>
                ) : (
                  <span className="tag red">{issues.length} unresolved issue{issues.length === 1 ? '' : 's'}</span>
                )}
                {repaired && <span className="tag brass" style={{ marginLeft: 6 }}>self-repaired</span>}
              </h3>
              {exoticNodesUsed(graph).length > 0 && (
                <div className="row wrap" style={{ marginTop: 6, gap: 4 }}>
                  {exoticNodesUsed(graph).map((n) => (
                    <span key={n} className="tag ember" title="A node from your collection, finally put to work">
                      🎲 {n}
                    </span>
                  ))}
                </div>
              )}
              <p className="mono faint" style={{ fontSize: 10.5, marginTop: 6, maxWidth: 640 }}>
                {nodeSummary}
              </p>
            </div>
            <div className="row wrap">
              <button className="btn primary" disabled={busy} onClick={() => void run()}>
                ▶ Run it now
              </button>
              <button
                className="btn"
                onClick={() => downloadText('forged-workflow.json', JSON.stringify(graph, null, 2), 'application/json')}
              >
                ⬇ .json
              </button>
              <button
                className="btn"
                title="Card Forge portraits will use this workflow"
                onClick={() => {
                  setImageGen({ comfyWorkflow: JSON.stringify(graph) })
                  setNotice('Card Forge portraits now use this workflow.')
                }}
              >
                ⚒ Use for portraits
              </button>
            </div>
          </div>

          {issues.length > 0 && (
            <div className="stack" style={{ marginTop: 12 }}>
              {issues.map((p, i) => (
                <div key={i} className="error-banner" style={{ margin: 0 }}>
                  [node {p.node}] {p.message}
                </div>
              ))}
              <p className="faint" style={{ fontSize: 12.5 }}>
                You can still run it — ComfyUI may tolerate some of these — or reword the request
                and forge again.
              </p>
            </div>
          )}

          {notice && <div className="tag green" style={{ marginTop: 10 }}>✓ {notice}</div>}

          {resultImg && (
            <div style={{ marginTop: 14 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>
                Live result{runSecs !== null ? ` — ${runSecs}s on your GPU` : ''}
              </div>
              <img
                src={resultImg}
                alt="Workflow result"
                style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8, border: '1px solid var(--line)' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
