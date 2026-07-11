// Local image generation — bring your own GPU. Two backends:
//   • Automatic1111 (webui --api):    POST /sdapi/v1/txt2img
//   • ComfyUI:                        POST /prompt + poll /history, fetch /view
// Both must allow browser CORS (see the hints in Settings).

import { useSettings } from '../store/useSettings'

export interface ImageRequest {
  prompt: string
  negative?: string
  signal?: AbortSignal
}

function parseSize(size: string): { width: number; height: number } {
  const m = size.match(/^(\d+)x(\d+)$/)
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 512, height: 768 }
}

const DEFAULT_NEGATIVE =
  'lowres, bad anatomy, bad hands, text, watermark, signature, blurry, deformed'

// ---------- Automatic1111 ----------

async function a1111Txt2Img(req: ImageRequest): Promise<string> {
  const { a1111Url, imageSize } = useSettings.getState()
  const { width, height } = parseSize(imageSize)
  let res: Response
  try {
    res = await fetch(`${a1111Url.replace(/\/$/, '')}/sdapi/v1/txt2img`, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: req.prompt,
        negative_prompt: req.negative ?? DEFAULT_NEGATIVE,
        steps: 24,
        width,
        height,
        cfg_scale: 7,
        sampler_name: 'Euler a',
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new Error(
      `Could not reach Automatic1111 at ${a1111Url}. Is it running with --api --cors-allow-origins?`,
    )
  }
  if (!res.ok) throw new Error(`Automatic1111 error (${res.status}): ${res.statusText}`)
  const body = (await res.json()) as { images?: string[] }
  const b64 = body.images?.[0]
  if (!b64) throw new Error('Automatic1111 returned no image.')
  return `data:image/png;base64,${b64}`
}

// ---------- ComfyUI ----------

/** Same-origin proxy paths answer with the SPA's HTML when the proxy isn't
 *  active yet (dev server started before vite.config gained the route). */
function guardHtml(res: Response, base: string): void {
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(
      `"${base}" answered with a web page, not the backend. If it's a '/comfy' or '/a1111' ` +
        'proxy path, restart the dev server (stop.bat / start.bat) to activate the proxy — or ' +
        'use an absolute URL like http://127.0.0.1:8188 in Settings.',
    )
  }
}

