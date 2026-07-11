import { useEffect, useMemo, useRef, useState } from 'react'
import { useActiveProject, useProjectStyle, useStore } from '../../store/useStore'
import type { AtlasPin } from '../../types'
import { uid } from '../../lib/id'
import { streamMessage } from '../../lib/ai'
import { looseJson } from '../../lib/looseJson'
import { downloadBlob } from '../../lib/export/download'
import { EmptyState, ErrorBanner } from '../../components/ui'
import { MAP_H, MAP_W, landSpotFor, makeTerrain, renderTerrain } from './terrain'
import './atlas.css'

/**
 * The Atlas — a seeded, procedurally-inked map of the tome's world. Codex
 * locations pin themselves onto the terrain; pins drag; the AI can invent
 * new places; the whole chart exports as a PNG.
 */
export default function AtlasPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)
  const updateProject = useStore((s) => s.updateProject)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [naming, setNaming] = useState<{ x: number; y: number } | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atlas = project?.atlas ?? null
  const seed = atlas?.seed ?? 0
  const terrain = useMemo(() => (atlas ? makeTerrain(seed) : null), [atlas !== null, seed])

  // Paint terrain whenever the seed changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && terrain) renderTerrain(ctx, terrain)
  }, [terrain])

  // Pin dragging on the overlay.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const id = dragRef.current
      const wrap = wrapRef.current
      if (!id || !wrap || !project) return
      if (e.buttons === 0) {
        dragRef.current = null
        return
      }
      const rect = wrap.getBoundingClientRect()
      const x = Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width))
      const y = Math.min(0.98, Math.max(0.02, (e.clientY - rect.top) / rect.height))
      updateProject(project.id, (d) => {
        const pin = d.atlas?.pins.find((p) => p.id === id)
        if (pin) {
          pin.x = x
          pin.y = y
        }
      })
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [project, updateProject])

  if (!project) {
    return (
      <div className="page">
        <EmptyState glyph="🗺" title="No tome open">
          The Atlas charts a story's world — open a project from the Archive first.
        </EmptyState>
      </div>
    )
  }

  const forgeWorld = () => {
    updateProject(project.id, (d) => {
      d.atlas = { seed: Math.floor(Math.random() * 2 ** 31), pins: d.atlas?.pins ?? [] }
    })
  }

  const pinCodexLocations = () => {
    if (!terrain) return
    updateProject(project.id, (d) => {
      if (!d.atlas) return
      const existing = new Set(d.atlas.pins.map((p) => p.name.toLowerCase()))
      let salt = 0
      for (const entry of d.codex.filter((e) => e.type === 'location')) {
        if (existing.has(entry.name.toLowerCase())) continue
        const spot = landSpotFor(entry.name, terrain, salt++)
        d.atlas.pins.push({ id: uid(), name: entry.name, x: spot.x, y: spot.y })
        existing.add(entry.name.toLowerCase())
      }
    })
  }

  const inventPlaces = async () => {
    if (!terrain || busy) return
    setBusy(true)
    setError(null)
    try {
      const known = (project.atlas?.pins ?? []).map((p) => p.name).join(', ') || '(none)'
      const full = await streamMessage({
        system:
          'You are a structured-data generation engine. Respond with ONLY a fenced ```json array.\n\nTASK:\n' +
          `Invent 6 evocative place names for the world of "${project.name}" (${project.genre || 'fiction'}: ${project.logline}). ` +
          `Fit the tone; avoid these existing places: ${known}. ` +
          'Each element: {"name": "Place Name", "note": "one-line description"}.',
        messages: [{ role: 'user', content: 'Return the JSON array now.' }],
        temperature: 1.0,
        maxTokens: 500,
      })
      const raw = looseJson(full)
      const items = Array.isArray(raw) ? raw : []
      let salt = 100
      updateProject(project.id, (d) => {
        if (!d.atlas) return
        const existing = new Set(d.atlas.pins.map((p) => p.name.toLowerCase()))
        for (const item of items) {
          if (!item || typeof item !== 'object') continue
          const name = typeof (item as Record<string, unknown>).name === 'string'
            ? ((item as Record<string, unknown>).name as string).trim()
            : ''
          if (!name || existing.has(name.toLowerCase())) continue
          const spot = landSpotFor(name, terrain, salt++)
          d.atlas.pins.push({ id: uid(), name, x: spot.x, y: spot.y })
          existing.add(name.toLowerCase())
          const note = (item as Record<string, unknown>).note
          if (typeof note === 'string' && note.trim()) {
            if (!d.codex.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
              d.codex.push({
                id: uid(),
                name,
                type: 'location',
                aliases: [],
                content: note.trim(),
                alwaysInclude: false,
                updatedAt: Date.now(),
              })
            }
          }
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const exportPng = async () => {
    if (!terrain) return
    const canvas = document.createElement('canvas')
    canvas.width = MAP_W
    canvas.height = MAP_H
    const ctx = canvas.getContext('2d')!
    renderTerrain(ctx, terrain)
    // Pins + labels
    for (const pin of project.atlas?.pins ?? []) {
      const px = pin.x * MAP_W
      const py = pin.y * MAP_H
      ctx.fillStyle = '#e0763a'
      ctx.beginPath()
      ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(16, 13, 10, 0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.font = '600 14px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(16, 13, 10, 0.85)'
      ctx.fillText(pin.name, px + 1, py - 10 + 1)
      ctx.fillStyle = 'rgba(238, 230, 214, 0.95)'
      ctx.fillText(pin.name, px, py - 10)
    }
    // Cartouche
    ctx.font = '600 24px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(16, 13, 10, 0.75)'
    ctx.fillRect(24, MAP_H - 64, ctx.measureText(project.name).width + 32, 42)
    ctx.strokeStyle = 'rgba(233, 224, 205, 0.5)'
    ctx.strokeRect(24, MAP_H - 64, ctx.measureText(project.name).width + 32, 42)
    ctx.fillStyle = 'rgba(238, 230, 214, 0.95)'
    ctx.fillText(project.name, 40, MAP_H - 36)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (blob) downloadBlob(`${project.name.replace(/\s+/g, '-').toLowerCase()}-atlas.png`, blob)
  }

  const onMapClick = (e: React.MouseEvent) => {
    if (!wrapRef.current || naming) return
    const rect = wrapRef.current.getBoundingClientRect()
    setNaming({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
    setNameDraft('')
    setSelected(null)
  }

  const addPin = () => {
    if (!naming || !nameDraft.trim()) {
      setNaming(null)
      return
    }
    updateProject(project.id, (d) => {
      d.atlas?.pins.push({ id: uid(), name: nameDraft.trim(), x: naming.x, y: naming.y })
    })
    setNaming(null)
  }

  const selectedPin = project.atlas?.pins.find((p) => p.id === selected) ?? null
  const selectedEntry = selectedPin
    ? project.codex.find((e) => e.name.toLowerCase() === selectedPin.name.toLowerCase()) ?? null
    : null

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <header className="page-header rise">
        <div className="kicker">The World</div>
        <h1>The Atlas</h1>
        <p className="sub">
          A charted world for this tome — seeded terrain, inked coastlines, and your Codex
          locations pinned where they belong. Click open water or land to name a place; drag
          pins to move them.
        </p>
      </header>

      {!atlas ? (
        <EmptyState glyph="🗺" title="Uncharted">
          <p style={{ marginBottom: 14 }}>No map has been drawn for this world yet.</p>
          <button className="btn primary" onClick={forgeWorld}>🗺 Chart the world</button>
        </EmptyState>
      ) : (
        <>
          <div className="row wrap rise-1" style={{ marginBottom: 12 }}>
            <button
              className="btn small"
              title="Redraw the terrain with a new seed (pins stay put)"
              onClick={() => {
                if (confirm('Redraw the terrain? Pins keep their positions on the new land.')) forgeWorld()
              }}
            >
              🌍 New terrain
            </button>
            <button className="btn small" onClick={pinCodexLocations} title="Place every location-type codex entry on the map">
              📍 Pin codex locations
            </button>
            <button className="btn small" disabled={busy} onClick={() => void inventPlaces()} title="AI invents 6 fitting places — pinned and added to the Codex">
              {busy ? (<><span className="spinner" /> Naming…</>) : '✨ Invent places'}
            </button>
            <span style={{ marginLeft: 'auto' }}>
              <button className="btn small" onClick={() => void exportPng()}>⬇ Export PNG</button>
            </span>
          </div>
          <ErrorBanner error={error} />

          <div className="at-layout rise-2">
            <div className="at-map-wrap" ref={wrapRef} onClick={onMapClick}>
              <canvas ref={canvasRef} width={MAP_W} height={MAP_H} className="at-canvas" />
              {(project.atlas?.pins ?? []).map((pin) => (
                <PinMarker
                  key={pin.id}
                  pin={pin}
                  active={pin.id === selected}
                  onSelect={() => setSelected(pin.id)}
                  onDragStart={() => {
                    dragRef.current = pin.id
                    setSelected(pin.id)
                  }}
                />
              ))}
              {naming && (
                <div
                  className="at-naming"
                  style={{ left: `${naming.x * 100}%`, top: `${naming.y * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    value={nameDraft}
                    placeholder="Name this place…"
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addPin()
                      if (e.key === 'Escape') setNaming(null)
                    }}
                  />
                  <button className="btn small primary" onClick={addPin}>Pin</button>
                </div>
              )}
            </div>

            <aside className="at-side">
              {selectedPin ? (
                <div className="card">
                  <div className="row between">
                    <h3>{selectedPin.name}</h3>
                    <button
                      className="btn ghost small danger"
                      onClick={() => {
                        updateProject(project.id, (d) => {
                          if (d.atlas) d.atlas.pins = d.atlas.pins.filter((p) => p.id !== selectedPin.id)
                        })
                        setSelected(null)
                      }}
                    >
                      ✕ Unpin
                    </button>
                  </div>
                  {selectedEntry ? (
                    <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
                      {selectedEntry.content.slice(0, 600)}
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <p className="faint" style={{ fontSize: 12.5, marginBottom: 8 }}>
                        Not in the Codex yet.
                      </p>
                      <button
                        className="btn small"
                        onClick={() =>
                          updateProject(project.id, (d) => {
                            d.codex.push({
                              id: uid(),
                              name: selectedPin.name,
                              type: 'location',
                              aliases: [],
                              content: '',
                              alwaysInclude: false,
                              updatedAt: Date.now(),
                            })
                          })
                        }
                      >
                        ⊕ Add to Codex
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card">
                  <div className="kicker" style={{ marginBottom: 8 }}>Legend</div>
                  <p className="faint" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                    {project.atlas?.pins.length ?? 0} place{(project.atlas?.pins.length ?? 0) === 1 ? '' : 's'} charted ·
                    click a pin for its lore · click anywhere to found a new place · the same
                    seed always draws the same world.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function PinMarker(props: {
  pin: AtlasPin
  active: boolean
  onSelect: () => void
  onDragStart: () => void
}) {
  return (
    <div
      className={`at-pin ${props.active ? 'active' : ''}`}
      style={{ left: `${props.pin.x * 100}%`, top: `${props.pin.y * 100}%` }}
      onClick={(e) => {
        e.stopPropagation()
        props.onSelect()
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        props.onDragStart()
      }}
      title={props.pin.name}
    >
      <span className="at-pin-dot" />
      <span className="at-pin-label">{props.pin.name}</span>
    </div>
  )
}
