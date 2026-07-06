// RTF export — opens directly in Word, LibreOffice, Google Docs.

import type { Project } from '../../types'

/** Escape RTF control chars and encode non-ASCII as \uN? escapes. */
function escapeRtf(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch
    else if (ch === '\n') out += '\\line '
    else if (code < 128) out += ch
    else if (code <= 0x7fff) out += `\\u${code}?`
    else {
      // Supplementary plane: RTF wants signed 16-bit surrogate pair values.
      const high = 0xd800 + ((code - 0x10000) >> 10)
      const low = 0xdc00 + ((code - 0x10000) & 0x3ff)
      out += `\\u${high - 0x10000}?\\u${low - 0x10000}?`
    }
  }
  return out
}

/** Paragraph blocks from double newlines. */
function blocks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}

export function projectToRtf(project: Project, opts: { author?: string } = {}): string {
  const parts: string[] = []
  parts.push('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Georgia;}}\\f0\\fs28')

  // Title page
  parts.push(`{\\qc\\b\\fs52 ${escapeRtf(project.name)}\\par}`)
  if (opts.author) parts.push(`{\\qc\\fs30 by ${escapeRtf(opts.author)}\\par}`)
  if (project.genre) parts.push(`{\\qc\\i\\fs26 ${escapeRtf(project.genre)}\\par}`)

  for (const chapter of project.chapters) {
    parts.push('\\page')
    parts.push(`{\\b\\fs38 ${escapeRtf(chapter.title)}\\par}`)
    parts.push('{\\fs28\\par}')
    chapter.scenes.forEach((scene, i) => {
      if (i > 0) parts.push('{\\qc\\fs28 * * *\\par}{\\fs28\\par}')
      for (const block of blocks(scene.content)) {
        parts.push(`{\\fi360\\sa120 ${escapeRtf(block)}\\par}`)
      }
    })
  }

  parts.push('}')
  return parts.join('\n')
}
