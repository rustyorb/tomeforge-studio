import { useSettings } from '../../store/useSettings'
import { MODELS } from '../../lib/ai'
import { Field } from '../../components/ui'

export default function SettingsPage() {
  const settings = useSettings()
  return (
    <div className="page">
      <header className="page-header rise">
        <div className="kicker">System</div>
        <h1>Settings</h1>
        <p className="sub">
          TomeForge talks directly to the Anthropic API from your browser. Your key is stored
          only in this browser's local storage and sent only to Anthropic.
        </p>
      </header>

      <div className="card rise-1" style={{ maxWidth: 620 }}>
        <Field
          label="Anthropic API Key"
          hint="Get one at console.anthropic.com → API Keys. Stored locally, never uploaded anywhere else."
        >
          <input
            type="password"
            placeholder="sk-ant-…"
            value={settings.apiKey}
            onChange={(e) => settings.set({ apiKey: e.target.value.trim() })}
          />
        </Field>

        <Field label="Model">
          <select value={settings.model} onChange={(e) => settings.set({ model: e.target.value })}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Max tokens per generation" hint="Longer continuations cost more. 2048 ≈ 1500 words.">
          <input
            type="number"
            min={256}
            max={8192}
            value={settings.maxTokens}
            onChange={(e) => settings.set({ maxTokens: Number(e.target.value) || 2048 })}
          />
        </Field>

        <div className="row" style={{ marginTop: 4 }}>
          <span className={`tag ${settings.apiKey ? 'green' : 'red'}`}>
            {settings.apiKey ? 'Key configured' : 'No key — AI features disabled'}
          </span>
        </div>
      </div>
    </div>
  )
}
