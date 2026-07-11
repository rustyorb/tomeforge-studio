// Import an existing manuscript from plain text / Markdown: split into
// chapters on headings ("# ...", "## ...", "Chapter N", "Part N", "Prologue",
// "Epilogue") and into scenes on horizontal-rule separators (***, ---, ⁂).

export interface ParsedScene {
  title: string
  content: string
}
export interface ParsedChapter {
  title: string
  scenes: ParsedScene[]
}
export interface ParsedManuscript {
  title: string | null
  chapters: ParsedChapter[]
  words: number
}

const CHAPTER_RE =
  /^(?:#{1,3}\s+(.+)|(?:(chapter|part|book)\s+(?:[divxlc]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\b[.:]?\s*(.*))|(prologue|epilogue|interlude)\b[.:]?\s*(.*))$/i

const SCENE_BREAK_RE = /^\s*(?:\*\s*){3,}\s*$|^\s*(?:-\s*){3,}\s*$|^\s*[⁂#]\s*$|^\s*~{3,}\s*$/

function words(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function toScenes(body: string): ParsedScene[] {
  const lines = body.split(/\r?\n/)
  const blocks: string[][] = [[]]
  for (const line of lines) {
    if (SCENE_BREAK_RE.test(line)) blocks.push([])
    else blocks[blocks.length - 1].push(line)
  }
  const scenes = blocks
    .map((b) => b.join('\n').trim())
    .filter(Boolean)
    .map((content, i) => ({ title: `Scene ${i + 1}`, content }))
  return scenes.length ? scenes : [{ title: 'Scene 1', content: body.trim() }]
}

export function parseManuscript(text: string, fallbackTitle: string): ParsedManuscript {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  let bookTitle: string | null = null
  const chapters: { title: string; body: string[] }[] = []
  let current: { title: string; body: string[] } | null = null

  let prevBlank = true // file start counts as a break
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.trim().match(CHAPTER_RE)
    // Markdown headings always count; prose-style headings ("Chapter 2…")
    // only after a blank line, so a sentence starting "Chapter two prose…"
    // mid-paragraph is never mistaken for a heading.
    if (m && line.trim().length <= 90 && (m[1] || prevBlank)) {
      const heading =
        m[1]?.trim() ||
        (m[2] ? line.trim().replace(/[.:]\s*$/, '') : '') ||
        (m[4] ? [m[4], m[5]].filter(Boolean).join(' ').trim() : '') ||
        line.trim()
      // The very first heading before any prose is likely the book title
      // when it's a markdown H1 and no content has appeared yet.
      if (!current && chapters.length === 0 && /^#\s/.test(line.trim()) && bookTitle === null) {
        bookTitle = heading
        continue
      }
      current = { title: heading, body: [] }
      chapters.push(current)
    } else {
      if (!current) {
        current = { title: 'Chapter 1', body: [] }
        chapters.push(current)
      }
      current.body.push(line)
    }
    prevBlank = line.trim() === ''
  }

  const parsed: ParsedChapter[] = chapters
    .map((ch) => ({ title: ch.title, scenes: toScenes(ch.body.join('\n')) }))
    .filter((ch) => ch.scenes.some((s) => s.content.trim()))

  const total = parsed.reduce(
    (n, ch) => n + ch.scenes.reduce((s, sc) => s + words(sc.content), 0),
    0,
  )
  return {
    title: bookTitle ?? (parsed.length ? null : fallbackTitle),
    chapters: parsed.length
      ? parsed
      : [{ title: 'Chapter 1', scenes: [{ title: 'Scene 1', content: text.trim() }] }],
    words: total || words(text),
  }
}
