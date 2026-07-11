import { useEffect, useRef, useState } from 'react'
import type { Project, QuestCommand, QuestState, StyleProfile } from '../../types'
import { useStore } from '../../store/useStore'
import { uid } from '../../lib/id'
import { ErrorBanner, Modal, StreamView } from '../../components/ui'
import { runGmTurn } from './gm'
import type { PlayerInput } from './gm'
import { QUEST_MODES } from './modes'
import { StateSidebar } from './StateSidebar'
import { StateEditor } from './StateEditor'
import { ConvertProseModal } from './ConvertProseModal'

const COMMANDS: QuestCommand[] = [
  'do', 'say', 'think', 'inspect', 'use', 'travel', 'wait', 'remember',
]

type PanelKind = 'inventory' | 'quests' | 'convert' | 'branches' | 'editState' | null

/** Deep clone for freezing/restoring quest states across branches. */
function cloneQuest(q: QuestState): QuestState {
  return JSON.parse(JSON.stringify(q)) as QuestState
}

export function PlayView(props: {
  project: Project
  styleProfile: StyleProfile | null
  quest: QuestState
}) {
  const { project, styleProfile, quest } = props
  const updateProject = useStore((s) => s.updateProject)

  const [command, setCommand] = useState<QuestCommand>('do')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelKind>(null)

  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const openingRequested = useRef(false)

  const modeInfo = QUEST_MODES.find((m) => m.id === quest.mode)

  // Hide the (partial) json state block from the live stream display.
  const fenceIdx = stream.indexOf('```')
  const visibleStream = fenceIdx === -1 ? stream : stream.slice(0, fenceIdx).trimEnd()

  const runTurn = async (input: PlayerInput | null, snapshot: QuestState) => {
    setBusy(true)
    setError(null)
    setStream('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await runGmTurn({
        project,
        styleProfile,
        quest: snapshot,
        input,
        signal: controller.signal,
        onDelta: (chunk) => setStream((s) => s + chunk),
      })
      updateProject(project.id, (draft) => {
        if (!draft.quest) return
        draft.quest.log.push({ id: uid(), role: 'gm', text: result.narration })
        if (result.state) draft.quest.state = result.state
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
      setStream('')
      abortRef.current = null
    }
  }

  // Opening narration: fire once when the quest starts with an empty log.
  useEffect(() => {
    if (quest.log.length === 0 && !busy && !openingRequested.current) {
      openingRequested.current = true
      void runTurn(null, quest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.log.length])

  // Abort any in-flight stream when leaving the page. An aborted opening
  // narration was never delivered, so release the once-guard too — otherwise
  // StrictMode's simulated unmount permanently suppresses the opening.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      openingRequested.current = false
    },
    [],
  )

  // Keep the adventure log scrolled to the newest turn.
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [quest.log.length, visibleStream, busy])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const snapshot = quest
    updateProject(project.id, (draft) => {
      draft.quest?.log.push({ id: uid(), role: 'player', command, text: trimmed })
    })
    setText('')
    void runTurn({ command, text: trimmed }, snapshot)
  }

  const endAdventure = () => {
    if (!confirm('End this adventure? The quest log will be discarded.')) return
    abortRef.current?.abort()
    updateProject(project.id, (draft) => {
      draft.quest = null
    })
  }

  const [branchName, setBranchName] = useState('')
  const saves = project.questSaves ?? []

  const saveBranch = () => {
    const name = branchName.trim() || `Branch — turn ${quest.log.length}`
    const frozen = cloneQuest(quest)
    updateProject(project.id, (draft) => {
      if (!draft.questSaves) draft.questSaves = []
      draft.questSaves.unshift({
        id: uid(),
        name,
        note: `${quest.log.length} turns · ${quest.state.location || 'unknown place'}`,
        createdAt: Date.now(),
        quest: frozen,
      })
    })
    setBranchName('')
  }

  const loadBranch = (id: string) => {
    const save = saves.find((s) => s.id === id)
    if (!save) return
    if (!confirm(`Load "${save.name}"? The current timeline will be replaced — save it as a branch first if you want to keep it.`)) return
    abortRef.current?.abort()
    const restored = cloneQuest(save.quest)
    updateProject(project.id, (draft) => {
      draft.quest = restored
    })
    setPanel(null)
  }

  const rollD20 = () => {
    const n = 1 + Math.floor(Math.random() * 20)
    setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}(d20: ${n})`)
  }

  return (
    <div className="page sq-page">
      <header className="page-header rise" style={{ marginBottom: 16 }}>
        <div className="row between wrap">
          <div>
            <div className="kicker">StoryQuest</div>
            <h1>{project.name}</h1>
            <div className="row" style={{ marginTop: 8 }}>
              <span className="tag ember">{modeInfo?.title ?? quest.mode}</span>
              <span className="tag brass">{quest.playerName}</span>
            </div>
          </div>
          <div className="row">
            <button className="btn small" disabled={busy} onClick={() => setPanel('branches')}>
              ⎇ Branches{saves.length ? ` (${saves.length})` : ''}
            </button>
            <button
              className="btn small"
              disabled={busy || quest.log.length === 0}
              onClick={() => setPanel('convert')}
            >
              Convert to Prose
            </button>
            <button className="btn small danger" onClick={endAdventure}>
              End Adventure
            </button>
          </div>
        </div>
      </header>

      <div className="sq-play rise-1">
        <div className="sq-log-col">
          <div className="sq-log" ref={logRef}>
            {quest.log.map((turn) =>
              turn.role === 'gm' ? (
                <div key={turn.id} className="prose-block sq-turn-gm">
                  {turn.text}
                </div>
              ) : (
                <div key={turn.id} className="sq-turn-player">
                  <span className="tag ember">{turn.command ?? 'do'}</span>
                  <span>{turn.text}</span>
                </div>
              ),
            )}
            {busy && <StreamView text={visibleStream} busy />}
            <ErrorBanner error={error} />
          </div>

          <div className="sq-quick row">
            <button className="btn ghost small" onClick={() => setPanel('inventory')}>
              Inventory
            </button>
            <button className="btn ghost small" onClick={() => setPanel('quests')}>
              Quest Log
            </button>
            <button
              className="btn ghost small"
              title="Manually correct the tracked world state"
              onClick={() => setPanel('editState')}
            >
              ✎ State
            </button>
          </div>

          <div className="sq-command-bar">
            <select
              value={command}
              disabled={busy}
              onChange={(e) => setCommand(e.target.value as QuestCommand)}
            >
              {COMMANDS.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
            {quest.mode === 'rpg' && (
              <button
                className="btn ghost"
                disabled={busy}
                title="Roll a d20 into your action"
                onClick={rollD20}
              >
                🎲
              </button>
            )}
            <input
              type="text"
              value={text}
              disabled={busy}
              placeholder={busy ? 'The GM is narrating…' : 'What do you do?'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            {busy ? (
              <button className="btn danger" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button className="btn primary" disabled={!text.trim()} onClick={submit}>
                Send
              </button>
            )}
          </div>
        </div>

        <StateSidebar state={quest.state} />
      </div>

      {panel === 'branches' && (
        <Modal title="Timeline Branches" onClose={() => setPanel(null)}>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            Freeze this moment as a branch, then play out a different choice — "what if she
            accepts the duel?" Load any branch to jump back to that timeline.
          </p>
          <div className="row" style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={branchName}
              placeholder={`Branch — turn ${quest.log.length}`}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveBranch()
              }}
            />
            <button className="btn primary" style={{ flexShrink: 0 }} onClick={saveBranch}>
              ⎇ Save Current
            </button>
          </div>
          {saves.length === 0 ? (
            <p className="faint" style={{ fontSize: 13 }}>No branches saved yet.</p>
          ) : (
            <div className="stack">
              {saves.map((s) => (
                <div key={s.id} className="row between" style={{ gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5 }}>{s.name}</div>
                    <div className="mono faint" style={{ fontSize: 10.5 }}>
                      {s.note} · {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="row" style={{ flexShrink: 0 }}>
                    <button className="btn small" onClick={() => loadBranch(s.id)}>Load</button>
                    <button
                      className="btn ghost small danger"
                      onClick={() =>
                        updateProject(project.id, (draft) => {
                          draft.questSaves = (draft.questSaves ?? []).filter((x) => x.id !== s.id)
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {panel === 'editState' && (
        <StateEditor
          state={quest.state}
          onClose={() => setPanel(null)}
          onSave={(next) =>
            updateProject(project.id, (draft) => {
              if (draft.quest) draft.quest.state = next
            })
          }
        />
      )}

      {panel === 'inventory' && (
        <Modal title="Inventory" onClose={() => setPanel(null)}>
          {quest.state.inventory.length ? (
            <ul className="sq-modal-list">
              {quest.state.inventory.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Your pockets are empty.</p>
          )}
        </Modal>
      )}

      {panel === 'quests' && (
        <Modal title="Quest Log" onClose={() => setPanel(null)}>
          <div className="kicker" style={{ marginBottom: 6 }}>Active Quests</div>
          {quest.state.quests.length ? (
            <ul className="sq-modal-list">
              {quest.state.quests.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No active quests.</p>
          )}
          <div className="divider" />
          <div className="kicker" style={{ marginBottom: 6 }}>Secrets Discovered</div>
          {quest.state.secretsDiscovered.length ? (
            <ul className="sq-modal-list">
              {quest.state.secretsDiscovered.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing uncovered yet.</p>
          )}
        </Modal>
      )}

      {panel === 'convert' && (
        <ConvertProseModal
          project={project}
          styleProfile={styleProfile}
          quest={quest}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
