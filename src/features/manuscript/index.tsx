import { useEffect, useRef, useState } from 'react'
import type { ID, Project } from '../../types'
import { useActiveProject, useProjectStyle, useStore } from '../../store/useStore'
import { EmptyState, ErrorBanner } from '../../components/ui'
import { buildStoryContext, tailOfManuscript } from '../../lib/context'
import { getPreset } from '../../lib/presets'
import { uid } from '../../lib/id'
import SceneTree from './SceneTree'
import FindReplace from './FindReplace'
import PromptPeek from './PromptPeek'
import Corkboard from './Corkboard'
import ReadingMode from './ReadingMode'
import Toolbar from './Toolbar'
import ResultPanels from './ResultPanels'
import RewritePanel from './RewritePanel'
import BranchesPanel from './BranchesPanel'
import FocusMode from './FocusMode'
import GhostEditor from './GhostEditor'
import type { GhostEditorHandle, GhostRequest } from './GhostEditor'
import ReadAloud from './ReadAloud'
import HistoryDrawer from './HistoryDrawer'
import { SprintControl, sprintHudText, useSprint } from './Sprint'
import { useGeneration } from './useGeneration'
import {
  appendToScene,
  findScene,
  firstScene,
  manuscriptWordCount,
  sceneDraft,
  wordCount,
} from './helpers'
import {
  GEN_LABELS,
  GHOST_DIRECTIVE,
  buildDirective,
  buildRewriteDirective,
  excerptFor,
  userMessage,
} from './generation'
import type { GenOverrides, ProseKind } from './generation'
import './manuscript.css'

