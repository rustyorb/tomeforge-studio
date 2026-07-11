import { useState } from 'react'
import type { QuestWorldState } from '../../types'
import { Field, Modal } from '../../components/ui'

/** Lines → trimmed string array. */
const toList = (text: string): string[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean)

/** "Name: value" lines → record. Lines without a colon become "name: ''". */
const toRecord = (text: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const line of toList(text)) {
    const at = line.indexOf(':')
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim()
    else out[line] = ''
  }
  return out
}

const fromRecord = (r: Record<string, string>): string =>
  Object.entries(r).map(([k, v]) => (v ? `${k}: ${v}` : k)).join('\n')

/**
 * Manual world-state editor — the GM keeps the books, but sometimes the GM
 * forgets your sword. Fix anything; the next turn plays from the edited state.
 */
export function StateEditor(props: {
  state: QuestWorldState
  onSave: (next: QuestWorldState) => void
  onClose: () => void
}) {
  const s = props.state
  const [location, setLocation] = useState(s.location)
  const [timeOfDay, setTimeOfDay] = useState(s.timeOfDay)
  const [weather, setWeather] = useState(s.weather)
  const [inventory, setInventory] = useState(s.inventory.join('\n'))
  const [injuries, setInjuries] = useState(s.injuries.join('\n'))
  const [quests, setQuests] = useState(s.quests.join('\n'))
  const [secrets, setSecrets] = useState(s.secretsDiscovered.join('\n'))
  const [npcs, setNpcs] = useState(fromRecord(s.npcs))
  const [relationships, setRelationships] = useState(fromRecord(s.relationships))

  const save = () => {
    props.onSave({
      location: location.trim(),
      timeOfDay: timeOfDay.trim(),
      weather: weather.trim(),
      inventory: toList(inventory),
      injuries: toList(injuries),
      quests: toList(quests),
      secretsDiscovered: toList(secrets),
      npcs: toRecord(npcs),
      relationships: toRecord(relationships),
    })
    props.onClose()
  }

  return (
    <Modal title="Edit World State" onClose={props.onClose}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        The GM tracks this automatically, but GMs forget swords. One item per line; NPCs and
        relationships as <span className="mono">Name: status</span>. The next turn plays from
        whatever you set here.
      </p>
      <div className="grid-3" style={{ gap: 10 }}>
        <Field label="Location">
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Time of day">
          <input type="text" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
        </Field>
        <Field label="Weather">
          <input type="text" value={weather} onChange={(e) => setWeather(e.target.value)} />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 10 }}>
        <Field label="Inventory (one per line)">
          <textarea rows={4} value={inventory} onChange={(e) => setInventory(e.target.value)} />
        </Field>
        <Field label="Active quests">
          <textarea rows={4} value={quests} onChange={(e) => setQuests(e.target.value)} />
        </Field>
        <Field label="Injuries">
          <textarea rows={3} value={injuries} onChange={(e) => setInjuries(e.target.value)} />
        </Field>
        <Field label="Secrets discovered">
          <textarea rows={3} value={secrets} onChange={(e) => setSecrets(e.target.value)} />
        </Field>
        <Field label="NPCs (Name: status)">
          <textarea rows={4} value={npcs} onChange={(e) => setNpcs(e.target.value)} />
        </Field>
        <Field label="Relationships (Name: standing)">
          <textarea rows={4} value={relationships} onChange={(e) => setRelationships(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost small" onClick={props.onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save state</button>
      </div>
    </Modal>
  )
}
