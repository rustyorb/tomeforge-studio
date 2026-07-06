import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { FORGE_TOOLS } from '../forgebench/tools'

/** Other UI can dispatch this window event to open the palette. */
export const OPEN_PALETTE_EVENT = 'tf-open-palette'

const GROUP_CAP = 6

const PAGES: { to: string; glyph: string; name: string; keywords: string }[] = [
  { to: '/', glyph: '◈', name: 'Projects', keywords: 'home dashboard tomes' },
  { to: '/write', glyph: '✒', name: 'Manuscript', keywords: 'write editor scene chapter prose' },
  { to: '/brain', glyph: '⁂', name: 'Story Brain', keywords: 'codex canon character thread timeline memory' },
  { to: '/forgebench', glyph: '⚒', name: 'Forgebench', keywords: 'tools workbench generate' },
  { to: '/quest', glyph: '⚔', name: 'StoryQuest', keywords: 'adventure rpg play game' },
  { to: '/voiceprint', glyph: '❦', name: 'Voiceprint', keywords: 'style voice profile' },
  { to: '/insights', glyph: '◍', name: 'Insights', keywords: 'stats analytics words observatory' },
  { to: '/export', glyph: '⇲', name: 'Export & Backup', keywords: 'download markdown backup save' },
  { to: '/settings', glyph: '⚙', name: 'Settings', keywords: 'api key provider model theme appearance' },
]

interface PaletteItem {
  key: string
  glyph: string
  title: string
  sub?: string
  frag?: string
  run: () => void
}

interface PaletteGroup {
  label: string
  items: PaletteItem[]
  /** How many matches were cut by the group cap */
  more: number
}

/** Every whitespace-separated token must appear in the haystack. */
function tokenMatch(haystack: string, tokens: string[]): boolean {
  return tokens.every((t) => haystack.includes(t))
}

/** A short text excerpt around the first matched token. */
function fragmentAround(text: string, tokens: string[]): string {
  const lower = text.toLowerCase()
  let idx = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i >= 0) {
      idx = i
      break
    }
  }
  if (idx < 0) return text.slice(0, 70).replace(/\s+/g, ' ')
  const start = Math.max(0, idx - 28)
  const end = Math.min(text.length, idx + 48)
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end).replace(/\s+/g, ' ') +
    (end < text.length ? '…' : '')
  )
}

