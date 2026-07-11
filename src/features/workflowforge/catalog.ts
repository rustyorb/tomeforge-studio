// The Workflow Forge's grounding layer: fetch ComfyUI's live node catalog
// (/object_info), digest it for the LLM, and validate generated graphs
// against it — so the model can only build with parts that actually exist
// on the user's server.

export interface ComfyNodeDef {
  input?: {
    required?: Record<string, unknown[]>
    optional?: Record<string, unknown[]>
  }
  output?: string[]
  description?: string
}

export type Catalog = Record<string, ComfyNodeDef>

export interface GraphNode {
  class_type?: string
  inputs?: Record<string, unknown>
}

export type Graph = Record<string, GraphNode>

export async function fetchCatalog(base: string): Promise<Catalog> {
  const res = await fetch(`${base.replace(/\/$/, '')}/object_info`)
  if (!res.ok) throw new Error(`ComfyUI /object_info error (${res.status}).`)
  return (await res.json()) as Catalog
}

/** Core nodes the LLM should reach for — full schemas included in the digest. */
const CORE_NODES = [
  'CheckpointLoaderSimple', 'CLIPTextEncode', 'CLIPTextEncodeSDXL', 'KSampler',
  'KSamplerAdvanced', 'EmptyLatentImage', 'VAEDecode', 'VAEEncode', 'SaveImage',
  'LoraLoader', 'LoraLoaderModelOnly', 'LoadImage', 'ImageScale', 'ImageScaleBy',
  'LatentUpscale', 'LatentUpscaleBy', 'CLIPSetLastLayer', 'VAELoader',
  'UpscaleModelLoader', 'ImageUpscaleWithModel', 'ControlNetLoader',
  'ControlNetApplyAdvanced', 'ImageInvert', 'PreviewImage', 'FreeU_V2',
]

function typeLabel(def: unknown[]): string {
  const t = def[0]
  if (Array.isArray(t)) {
    // Combo/enum: show up to 24 legal values
    const vals = t.filter((v): v is string => typeof v === 'string')
    const shown = vals.slice(0, 24).join(' | ')
    return `ENUM(${shown}${vals.length > 24 ? ` | …${vals.length - 24} more` : ''})`
  }
  const cfg = def[1]
  const extra =
    cfg && typeof cfg === 'object' && 'default' in (cfg as object)
      ? `=${JSON.stringify((cfg as { default: unknown }).default)}`
      : ''
  return `${String(t)}${extra}`
}

/** Compact, LLM-readable digest of what this server can actually do. */
export function digestCatalog(catalog: Catalog): string {
  const lines: string[] = []
  for (const name of CORE_NODES) {
    const def = catalog[name]
    if (!def) continue
    const req = Object.entries(def.input?.required ?? {})
      .map(([k, v]) => `${k}: ${typeLabel(v as unknown[])}`)
      .join(', ')
    const opt = Object.keys(def.input?.optional ?? {}).join(', ')
    lines.push(
      `${name}(${req}${opt ? ` | optional: ${opt}` : ''}) -> [${(def.output ?? []).join(', ')}]`,
    )
  }
  const others = Object.keys(catalog)
    .filter((n) => !CORE_NODES.includes(n))
    .slice(0, 400)
  return (
    'CORE NODES (exact schemas from the live server — prefer these):\n' +
    lines.join('\n') +
    '\n\nOTHER AVAILABLE NODE class_types (names only — use only if truly needed):\n' +
    others.join(', ')
  )
}

export interface ValidationIssue {
  node: string
  message: string
}

/** Validate a generated API-format graph against the live catalog. */
export function validateGraph(graph: Graph, catalog: Catalog): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const ids = new Set(Object.keys(graph))
  let hasSave = false

  for (const [id, node] of Object.entries(graph)) {
    const ct = node?.class_type
    if (!ct || typeof ct !== 'string') {
      issues.push({ node: id, message: 'missing class_type' })
      continue
    }
    const def = catalog[ct]
    if (!def) {
      issues.push({ node: id, message: `unknown node type "${ct}" — not installed on this server` })
      continue
    }
    if (ct.includes('SaveImage')) hasSave = true
    const inputs = node.inputs ?? {}
    for (const [inputName, inputDef] of Object.entries(def.input?.required ?? {})) {
      const val = inputs[inputName]
      if (val === undefined) {
        issues.push({ node: id, message: `${ct}: required input "${inputName}" is missing` })
        continue
      }
      if (Array.isArray(val)) {
        // Link: [nodeId, outputIndex]
        const [ref, idx] = val as [unknown, unknown]
        if (typeof ref !== 'string' || !ids.has(ref)) {
          issues.push({ node: id, message: `${ct}.${inputName}: links to missing node "${String(ref)}"` })
        } else {
          const outs = catalog[graph[ref]?.class_type ?? '']?.output ?? []
          if (typeof idx !== 'number' || idx >= outs.length) {
            issues.push({
              node: id,
              message: `${ct}.${inputName}: node "${ref}" has no output index ${String(idx)} (outputs: ${outs.join(', ') || 'none'})`,
            })
          }
        }
      } else {
        // Value: check enums
        const enumVals = Array.isArray((inputDef as unknown[])[0])
          ? ((inputDef as unknown[])[0] as unknown[]).filter((v): v is string => typeof v === 'string')
          : null
        if (enumVals && enumVals.length && !enumVals.includes(String(val))) {
          issues.push({
            node: id,
            message: `${ct}.${inputName}: "${String(val)}" is not available. Choose one of: ${enumVals.slice(0, 6).join(', ')}${enumVals.length > 6 ? ', …' : ''}`,
          })
        }
      }
    }
  }
  if (!hasSave) {
    issues.push({ node: '-', message: 'graph has no SaveImage node — nothing would be output' })
  }
  return issues
}