async function comfyGetCheckpoint(base: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${base}/object_info/CheckpointLoaderSimple`, { signal })
  if (!res.ok) throw new Error(`ComfyUI object_info error (${res.status}).`)
  guardHtml(res, base)
  const info = (await res.json()) as Record<
    string,
    { input?: { required?: { ckpt_name?: unknown[][] } } }
  >
  const raw = info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]
  const names = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
  if (!names.length) {
    throw new Error('ComfyUI has no checkpoints available (CheckpointLoaderSimple is empty).')
  }
  const wanted = useSettings.getState().comfyCheckpoint.trim()
  if (wanted) {
    const hit = names.find((n) => n.toLowerCase() === wanted.toLowerCase())
      ?? names.find((n) => n.toLowerCase().includes(wanted.toLowerCase()))
    if (hit) return hit
    throw new Error(
      `Checkpoint "${wanted}" not found on ComfyUI. Available: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', …' : ''}`,
    )
  }
  return names[0]
}

function comfyWorkflow(
  ckpt: string,
  prompt: string,
  negative: string,
  width: number,
  height: number,
  seed: number,
) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: 24,
        cfg: 7,
        sampler_name: 'euler_ancestral',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'tomeforge' } },
  }
}

interface ComfyNode {
  class_type?: string
  inputs?: Record<string, unknown>
}

/**
 * Inject prompt/negative/seed into a user-supplied API-format workflow.
 * The workflow's own models, steps, and resolution are left untouched —
 * it is the source of truth; we only speak into its text slots.
 */
function injectWorkflow(
  graph: Record<string, ComfyNode>,
  prompt: string,
  negative: string,
): Record<string, ComfyNode> {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const setText = (ref: unknown, text: string) => {
    if (!Array.isArray(ref) || typeof ref[0] !== 'string') return
    const enc = graph[ref[0]]
    if (!enc?.inputs) return
    if (typeof enc.inputs.text === 'string') enc.inputs.text = text
    // SDXL dual encoders
    if (typeof enc.inputs.text_g === 'string') enc.inputs.text_g = text
    if (typeof enc.inputs.text_l === 'string') enc.inputs.text_l = text
  }
  for (const node of Object.values(graph)) {
    if (!node?.class_type || !node.inputs) continue
    if (node.class_type.includes('Sampler')) {
      if (typeof node.inputs.seed === 'number') node.inputs.seed = seed
      if (typeof node.inputs.noise_seed === 'number') node.inputs.noise_seed = seed
      setText(node.inputs.positive, prompt)
      setText(node.inputs.negative, negative)
    }
  }
  return graph
}

async function comfyTxt2Img(req: ImageRequest): Promise<string> {
  const { comfyUrl, imageSize, comfyWorkflow: customWorkflow } = useSettings.getState()
  const base = comfyUrl.replace(/\/$/, '')
  const { width, height } = parseSize(imageSize)

  // Custom workflow path: the user's own graph, prompts injected.
  if (customWorkflow.trim()) {
    let graph: Record<string, ComfyNode>
    try {
      graph = JSON.parse(customWorkflow) as Record<string, ComfyNode>
    } catch {
      throw new Error('The saved ComfyUI workflow is not valid JSON — reload it in Settings.')
    }
    return comfySubmit(
      base,
      injectWorkflow(structuredClone(graph), req.prompt, req.negative ?? DEFAULT_NEGATIVE),
      req.signal,
    )
  }

  let ckpt: string
  try {
    ckpt = await comfyGetCheckpoint(base, req.signal)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    if (e instanceof Error && /Checkpoint|checkpoints/.test(e.message)) throw e
    throw new Error(
      `Could not reach ComfyUI at ${comfyUrl}. Is it running (and reachable from this app)?`,
    )
  }

  return comfySubmit(
    base,
    comfyWorkflow(
      ckpt,
      req.prompt,
      req.negative ?? DEFAULT_NEGATIVE,
      width,
      height,
      Math.floor(Math.random() * 2 ** 31),
    ),
    req.signal,
  )
}

/** Submit a workflow graph, poll history, and return the image as a data URL. */
export async function comfySubmit(
  base: string,
  graph: unknown,
  signal?: AbortSignal,
): Promise<string> {
  const clientId = Math.random().toString(36).slice(2)
  let submit: Response
  try {
    submit = await fetch(`${base}/prompt`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, prompt: graph }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new Error(`Could not reach ComfyUI at ${base}.`)
  }
  guardHtml(submit, base)
  if (!submit.ok) {
    const detail = await submit.text().catch(() => submit.statusText)
    throw new Error(`ComfyUI rejected the workflow (${submit.status}): ${detail.slice(0, 200)}`)
  }
  const { prompt_id } = (await submit.json()) as { prompt_id: string }

  // Poll history until the job lands (GPU time varies — be patient).
  for (let tries = 0; tries < 240; tries++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    await new Promise((r) => setTimeout(r, 1000))
    const hist = await fetch(`${base}/history/${prompt_id}`, { signal })
    if (!hist.ok) continue
    const data = (await hist.json()) as Record<
      string,
      {
        outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>
        status?: { status_str?: string; messages?: [string, { node_type?: string; exception_message?: string }][] }
      }
    >
    const entry = data[prompt_id]
    if (!entry) continue
    // Surface server-side execution errors instead of spinning to timeout.
    if (entry.status?.status_str === 'error') {
      const err = entry.status.messages?.find((m) => m[0] === 'execution_error')?.[1]
      throw new Error(
        `ComfyUI failed${err?.node_type ? ` at ${err.node_type}` : ''}: ${err?.exception_message?.slice(0, 300) ?? 'unknown error — check the server console'}`,
      )
    }
    const outputs = entry.outputs
    if (!outputs) continue
    for (const node of Object.values(outputs)) {
      const img = node.images?.[0]
      if (img) {
        const view = await fetch(
          `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`,
          { signal },
        )
        if (!view.ok) throw new Error(`ComfyUI /view error (${view.status}).`)
        const blob = await view.blob()
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Could not read the image.'))
          reader.readAsDataURL(blob)
        })
      }
    }
  }
  throw new Error('ComfyUI timed out after 4 minutes — check the server console.')
}

// ---------- entry point ----------

/** Generate an image with the configured local backend. Returns a data URL. */
export async function generateImage(req: ImageRequest): Promise<string> {
  const { imageProvider } = useSettings.getState()
  if (imageProvider === 'off') {
    throw new Error('Image generation is off — pick a backend in Settings → Image Generation.')
  }
  return imageProvider === 'a1111' ? a1111Txt2Img(req) : comfyTxt2Img(req)
}

/** Decode a data URL into raw bytes (for PNG embedding). */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