export default function ManuscriptPage() {
  const project = useActiveProject()
  const styleProfile = useProjectStyle(project)
  const updateProject = useStore((s) => s.updateProject)
  const gen = useGeneration()
  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null)
  const [overrides, setOverrides] = useState<GenOverrides>({ pacing: '', dialogueRatio: null })
  const [rewriteOpen, setRewriteOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [peekOpen, setPeekOpen] = useState(false)
  const [view, setView] = useState<'editor' | 'cork'>('editor')
  const [reading, setReading] = useState(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const ghostRef = useRef<GhostEditorHandle>(null)
  const totalWords = project ? manuscriptWordCount(project) : 0
  const sprintApi = useSprint(totalWords)

  // Deep-link contract: the command palette selects a scene via sessionStorage
  // 'tf-select-scene' (page not yet mounted) or a 'tf-select-scene' window event.
  useEffect(() => {
    const stored = sessionStorage.getItem('tf-select-scene')
    if (stored) {
      sessionStorage.removeItem('tf-select-scene')
      setSelectedSceneId(stored)
    }
    const onEvent = (e: Event) => {
      // Consume the storage copy too — dispatchers write both, and a stale
      // key would hijack scene selection on the next mount.
      sessionStorage.removeItem('tf-select-scene')
      setSelectedSceneId((e as CustomEvent<string>).detail)
    }
    window.addEventListener('tf-select-scene', onEvent)
    return () => window.removeEventListener('tf-select-scene', onEvent)
  }, [])

  if (!project) {
    return (
      <div className="page">
        <header className="page-header rise">
          <div className="kicker">The Workshop</div>
          <h1>Manuscript</h1>
        </header>
        <EmptyState glyph="✒" title="No tome open">
          Choose a project from the Dashboard to begin co-writing.
        </EmptyState>
      </div>
    )
  }

  const mutate = (recipe: (draft: Project) => void) => updateProject(project.id, recipe)
  const current = findScene(project, selectedSceneId) ?? firstScene(project)
  const preset = getPreset(project.presetId)

  const buildSystem = (taskDirective: string) =>
    buildStoryContext(project, styleProfile, {
      recentText: tailOfManuscript(project),
      taskDirective,
      presetId: project.presetId,
    })

  const setSceneContent = (sceneId: ID, v: string) =>
    mutate((d) => {
      const sc = sceneDraft(d, sceneId)
      if (sc) sc.content = v
    })

  /** Ghost continuation: same context assembly as Continue, short and capped. */
  const buildGhostRequest = (): GhostRequest => ({
    system: buildSystem(GHOST_DIRECTIVE),
    user: userMessage(
      'continue',
      current ? excerptFor(project, current.scene.content) : '',
      current?.scene.title ?? '',
      current?.chapter.title ?? '',
    ),
    temperature: preset.temperature,
  })

  /** Tab-accept: snapshot, then append the ghost exactly as previewed. */
  const acceptGhost = (sceneId: ID, ghostText: string) => {
    useStore.getState().snapshotScene(project.id, sceneId, 'Before ghost accept')
    mutate((d) => {
      const sc = sceneDraft(d, sceneId)
      if (sc) sc.content = sc.content + ghostText
    })
  }

  const runProse = (kind: ProseKind) => {
    if (!current) return
    setReplaceError(null)
    setAcceptError(null)
    const system = buildSystem(buildDirective(kind, overrides))
    const user = userMessage(
      kind,
      excerptFor(project, current.scene.content),
      current.scene.title,
      current.chapter.title,
    )
    if (kind === 'fork') {
      gen.run(
        'fork',
        current.scene.id,
        ['Fork A', 'Fork B', 'Fork C'].map((label) => ({
          label,
          system,
          user,
          temperature: 1.0,
        })),
      )
    } else {
      gen.run(kind, current.scene.id, [
        { label: GEN_LABELS[kind], system, user, temperature: preset.temperature },
      ])
    }
  }

  const runRewrite = (target: 'scene' | 'passage', passage: string, instruction: string) => {
    if (!current) return
    setReplaceError(null)
    const original = target === 'scene' ? current.scene.content : passage
    const system = buildSystem(buildRewriteDirective(target, instruction, overrides))
    gen.run(
      'rewrite',
      current.scene.id,
      [{ label: 'Rewrite', system, user: original, temperature: preset.temperature }],
      { target, original, instruction },
    )
  }

  /** Append a finished generation to the scene it was started from. */
  const acceptSlot = (i: number) => {
    const job = gen.job
    if (!job) return
    const text = job.slots[i].text.trim()
    if (text) {
      if (!findScene(project, job.sceneId)) {
        setAcceptError(
          'The source scene no longer exists — nothing was appended. Save the result as a branch instead.',
        )
        return
      }
      useStore.getState().snapshotScene(project.id, job.sceneId, 'Before accept')
      mutate((d) => {
        const sc = sceneDraft(d, job.sceneId)
        if (sc) sc.content = appendToScene(sc.content, text)
      })
    }
    setAcceptError(null)
    gen.dismissSlot(i)
  }

  const saveBranch = (i: number, name: string) => {
    const job = gen.job
    if (!job) return
    const slot = job.slots[i]
    if (!slot || !slot.text.trim()) return
    const source = findScene(project, job.sceneId)
    const noteBits = [
      `Saved from ${slot.label}`,
      source ? `in "${source.scene.title}"` : '',
      job.rewrite?.instruction ? `— "${job.rewrite.instruction}"` : '',
    ].filter(Boolean)
    mutate((d) => {
      d.branches.push({
        id: uid(),
        name: name.trim() || `${slot.label} branch`,
        createdAt: Date.now(),
        sourceSceneId: job.sceneId,
        content: slot.text.trim(),
        note: noteBits.join(' '),
      })
    })
    gen.dismissSlot(i)
  }

  /** Explicit Replace for rewrites — the only path that touches the original. */
  const applyRewrite = () => {
    const job = gen.job
    if (!job?.rewrite) return
    const text = job.slots[0]?.text.trim()
    if (!text) return
    const { target, original } = job.rewrite
    const source = findScene(project, job.sceneId)
    if (!source) {
      setReplaceError('The source scene no longer exists. Nothing was replaced.')
      return
    }
    if (target === 'passage' && !source.scene.content.includes(original)) {
      setReplaceError(
        'The original passage was not found in the scene (it may have been edited since). Nothing was replaced.',
      )
      return
    }
    if (target === 'passage') {
      const occurrences = source.scene.content.split(original).length - 1
      if (occurrences > 1) {
        setReplaceError(
          `That passage appears ${occurrences} times in the scene — include more surrounding text so the right one is replaced. Nothing was replaced.`,
        )
        return
      }
    }
    useStore.getState().snapshotScene(project.id, job.sceneId, 'Before rewrite')
    mutate((d) => {
      const sc = sceneDraft(d, job.sceneId)
      if (!sc) return
      // Replacer function so `$&`/`$$` in generated prose aren't treated
      // as replacement patterns.
      sc.content = target === 'scene' ? text : sc.content.replace(original, () => text)
    })
    gen.dismiss()
    setRewriteOpen(false)
    setReplaceError(null)
  }

  const showRewritePanel = rewriteOpen || gen.job?.kind === 'rewrite'

  return (
    <div className="page" style={{ maxWidth: 1520 }}>
      <header className="page-header rise">
        <div className="kicker">The Workshop</div>
        <div className="row between wrap">
          <h1>{project.name}</h1>
          <span className="row">
            <button
              className="btn ghost small"
              title="Reading Mode — the manuscript as a book"
              onClick={() => setReading(true)}
            >
              📖 Read
            </button>
            <button
              className="btn ghost small"
              title={view === 'editor' ? 'Corkboard — every scene as a pinned card' : 'Back to the editor'}
              onClick={() => setView((v) => (v === 'editor' ? 'cork' : 'editor'))}
            >
              {view === 'editor' ? '⊞ Corkboard' : '✒ Editor'}
            </button>
            <button className="btn ghost small" onClick={() => setFindOpen(true)}>
              ⌕ Find &amp; Replace
            </button>
            <span className="mono faint">{totalWords.toLocaleString()} words in manuscript</span>
          </span>
        </div>
      </header>

      {findOpen && <FindReplace project={project} onClose={() => setFindOpen(false)} />}

      {reading && <ReadingMode project={project} onClose={() => setReading(false)} />}

      {view === 'cork' && (
        <Corkboard
          project={project}
          mutate={mutate}
          onOpen={(id) => {
            setSelectedSceneId(id)
            setView('editor')
          }}
        />
      )}

      <div className="ms-layout" style={view === 'cork' ? { display: 'none' } : undefined}>
        <aside className="ms-side rise-1">
          <SceneTree
            project={project}
            selectedSceneId={current?.scene.id ?? null}
            onSelect={setSelectedSceneId}
            mutate={mutate}
          />
        </aside>

        <section className="ms-main rise-2">
          {!current ? (
            <EmptyState glyph="§" title="No scenes yet">
              Add a chapter and a scene from the outline on the left to start writing.
            </EmptyState>
          ) : (
            <>
              <Toolbar
                project={project}
                styleProfile={styleProfile}
                overrides={overrides}
                onOverrides={setOverrides}
                busy={gen.busy}
                onRun={runProse}
                onToggleRewrite={() => setRewriteOpen((v) => !v)}
                onStop={gen.stop}
                onFocus={() => setFocusMode(true)}
                onGhost={() => ghostRef.current?.triggerGhost()}
                sprintControl={<SprintControl api={sprintApi} totalWords={totalWords} />}
                mutate={mutate}
                onPeek={() => setPeekOpen(true)}
              />

              {peekOpen && (
                <PromptPeek
                  system={buildSystem(buildDirective('continue', overrides))}
                  onClose={() => setPeekOpen(false)}
                />
              )}

              <div className="panel">
                <div className="panel-head">
                  <input
                    className="ms-title-input"
                    type="text"
                    value={current.scene.title}
                    placeholder="Scene title"
                    onChange={(e) => {
                      const v = e.target.value
                      const id = current.scene.id
                      mutate((d) => {
                        const sc = sceneDraft(d, id)
                        if (sc) sc.title = v
                      })
                    }}
                  />
                  <span className="row" style={{ flexShrink: 0 }}>
                    <span className="mono faint" style={{ whiteSpace: 'nowrap' }}>
                      {wordCount(current.scene.content).toLocaleString()} words this scene
                    </span>
                    <ReadAloud text={current.scene.content} sceneId={current.scene.id} />
                    <HistoryDrawer
                      projectId={project.id}
                      scene={current.scene}
                      mutate={mutate}
                    />
                  </span>
                </div>
                <div className="panel-body">
                  <GhostEditor
                    ref={ghostRef}
                    sceneId={current.scene.id}
                    value={current.scene.content}
                    placeholder="Ink flows here…"
                    variant="page"
                    onChange={(v) => setSceneContent(current.scene.id, v)}
                    buildRequest={buildGhostRequest}
                    onAcceptGhost={(t) => acceptGhost(current.scene.id, t)}
                  />
                </div>
              </div>

              {gen.job && gen.job.kind !== 'rewrite' && (
                <>
                  <ErrorBanner error={acceptError} />
                  <ResultPanels
                    job={gen.job}
                    onAccept={acceptSlot}
                    onSaveBranch={saveBranch}
                    onDiscard={gen.dismissSlot}
                  />
                </>
              )}

              {showRewritePanel && (
                <RewritePanel
                  sceneContent={current.scene.content}
                  job={gen.job?.kind === 'rewrite' ? gen.job : null}
                  busy={gen.busy}
                  replaceError={replaceError}
                  onRun={runRewrite}
                  onReplace={applyRewrite}
                  onSaveBranch={(name) => saveBranch(0, name)}
                  onDiscard={() => {
                    gen.dismiss()
                    setReplaceError(null)
                  }}
                  onClose={() => {
                    setRewriteOpen(false)
                    setReplaceError(null)
                    if (gen.job?.kind === 'rewrite') gen.dismiss()
                  }}
                />
              )}

              <BranchesPanel
                project={project}
                currentChapterId={current.chapter.id}
                mutate={mutate}
                onSelectScene={setSelectedSceneId}
              />

              {focusMode && (
                <FocusMode
                  sceneId={current.scene.id}
                  sceneTitle={current.scene.title}
                  value={current.scene.content}
                  onChange={(v) => setSceneContent(current.scene.id, v)}
                  buildRequest={buildGhostRequest}
                  onAcceptGhost={(t) => acceptGhost(current.scene.id, t)}
                  sprintText={sprintHudText(sprintApi.sprint, totalWords)}
                  onExit={() => setFocusMode(false)}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
