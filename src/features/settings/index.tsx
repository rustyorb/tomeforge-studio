import { useState } from 'react'
import { useSettings } from '../../store/useSettings'
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
      // If no model chosen yet, default to the first fetched one.
      if (!conf.model && ids.length) updateProvider(provider, { model: ids[0] })
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

export default function SettingsPage() {
  const { maxTokens, setMaxTokens } = useSettings()
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
        </div>
      </div>
    </div>
  )
}
