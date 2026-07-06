// ---------- Self-contained book HTML export (pure functions, no React) ----------

import type { Project } from '../../types'

/**
 * Escape user text for embedding in HTML. Also XML-safe (used by the EPUB
 * builder): &, <, >, double and single quotes.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Convert prose to paragraph markup: double-newline blocks become <p>,
 * single newlines within a block become <br/>. All text escaped.
 * Output is valid XHTML (self-closed tags).
 */
export function textToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

export interface HtmlOptions {
  author: string
}

const BOOK_CSS = `
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #f6f1e7;
    color: #241d16;
    font-family: Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
    font-size: 1.05rem;
    line-height: 1.75;
  }
  .book { max-width: 65ch; margin: 0 auto; padding: 3rem 1.5rem 6rem; }
  .title-page { text-align: center; padding: 20vh 0 14vh; page-break-after: always; }
  .title-page h1 { font-size: 2.6rem; font-weight: normal; letter-spacing: 0.02em; margin: 0 0 1.2rem; }
  .title-page .author { font-style: italic; font-size: 1.15rem; margin: 0 0 0.6rem; }
  .title-page .genre { text-transform: uppercase; letter-spacing: 0.3em; font-size: 0.72rem; opacity: 0.6; margin: 0; }
  .chapter { page-break-before: always; break-before: page; margin-top: 5rem; }
  .chapter h2 { text-align: center; font-size: 1.45rem; font-weight: normal; margin: 0 0 2.4rem; }
  .chapter p { margin: 0; text-indent: 1.6em; text-align: justify; hyphens: auto; }
  .chapter h2 + p, .scene-break + p { text-indent: 0; }
  .scene-break { text-align: center; margin: 2rem 0; opacity: 0.7; }
  @media print { body { background: #fff; } }
`

/** Compile the manuscript to a single self-contained styled HTML document. */
export function projectToHtml(project: Project, opts: HtmlOptions): string {
  const title = project.name.trim() || 'Untitled'
  const author = opts.author.trim() || 'TomeForge Author'

  const chapters = project.chapters
    .map((ch) => {
      const scenes = ch.scenes
        .map((sc) => textToParagraphs(sc.content))
        .filter(Boolean)
      return [
        '<section class="chapter">',
        `<h2>${escapeHtml(ch.title)}</h2>`,
        scenes.join('\n<div class="scene-break" role="separator">⁂</div>\n'),
        '</section>',
      ].join('\n')
    })
    .join('\n')

  const genreLine = project.genre.trim()
    ? `\n<p class="genre">${escapeHtml(project.genre.trim())}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${BOOK_CSS}</style>
</head>
<body>
<main class="book">
<header class="title-page">
<h1>${escapeHtml(title)}</h1>
<p class="author">${escapeHtml(author)}</p>${genreLine}
</header>
${chapters}
</main>
</body>
</html>
`
}
