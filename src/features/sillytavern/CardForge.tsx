import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Field, ErrorBanner } from '../../components/ui'
import { InspireButton } from '../../components/InspireButton'
import { buildStoryContext } from '../../lib/context'
import { dataUrlToBytes, generateImage } from '../../lib/imageGen'
import { useSettings } from '../../store/useSettings'
import { downloadBlob, downloadText, slugify } from '../../lib/export/download'
import {
  characterCardPng, draftFromCharacter, toV2Json, toV3Json,
} from '../../lib/export/characterCard'
import type { CardDraft } from '../../lib/export/characterCard'

/**
 * Card Forge — turn any Cast Ledger character into a SillyTavern-compatible
 * V2/V3 character card (.json, or .png with embedded data + generated cover).
 * Codex lore travels along as the embedded character book.
 */
export default function CardForge() {
  const { projects, activeProjectId } = useStore()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [charId, setCharId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CardDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imageProvider = useSettings((s) => s.imageProvider)
  const [portrait, setPortrait] = useState<string | null>(null)
  const [artStyle, setArtStyle] = useState('digital painting, dramatic lighting, detailed face')
  const [painting, setPainting] = useState(false)
  const paintAbort = useState(() => ({ current: null as AbortController | null }))[0]

  const paintPortrait = async () => {
    if (!draft || painting) return
    setPainting(true)
    setError(null)
    const controller = new AbortController()
    paintAbort.current = controller
    try {
      const dataUrl = await generateImage({
        prompt:
          `portrait of ${draft.name}, ${draft.description.slice(0, 300).replace(/\n/g, ' ')}, ` +
          `${artStyle}`,
        signal: controller.signal,
      })
      setPortrait(dataUrl)
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setPainting(false)
      paintAbort.current = null
    }
  }

  const project = projects.find((p) => p.id === (projectId ?? activeProjectId)) ?? projects[0] ?? null
  const character = project?.characters.find((c) => c.id === charId) ?? null

  const loreCount = useMemo(() => {
    if (!project || !draft) return 0
    return project.codex.filter(
      (e) => e.name.toLowerCase() !== draft.name.toLowerCase() && e.content.trim(),
    ).length
  }, [project, draft])

  const beginForge = () => {
    if (project && character) {
      setDraft(draftFromCharacter(project, character))
      setError(null)
    }
  }

  const patch = (p: Partial<CardDraft>) => setDraft((d) => (d ? { ...d, ...p } : d))

  const downloadPng = async () => {
    if (!project || !draft) return
    setBusy(true)
    setError(null)
    try {
      const base = portrait ? dataUrlToBytes(portrait) : undefined
      downloadBlob(`${slugify(draft.name)}-card.png`, await characterCardPng(project, draft, base))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row between wrap">
        <div>
          <h3 style={{ fontSize: 15 }}>⚒ Card Forge — export TO SillyTavern</h3>
          <p className="muted" style={{ fontSize: 13, maxWidth: 560 }}>
            Turn any character from a tome's Cast Ledger into a spec V2/V3 character card —
            usable in SillyTavern and every UI that reads card PNGs. World lore from the Codex
            is embedded as the card's lorebook.
          </p>
        </div>
      </div>

      <div className="row wrap" style={{ marginTop: 10, gap: 10 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Tome</label>
          <select
            value={project?.id ?? ''}
            onChange={(e) => {
              setProjectId(e.target.value || null)
              setCharId(null)
              setDraft(null)
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Character</label>
          <select
            value={charId ?? ''}
            onChange={(e) => {
              setCharId(e.target.value || null)
              setDraft(null)
            }}
          >
            <option value="">Choose…</option>
            {(project?.characters ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-end' }}
          disabled={!character}
          onClick={beginForge}
        >
          Assemble card
        </button>
      </div>

      {project && draft && (
        <div style={{ marginTop: 16 }}>
          <div className="grid-2">
            <Field label="Description" hint="Who they are — becomes the card's core definition.">
              <textarea rows={5} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label="Personality">
              <textarea rows={5} value={draft.personality} onChange={(e) => patch({ personality: e.target.value })} />
            </Field>
          </div>
          <Field label="Scenario" hint="The situation a chat starts inside.">
            <textarea rows={2} value={draft.scenario} onChange={(e) => patch({ scenario: e.target.value })} />
          </Field>
          <Field label="First message" hint="How they greet the user. ✨ drafts one in their voice.">
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
              <InspireButton
                title="Draft an in-character greeting"
                build={() => ({
                  system: buildStoryContext(project, null, {
                    includeCast: false,
                    taskDirective:
                      `Write a first message for a roleplay chat as ${draft.name}. ` +
                      `Their personality: ${draft.personality.slice(0, 500)}. ` +
                      'Format: 1-2 short paragraphs, actions in *asterisks*, spoken lines in quotes, ' +
                      'ending on something that invites a reply. Output only the message.',
                  }),
                  user: 'Write the greeting now.',
                  maxTokens: 300,
                })}
                onText={(t) => patch({ first_mes: t })}
              />
            </div>
            <textarea rows={4} value={draft.first_mes} onChange={(e) => patch({ first_mes: e.target.value })} />
          </Field>

          {imageProvider !== 'off' && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Portrait — painted on your GPU</div>
              <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
                  <label>Art style</label>
                  <input
                    type="text"
                    value={artStyle}
                    onChange={(e) => setArtStyle(e.target.value)}
                  />
                </div>
                {painting ? (
                  <button className="btn danger" onClick={() => paintAbort.current?.abort()}>
                    Stop
                  </button>
                ) : (
                  <button className="btn" onClick={() => void paintPortrait()}>
                    🎨 {portrait ? 'Repaint' : 'Paint portrait'}
                  </button>
                )}
                {portrait && (
                  <button className="btn ghost small" onClick={() => setPortrait(null)}>
                    ✕ Use gradient cover instead
                  </button>
                )}
              </div>
              {painting && (
                <div className="mono faint" style={{ marginTop: 8 }}>
                  <span className="spinner" /> The GPU is dreaming… (ComfyUI can take a minute)
                </div>
              )}
              {portrait && (
                <img
                  src={portrait}
                  alt="Card portrait"
                  style={{ marginTop: 10, maxWidth: 180, borderRadius: 6, border: '1px solid var(--line)' }}
                />
              )}
            </div>
          )}

          <ErrorBanner error={error} />
          <div className="row wrap" style={{ marginTop: 6 }}>
            <button className="btn primary" disabled={busy} onClick={() => void downloadPng()}>
              {busy ? <span className="spinner" /> : '⬇'} PNG card {portrait ? '(your art + data)' : '(v2+v3 embedded)'}
            </button>
            <button
              className="btn"
              onClick={() => downloadText(`${slugify(draft.name)}-v2.json`, toV2Json(project, draft), 'application/json')}
            >
              ⬇ V2 .json
            </button>
            <button
              className="btn"
              onClick={() => downloadText(`${slugify(draft.name)}-v3.json`, toV3Json(project, draft), 'application/json')}
            >
              ⬇ V3 .json
            </button>
            <span className="mono faint" style={{ marginLeft: 'auto' }}>
              lorebook: up to 25 of {loreCount} codex entries ride along
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
