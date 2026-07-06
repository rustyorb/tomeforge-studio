import { useStore } from '../../store/useStore'
import type { PlotThread, Project, StyleProfile, ThreadKind } from '../../types'
import { uid } from '../../lib/id'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { CopyButton, EmptyState, ErrorBanner, Field, StreamView } from '../../components/ui'
import { useStreamTask } from './useStreamTask'

const THREAD_KINDS: ThreadKind[] = [
  'clue', 'question', 'prophecy', 'weapon', 'secret', 'promise', 'conflict',
]

const GROUPS: { status: PlotThread['status']; label: string; tag: string; blurb: string }[] = [
  { status: 'open', label: 'Open', tag: 'ember', blurb: 'Loaded guns still on the wall.' },
  { status: 'paidoff', label: 'Paid Off', tag: 'green', blurb: 'Promises kept.' },
  { status: 'abandoned', label: 'Abandoned', tag: 'red', blurb: 'Threads cut loose — on purpose.' },
]

export default function ThreadmapTab(props: { project: Project; styleProfile: StyleProfile | null }) {
  const { project, styleProfile } = props
  const updateProject = useStore((s) => s.updateProject)
  const suggest = useStreamTask()

  const edit = (id: string, recipe: (t: PlotThread) => void) =>
    updateProject(project.id, (d) => {
      const target = d.threads.find((t) => t.id === id)
      if (target) recipe(target)
    })

  const addThread = () => {
    updateProject(project.id, (d) => {
      d.threads.push({
        id: uid(),
        title: 'New thread',
        kind: 'question',
        setup: '',
        chapterIntroduced: '',
        status: 'open',
        payoffNotes: '',
      })
    })
  }

  const suggestPayoffs = async () => {
    const open = project.threads.filter((t) => t.status === 'open')
    const list = open
      .map((t) => `- "${t.title}" [${t.kind}] introduced ${t.chapterIntroduced || '?'}: ${t.setup || '(no setup notes)'}`)
      .join('\n')
    await suggest.run({
      system: buildStoryContext(project, styleProfile, {
        recentText: tailOfManuscript(project, 6000),
        taskDirective:
          'Act as a plotting consultant. For each open thread below, suggest one or two concrete, ' +
          'canon-consistent payoff ideas — where and how it could pay off, and which characters it should touch. ' +
          'Be concise: a short bullet or two per thread. Flag any thread that has gone stale.',
      }),
      messages: [
        {
          role: 'user',
          content:
            `OPEN THREADS:\n${list}\n\nRECENT MANUSCRIPT:\n${tailOfManuscript(project, 6000) || '(manuscript is empty)'}\n\nSuggest payoffs now.`,
        },
      ],
      temperature: 0.8,
      maxTokens: 1200,
    })
  }

  const openCount = project.threads.filter((t) => t.status === 'open').length

  return (
    <div className="rise">
      <div className="row between" style={{ marginBottom: 16 }}>
        <span className="kicker">Foreshadowing & Payoff · {project.threads.length}</span>
        <button className="btn primary" onClick={addThread}>⊕ New Thread</button>
      </div>

      {project.threads.length === 0 && (
        <EmptyState glyph="⟠" title="No threads yet">
          Track every planted clue, prophecy, and promise here — so nothing you set up
          gets forgotten before it pays off.
        </EmptyState>
      )}

      {GROUPS.map((group) => {
        const threads = project.threads.filter((t) => t.status === group.status)
        if (threads.length === 0) return null
        return (
          <div key={group.status} className="br-thread-group">
            <div className="br-group-head">
              <span className={`tag ${group.tag}`}>{group.label} · {threads.length}</span>
              <span className="faint" style={{ fontSize: 12.5 }}>{group.blurb}</span>
            </div>
            <div className="br-thread-stack">
              {threads.map((t) => (
                <div key={t.id} className="card">
                  <div className="grid-2">
                    <Field label="Title">
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => edit(t.id, (th) => { th.title = e.target.value })}
                      />
                    </Field>
                    <div className="grid-2">
                      <Field label="Kind">
                        <select
                          value={t.kind}
                          onChange={(e) => edit(t.id, (th) => { th.kind = e.target.value as ThreadKind })}
                        >
                          {THREAD_KINDS.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Chapter Introduced">
                        <input
                          type="text"
                          placeholder="Ch. 3"
                          value={t.chapterIntroduced}
                          onChange={(e) => edit(t.id, (th) => { th.chapterIntroduced = e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="grid-2">
                    <Field label="Setup" hint="What was planted, and where.">
                      <textarea
                        rows={3}
                        value={t.setup}
                        onChange={(e) => edit(t.id, (th) => { th.setup = e.target.value })}
                      />
                    </Field>
                    <Field label="Payoff Notes" hint="How it pays off — or why it was cut.">
                      <textarea
                        rows={3}
                        value={t.payoffNotes}
                        onChange={(e) => edit(t.id, (th) => { th.payoffNotes = e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="row between wrap">
                    <div className="row wrap">
                      {t.status !== 'paidoff' && (
                        <button
                          className="btn small"
                          onClick={() => edit(t.id, (th) => { th.status = 'paidoff' })}
                        >
                          ✓ Mark Paid Off
                        </button>
                      )}
                      {t.status !== 'open' && (
                        <button
                          className="btn small"
                          onClick={() => edit(t.id, (th) => { th.status = 'open' })}
                        >
                          ↺ Reopen
                        </button>
                      )}
                      {t.status !== 'abandoned' && (
                        <button
                          className="btn small ghost"
                          onClick={() => edit(t.id, (th) => { th.status = 'abandoned' })}
                        >
                          Abandon
                        </button>
                      )}
                    </div>
                    <button
                      className="btn small ghost danger"
                      onClick={() =>
                        updateProject(project.id, (d) => {
                          d.threads = d.threads.filter((th) => th.id !== t.id)
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="panel" style={{ marginTop: 8 }}>
        <div className="panel-head">
          <span className="kicker">AI · Suggest Payoffs</span>
          <div className="row">
            {suggest.text && !suggest.busy && <CopyButton text={suggest.text} />}
            {suggest.busy ? (
              <button className="btn small" onClick={suggest.stop}>■ Stop</button>
            ) : (
              <button
                className="btn small primary"
                disabled={openCount === 0}
                onClick={suggestPayoffs}
              >
                ✦ Suggest Payoffs {openCount > 0 ? `(${openCount} open)` : ''}
              </button>
            )}
          </div>
        </div>
        <div className="panel-body">
          <ErrorBanner error={suggest.error} />
          {suggest.text || suggest.busy ? (
            <StreamView text={suggest.text} busy={suggest.busy} />
          ) : (
            <p className="faint" style={{ fontSize: 13.5 }}>
              {openCount === 0
                ? 'No open threads — plant something first.'
                : 'Sends your open threads and the recent manuscript to the AI for concrete payoff ideas.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
