import { useState } from 'react'
import type { STBookStored, STCardStored, STEntry } from '../../types'
import { useStore } from '../../store/useStore'
import { Field, Modal } from '../../components/ui'

const csv = (arr: string[] | undefined): string => (arr ?? []).join(', ')
const fromCsv = (text: string): string[] =>
  text.split(',').map((s) => s.trim()).filter(Boolean)

function EntryEditor(props: {
  entry: STEntry
  onChange: (next: STEntry) => void
  onDelete: () => void
}) {
  const e = props.entry
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="grid-2" style={{ gap: 8 }}>
        <Field label="Entry name">
          <input
            type="text"
            value={e.name}
            onChange={(ev) => props.onChange({ ...e, name: ev.target.value })}
          />
        </Field>
        <Field label="Trigger keys (comma-separated)">
          <input
            type="text"
            value={csv(e.keys)}
            onChange={(ev) => props.onChange({ ...e, keys: fromCsv(ev.target.value) })}
          />
        </Field>
      </div>
      <Field label="Secondary keys (AND logic — optional)">
        <input
          type="text"
          value={csv(e.secondaryKeys)}
          placeholder="entry fires only when a trigger key AND one of these appear"
          onChange={(ev) => {
            const keys = fromCsv(ev.target.value)
            props.onChange({ ...e, secondaryKeys: keys.length ? keys : undefined })
          }}
        />
      </Field>
      <Field label="Content">
        <textarea
          rows={3}
          value={e.content}
          onChange={(ev) => props.onChange({ ...e, content: ev.target.value })}
        />
      </Field>
      <div className="row between">
        <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={e.constant}
            style={{ width: 'auto' }}
            onChange={(ev) => props.onChange({ ...e, constant: ev.target.checked })}
          />
          constant (always in context)
        </label>
        <button className="btn ghost small danger" onClick={props.onDelete}>✕ Remove entry</button>
      </div>
    </div>
  )
}

/**
 * Edit any library item in place — card fields, lorebook entries, trigger
 * keys, secondary keys. SillyTavern's world-info editor, minus the pain.
 */
export default function LibraryEditor(props: {
  item: STCardStored | STBookStored
  onClose: () => void
}) {
  const updateItem = useStore((s) => s.updateSTLibraryItem)
  // Draft copy; nothing is written until Save.
  const [draft, setDraft] = useState<STCardStored | STBookStored>(
    () => JSON.parse(JSON.stringify(props.item)) as STCardStored | STBookStored,
  )

  const save = () => {
    updateItem(props.item.id, (item) => {
      Object.assign(item, draft)
    })
    props.onClose()
  }

  const entries = draft.kind === 'card' ? draft.book : draft.entries
  const setEntries = (next: STEntry[]) =>
    setDraft((d) =>
      d.kind === 'card' ? { ...d, book: next } : { ...d, entries: next },
    )

  const addEntry = () =>
    setEntries([...entries, { name: 'New entry', keys: [], content: '', constant: false }])

  return (
    <Modal title={`Edit — ${props.item.name}`} onClose={props.onClose}>
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>

      {draft.kind === 'card' && (
        <>
          <Field label="Tags (comma-separated)">
            <input
              type="text"
              value={csv(draft.tags)}
              onChange={(e) => setDraft({ ...draft, tags: fromCsv(e.target.value) })}
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={5}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <div className="grid-2" style={{ gap: 8 }}>
            <Field label="Personality">
              <textarea
                rows={3}
                value={draft.personality}
                onChange={(e) => setDraft({ ...draft, personality: e.target.value })}
              />
            </Field>
            <Field label="Scenario">
              <textarea
                rows={3}
                value={draft.scenario}
                onChange={(e) => setDraft({ ...draft, scenario: e.target.value })}
              />
            </Field>
          </div>
          <Field label="First message" hint="How they open a chat. Preserved for export.">
            <textarea
              rows={3}
              value={draft.firstMes ?? ''}
              onChange={(e) => setDraft({ ...draft, firstMes: e.target.value })}
            />
          </Field>
          <Field label="Example dialogue (mes_example)">
            <textarea
              rows={3}
              value={draft.mesExample}
              onChange={(e) => setDraft({ ...draft, mesExample: e.target.value })}
            />
          </Field>
        </>
      )}

      <div className="row between" style={{ margin: '10px 0' }}>
        <span className="kicker">
          {draft.kind === 'card' ? 'Embedded lorebook' : 'Entries'} · {entries.length}
        </span>
        <button className="btn small" onClick={addEntry}>⊕ Add entry</button>
      </div>
      <div className="stack" style={{ maxHeight: '38vh', overflowY: 'auto' }}>
        {entries.map((e, i) => (
          <EntryEditor
            key={i}
            entry={e}
            onChange={(next) => setEntries(entries.map((x, j) => (j === i ? next : x)))}
            onDelete={() => setEntries(entries.filter((_, j) => j !== i))}
          />
        ))}
        {entries.length === 0 && (
          <p className="faint" style={{ fontSize: 12.5 }}>No entries yet.</p>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost small" onClick={props.onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save changes</button>
      </div>
    </Modal>
  )
}
