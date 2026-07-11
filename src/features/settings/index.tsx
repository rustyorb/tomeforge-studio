import { useState } from 'react'
import { useSettings } from '../../store/useSettings'
import type { ThemeId } from '../../store/useSettings'
import { fetchModels } from '../../lib/ai'
import { PROVIDERS, getProviderDef } from '../../lib/providers'
import { ErrorBanner, Field } from '../../components/ui'

function ProviderCards() {
  const { provider, providers, setProvider } = useSettings()
  return (
    <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {PROVIDERS.map((p) => {
        const conf = providers[p.id]
        const active = provider === p.id
        const ready = p.needsKey ? !!conf?.apiKey : true
        return (
          <div
            key={p.id}
            className="card interactive"
            style={active ? { borderColor: 'var(--ember)' } : undefined}
            onClick={() => setProvider(p.id)}
          >
            <div className="row between">
              <h3 style={{ fontSize: 15 }}>{p.name}</h3>
              {active && <span className="tag ember">active</span>}
            </div>
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <span className={`tag ${p.local ? 'brass' : ''}`}>{p.local ? 'local' : 'cloud'}</span>
              <span className={`tag ${ready ? 'green' : 'red'}`}>{ready ? (p.needsKey ? 'key set' : 'no key needed') : 'needs key'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProviderPanel() {
  const { provider, providers, updateProvider } = useSettings()
  const def = getProviderDef(provider)
  const conf = providers[provider]
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const models = conf.models.length ? conf.models : def.fallbackModels
  const listId = `models-${provider}`

  const doFetch = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const ids = await fetchModels(provider)
      updateProvider(provider, { models: ids })
      // If no model chosen yet, default to the first fetched one. Read fresh
      // state — the render-time conf is stale if the user typed a model id
      // while the fetch was in flight.
      const fresh = useSettings.getState().providers[provider]
      if (!fresh?.model && ids.length) updateProvider(provider, { model: ids[0] })
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2>{def.name}</h2>
        {def.local && <span className="tag brass">runs on your machine</span>}
      </div>

      {def.needsKey && (
        <Field label={`${def.name} API Key`} hint={def.keyHint}>
          <input
            type="password"
            placeholder="Paste your key…"
            value={conf.apiKey}
            onChange={(e) => updateProvider(provider, { apiKey: e.target.value.trim() })}
          />
        </Field>
      )}

      <Field
        label="Server URL"
        hint={def.corsNote ?? 'Change only if you use a proxy or self-hosted endpoint.'}
      >
        <input
          type="text"
          value={conf.baseUrl}
          onChange={(e) => updateProvider(provider, { baseUrl: e.target.value.trim() })}
        />
      </Field>

      <Field
        label="Default model"
        hint="Click ↻ to fetch the live list from the server, then pick from the dropdown — or type any model id."
      >
        <div className="row">
          <input
            type="text"
            list={listId}
            placeholder={def.local ? 'Fetch to see loaded models…' : 'e.g. ' + (def.fallbackModels[0] ?? 'model-id')}
            value={conf.model}
            onChange={(e) => updateProvider(provider, { model: e.target.value.trim() })}
          />
          <datalist id={listId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button className="btn" onClick={doFetch} disabled={fetching} style={{ flexShrink: 0 }}>
            {fetching ? <span className="spinner" /> : '↻'} Fetch models
          </button>
        </div>
      </Field>

      {conf.models.length > 0 && (
        <div className="mono faint" style={{ marginBottom: 8 }}>
          {conf.models.length.toLocaleString()} models fetched from server
        </div>
      )}
      <ErrorBanner error={fetchError} />

      <div className="row" style={{ marginTop: 4 }}>
        <span className={`tag ${(!def.needsKey || conf.apiKey) && conf.model ? 'green' : 'red'}`}>
          {!def.needsKey || conf.apiKey
            ? conf.model
              ? `Ready — ${conf.model}`
              : 'Pick a model'
            : 'No key — AI features disabled'}
        </span>
      </div>
    </div>
  )
}

const THEME_TILES: { id: ThemeId; name: string; bg: string; accent: string; text: string }[] = [
  { id: 'ember', name: 'Ink & Ember', bg: '#0d0b09', accent: '#e0763a', text: '#e9e0cd' },
  { id: 'parchment', name: 'Parchment', bg: '#efe6d2', accent: '#b0452f', text: '#2b2318' },
  { id: 'abyss', name: 'Abyss', bg: '#080c12', accent: '#4fb39c', text: '#dfe7ec' },
]

function ImageGenCard() {
  const { imageProvider, a1111Url, comfyUrl, comfyCheckpoint, imageSize, setImageGen } = useSettings()
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Image Generation — your own GPUs</div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12, maxWidth: 560 }}>
        Portraits for exported SillyTavern cards, generated locally. Point TomeForge at
        Automatic1111 or ComfyUI on your network — nothing leaves your machines.
      </p>
      <div className="row wrap" style={{ gap: 10 }}>
        <Field label="Backend">
          <select
            value={imageProvider}
            onChange={(e) => setImageGen({ imageProvider: e.target.value as 'off' | 'a1111' | 'comfy' })}
          >
            <option value="off">Off</option>
            <option value="a1111">Automatic1111</option>
            <option value="comfy">ComfyUI</option>
          </select>
        </Field>
        <Field label="Image size">
          <select value={imageSize} onChange={(e) => setImageGen({ imageSize: e.target.value })}>
            <option value="512x512">512 × 512</option>
            <option value="512x768">512 × 768 (card portrait)</option>
            <option value="768x1024">768 × 1024</option>
          </select>
        </Field>
      </div>
      {imageProvider === 'a1111' && (
        <Field
          label="Automatic1111 URL"
          hint="Default '/a1111' rides the app's own proxy — no CORS flags needed (webui still needs --api). A full http:// URL calls it directly instead."
        >
          <input
            type="text"
            value={a1111Url}
            onChange={(e) => setImageGen({ a1111Url: e.target.value.trim() })}
          />
        </Field>
      )}
      {imageProvider === 'comfy' && (
        <Field
          label="ComfyUI URL"
          hint="Default '/comfy' rides the app's own proxy (target set in vite.config.ts) — no CORS flags needed on the ComfyUI box. A full http:// URL calls it directly instead."
        >
          <input
            type="text"
            value={comfyUrl}
            onChange={(e) => setImageGen({ comfyUrl: e.target.value.trim() })}
          />
        </Field>
      )}
      {imageProvider === 'comfy' && (
        <Field
          label="Checkpoint (optional)"
          hint="Blank = first available (alphabetical — risky if odd files sit in the folder). Partial names match, e.g. 'dreamshaper'."
        >
          <input
            type="text"
            value={comfyCheckpoint}
            placeholder="e.g. DreamShaper_8_pruned.safetensors"
            onChange={(e) => setImageGen({ comfyCheckpoint: e.target.value })}
          />
        </Field>
      )}
    </div>
  )
}

function AppearanceCard() {
  const { theme, setTheme } = useSettings()
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Appearance</div>
      <div className="theme-tiles">
        {THEME_TILES.map((t) => (
          <button
            key={t.id}
            className={`theme-tile ${theme === t.id ? 'active' : ''}`}
            onClick={() => setTheme(t.id)}
          >
            <span className="theme-swatch" style={{ background: t.bg, color: t.text }}>
              <span className="theme-aa">Aa</span>
              <span className="theme-dot" style={{ background: t.accent }} />
            </span>
            <span className="theme-name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { maxTokens, setMaxTokens, dailyGoal, setDailyGoal } = useSettings()
  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">System</div>
        <h1>Settings</h1>
        <p className="sub">
          TomeForge talks to your chosen AI provider directly from this browser — cloud services
          with your own API key, or local servers like LM Studio and Ollama. Keys are stored only
          in this browser's local storage and sent only to the provider you pick.
        </p>
      </header>

      <div className="rise-1" style={{ maxWidth: 760 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Provider — click to activate</div>
        <ProviderCards />
        <ProviderPanel />
        <ImageGenCard />
        <AppearanceCard />

        <div className="card" style={{ marginTop: 16 }}>
          <Field
            label="Max tokens per generation"
            hint="Applies to every provider. Longer continuations cost more. 2048 ≈ 1500 words."
          >
            <input
              type="number"
              min={256}
              max={16384}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value) || 2048)}
            />
          </Field>
          <Field
            label="Daily writing goal (words)"
            hint="Set 0 to turn the goal off. Progress ring lives in the sidebar; hit it and sparks fly."
          >
            <input
              type="number"
              min={0}
              max={20000}
              step={50}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}