function capGroup(label: string, items: PaletteItem[]): PaletteGroup {
  return {
    label,
    items: items.slice(0, GROUP_CAP),
    more: Math.max(0, items.length - GROUP_CAP),
  }
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const navigate = useNavigate()
  const projects = useStore((s) => s.projects)
  const activeProjectId = useStore((s) => s.activeProjectId)
  const setActiveProject = useStore((s) => s.setActiveProject)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Global open/close triggers — attached once, cleaned up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent)
    }
  }, [])

  // Fresh query + focus each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      inputRef.current?.focus()
    }
  }, [open])

  const groups = useMemo<PaletteGroup[]>(() => {
    const q = query.trim().toLowerCase()
    const tokens = q ? q.split(/\s+/) : []
    const close = () => setOpen(false)
    const out: PaletteGroup[] = []

    // Pages
    const pageItems = PAGES.filter(
      (p) => !tokens.length || tokenMatch(`${p.name} ${p.keywords}`.toLowerCase(), tokens),
    ).map<PaletteItem>((p) => ({
      key: `page:${p.to}`,
      glyph: p.glyph,
      title: p.name,
      sub: 'page',
      run: () => {
        navigate(p.to)
        close()
      },
    }))
    if (pageItems.length) out.push({ label: 'Pages', items: pageItems, more: 0 })

    // Projects
    const projectItems = projects
      .filter((p) => !tokens.length || tokenMatch(p.name.toLowerCase(), tokens))
      .map<PaletteItem>((p) => ({
        key: `project:${p.id}`,
        glyph: '◈',
        title: `Open — ${p.name}`,
        sub: p.genre || 'project',
        run: () => {
          setActiveProject(p.id)
          navigate('/write')
          close()
        },
      }))
    if (projectItems.length) out.push(capGroup('Projects', projectItems))

    if (!tokens.length) return out

    // Forge tools (query only)
    const toolItems = FORGE_TOOLS.filter((t) =>
      tokenMatch(`${t.name} ${t.category} ${t.description}`.toLowerCase(), tokens),
    ).map<PaletteItem>((t) => ({
      key: `tool:${t.id}`,
      glyph: t.glyph,
      title: `${t.name} — ${t.category}`,
      sub: 'forge tool',
      run: () => {
        if (activeProjectId) {
          sessionStorage.setItem('tf-open-tool', t.id)
          window.dispatchEvent(new CustomEvent('tf-open-tool', { detail: t.id }))
          navigate('/forgebench')
        } else {
          navigate('/')
        }
        close()
      },
    }))
    if (toolItems.length) out.push(capGroup('Forge Tools', toolItems))

    // Full-text search across projects (query length >= 2)
    if (q.length >= 2) {
      const sceneItems: PaletteItem[] = []
      const codexItems: PaletteItem[] = []
      const charItems: PaletteItem[] = []

      for (const project of projects) {
        for (const chapter of project.chapters) {
          for (const scene of chapter.scenes) {
            if (!tokenMatch(`${scene.title} ${scene.content}`.toLowerCase(), tokens)) continue
            sceneItems.push({
              key: `scene:${project.id}:${scene.id}`,
              glyph: '❝',
              title: `${scene.title} — ${chapter.title}, ${project.name}`,
              frag: fragmentAround(scene.content, tokens),
              run: () => {
                setActiveProject(project.id)
                sessionStorage.setItem('tf-select-scene', scene.id)
                window.dispatchEvent(new CustomEvent('tf-select-scene', { detail: scene.id }))
                navigate('/write')
                setOpen(false)
              },
            })
          }
        }
        for (const entry of project.codex) {
          const hay = `${entry.name} ${entry.aliases.join(' ')} ${entry.content}`.toLowerCase()
          if (!tokenMatch(hay, tokens)) continue
          codexItems.push({
            key: `codex:${project.id}:${entry.id}`,
            glyph: '⁂',
            title: `${entry.name} — ${entry.type}, ${project.name}`,
            frag: fragmentAround(entry.content, tokens),
            run: () => {
              setActiveProject(project.id)
              navigate('/brain')
              setOpen(false)
            },
          })
        }
        for (const character of project.characters) {
          if (!tokenMatch(character.name.toLowerCase(), tokens)) continue
          charItems.push({
            key: `char:${project.id}:${character.id}`,
            glyph: '☙',
            title: `${character.name} — ${project.name}`,
            sub: 'character',
            run: () => {
              setActiveProject(project.id)
              navigate('/brain')
              setOpen(false)
            },
          })
        }
      }

      if (sceneItems.length) out.push(capGroup('Scenes', sceneItems))
      if (codexItems.length) out.push(capGroup('Codex', codexItems))
      if (charItems.length) out.push(capGroup('Characters', charItems))
    }

    return out
  }, [query, projects, activeProjectId, setActiveProject, navigate])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Keep the highlight in range as results change.
  useEffect(() => {
    setHighlight(0)
  }, [query])

  // Keyboard navigation while open. Only special keys are intercepted —
  // plain typing goes to the input untouched.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, Math.max(0, flat.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        flat[highlight]?.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, highlight])

  // Keep the highlighted row visible.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  if (!open) return null

  let idx = -1
  return (
    <>
      <div className="pal-backdrop" onClick={() => setOpen(false)} />
      <div className="pal-panel" role="dialog" aria-label="Command deck">
        <input
          ref={inputRef}
          className="pal-input"
          type="text"
          placeholder="Search pages, projects, tools, scenes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="pal-list" ref={listRef}>
          {flat.length === 0 && <div className="pal-empty">Nothing in the archive matches.</div>}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="pal-group">{group.label}</div>
              {group.items.map((item) => {
                idx += 1
                const i = idx
                return (
                  <div
                    key={item.key}
                    className={`pal-item ${i === highlight ? 'active' : ''}`}
                    data-active={i === highlight || undefined}
                    onMouseMove={() => setHighlight(i)}
                    onClick={item.run}
                  >
                    <span className="pal-glyph">{item.glyph}</span>
                    <span className="pal-body">
                      <span className="pal-title" style={{ display: 'block' }}>{item.title}</span>
                      {item.frag && <span className="pal-frag" style={{ display: 'block' }}>{item.frag}</span>}
                    </span>
                    {item.sub && <span className="pal-sub">{item.sub}</span>}
                  </div>
                )
              })}
              {group.more > 0 && <div className="pal-more">+{group.more} more — refine your search</div>}
            </div>
          ))}
        </div>
        <div className="pal-footer">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  )
}
