import type { ReactNode } from 'react'
import type { QuestWorldState } from '../../types'

function Section(props: { label: string; children: ReactNode }) {
  return (
    <div className="sq-state-section">
      <div className="sq-state-label">{props.label}</div>
      <div className="sq-state-value">{props.children}</div>
    </div>
  )
}

function TextValue(props: { value: string }) {
  return <>{props.value.trim() || '—'}</>
}

function ListValue(props: { items: string[] }) {
  if (!props.items.length) return <>—</>
  return (
    <ul className="sq-state-list">
      {props.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function PairsValue(props: { record: Record<string, string> }) {
  const entries = Object.entries(props.record)
  if (!entries.length) return <>—</>
  return (
    <ul className="sq-state-list">
      {entries.map(([name, status]) => (
        <li key={name}>
          <strong>{name}</strong>: {status}
        </li>
      ))}
    </ul>
  )
}

export function StateSidebar(props: { state: QuestWorldState }) {
  const s = props.state
  return (
    <aside className="sq-sidebar panel">
      <div className="panel-head">
        <span className="kicker">World State</span>
      </div>
      <div className="panel-body">
        <Section label="Location"><TextValue value={s.location} /></Section>
        <Section label="Time of Day"><TextValue value={s.timeOfDay} /></Section>
        <Section label="Weather"><TextValue value={s.weather} /></Section>
        <Section label="Inventory"><ListValue items={s.inventory} /></Section>
        <Section label="Injuries"><ListValue items={s.injuries} /></Section>
        <Section label="Active Quests"><ListValue items={s.quests} /></Section>
        <Section label="Secrets Discovered"><ListValue items={s.secretsDiscovered} /></Section>
        <Section label="NPCs"><PairsValue record={s.npcs} /></Section>
        <Section label="Relationships"><PairsValue record={s.relationships} /></Section>
      </div>
    </aside>
  )
}
