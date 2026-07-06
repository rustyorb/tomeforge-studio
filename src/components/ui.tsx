import React, { useState } from 'react'

export function Field(props: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      {props.children}
      {props.hint && <div className="hint">{props.hint}</div>}
    </div>
  )
}

export function Slider(props: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <label>
        {props.label} <span className="ember-text">{props.value}</span>
      </label>
      <input
        type="range"
        min={props.min ?? 0}
        max={props.max ?? 10}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Modal(props: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal rise" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2>{props.title}</h2>
          <button className="btn ghost small" onClick={props.onClose}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  )
}

export function EmptyState(props: { glyph: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="glyph">{props.glyph}</div>
      <h3 style={{ marginBottom: 6 }}>{props.title}</h3>
      <div>{props.children}</div>
    </div>
  )
}

export function ErrorBanner(props: { error: string | null }) {
  if (!props.error) return null
  return <div className="error-banner">{props.error}</div>
}

/** Streaming text display with ember cursor while generating. */
export function StreamView(props: { text: string; busy: boolean }) {
  if (!props.text && !props.busy) return null
  return (
    <div className="gen-stream prose-block">
      {props.text}
      {props.busy && <span className="gen-cursor" />}
    </div>
  )
}

/** Button that flashes "Copied" after copying text to the clipboard. */
export function CopyButton(props: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn small"
      onClick={() => {
        navigator.clipboard.writeText(props.text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? '✓ Copied' : (props.label ?? 'Copy')}
    </button>
  )
}

export function Tabs(props: {
  tabs: { id: string; label: string }[]
  active: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="tabs">
      {props.tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${props.active === t.id ? 'active' : ''}`}
          onClick={() => props.onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
