import type { Project, StyleProfile } from '../../types'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { CopyButton, ErrorBanner, StreamView } from '../../components/ui'
import { useStreamTask } from './useStreamTask'

export default function ContinuityCheckTab(props: {
  project: Project
  styleProfile: StyleProfile | null
}) {
  const { project, styleProfile } = props
  const check = useStreamTask()

  const runCheck = async () => {
    const tail = tailOfManuscript(project, 10000)
    await check.run({
      system: buildStoryContext(project, styleProfile, {
        recentText: tail,
        includeCast: true,
        taskDirective:
          'Act as a meticulous continuity editor. Compare the recent manuscript against the Codex, ' +
          'the Cast Ledger, and the Continuity Core above. List every contradiction you find — wrong ' +
          'character traits, dead characters reappearing, timeline breaks, forgotten injuries, ' +
          'ownership changes, magic rule violations, name inconsistencies — as concise bullets, each ' +
          'prefixed with a severity of [MINOR] or [MAJOR]. If you find none, say the canon holds.',
      }),
      messages: [
        {
          role: 'user',
          content: tail
            ? `RECENT MANUSCRIPT:\n${tail}\n\nRun the continuity check now.`
            : 'The manuscript is empty. Run the continuity check anyway and say so.',
        },
      ],
      temperature: 0.2,
      maxTokens: 1500,
    })
  }

  return (
    <div className="rise" style={{ maxWidth: 780 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>The Auditor</div>
        <p className="muted" style={{ fontSize: 14 }}>
          The continuity check reads the last stretch of your manuscript and audits it against
          everything the Story Brain knows — Codex canon, Cast Ledger states, and the Continuity
          Core. It reports every contradiction it finds as a bullet, graded{' '}
          <span className="tag brass">minor</span> or <span className="tag red">major</span>.
          Nothing is changed; it only reports.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          {check.busy ? (
            <button className="btn" onClick={check.stop}>■ Stop</button>
          ) : (
            <button className="btn primary" onClick={runCheck}>⚖ Run Continuity Check</button>
          )}
          {check.text && !check.busy && <CopyButton text={check.text} label="Copy Report" />}
        </div>
      </div>

      <ErrorBanner error={check.error} />

      {(check.text || check.busy) && (
        <div className="panel">
          <div className="panel-head">
            <span className="kicker">Continuity Report</span>
            {check.busy && <span className="spinner" />}
          </div>
          <div className="panel-body">
            <StreamView text={check.text} busy={check.busy} />
          </div>
        </div>
      )}
    </div>
  )
}
