// ---------- EPUB 3 export via jszip (pure functions, no React) ----------

import JSZip from 'jszip'
import type { Chapter, Project } from '../../types'
import { escapeHtml, textToParagraphs } from './html'

export interface EpubOptions {
  author: string
}

/** RFC 4122 v4 UUID from crypto.getRandomValues (no external deps). */
function uuidv4(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** dcterms:modified requires CCYY-MM-DDThh:mm:ssZ (no fractional seconds). */
function modifiedNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`

const STYLE_CSS = `body {
  font-family: Georgia, 'Palatino Linotype', 'Book Antiqua', serif;
  line-height: 1.6;
  margin: 1em;
}
h1 {
  text-align: center;
  font-size: 1.4em;
  font-weight: normal;
  margin: 2em 0 1.8em;
}
p {
  margin: 0;
  text-indent: 1.4em;
  text-align: justify;
}
h1 + p, hr.scene-break + p { text-indent: 0; }
hr.scene-break {
  border: 0;
  border-top: 1px solid #999;
  width: 20%;
  margin: 1.6em auto;
}
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.5em 0; }
`

function contentOpf(title: string, author: string, chapters: Chapter[]): string {
  const items = chapters
    .map(
      (_, i) =>
        `    <item id="chapter-${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join('\n')
  const refs = chapters
    .map((_, i) => `    <itemref idref="chapter-${i + 1}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuidv4()}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modifiedNow()}</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
${items}
  </manifest>
  <spine>
    <itemref idref="cover"/>
${refs}
  </spine>
</package>
`
}

const COVER_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Cover</title>
  <style type="text/css">body { margin: 0; text-align: center; } img { max-width: 100%; height: auto; }</style>
</head>
<body>
  <img src="cover.png" alt="Cover"/>
</body>
</html>
`

const COVER_PALETTE = ['#e0763a', '#c9a35c', '#6fae9b', '#a34434', '#5b6ee1', '#9a5b8f']

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** Word-wrap canvas text into lines that fit maxWidth. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 6)
}

/** Paint a 1200×1800 book cover: layered gradients, typeset title/author. */
async function bookCoverPng(title: string, author: string, genre: string): Promise<Uint8Array> {
  const W = 1200
  const H = 1800
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const h = hashStr(title)
  const c1 = COVER_PALETTE[h % COVER_PALETTE.length]
  let i2 = (h >> 3) % COVER_PALETTE.length
  if (COVER_PALETTE[i2] === c1) i2 = (i2 + 1) % COVER_PALETTE.length
  const c2 = COVER_PALETTE[i2]

  const grad = ctx.createLinearGradient(0, 0, W * 0.4, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, '#100d0a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.72, H * 0.3, 60, W * 0.72, H * 0.3, 900)
  glow.addColorStop(0, c2 + 'bb')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // Frame rule
  ctx.strokeStyle = 'rgba(233, 224, 205, 0.35)'
  ctx.lineWidth = 3
  ctx.strokeRect(70, 70, W - 140, H - 140)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(233, 224, 205, 0.7)'
  ctx.font = '600 34px monospace'
  if (genre) ctx.fillText(genre.toUpperCase().split('').join('  '), W / 2, 230)

  ctx.fillStyle = 'rgba(238, 230, 214, 0.97)'
  ctx.font = '600 108px Georgia, serif'
  const lines = wrapText(ctx, title, W - 260)
  const startY = H * 0.42 - ((lines.length - 1) * 128) / 2
  lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * 128))

  ctx.fillStyle = 'rgba(233, 224, 205, 0.85)'
  ctx.font = '52px Georgia, serif'
  ctx.fillText(author, W / 2, H - 200)

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not render the cover.')
  return new Uint8Array(await blob.arrayBuffer())
}

function navXhtml(title: string, chapters: Chapter[]): string {
  const links = chapters
    .map(
      (ch, i) =>
        `      <li><a href="chapter-${i + 1}.xhtml">${escapeHtml(ch.title)}</a></li>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHtml(title)} — Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${links}
    </ol>
  </nav>
</body>
</html>
`
}

function chapterXhtml(chapter: Chapter): string {
  const scenes = chapter.scenes
    .map((sc) => textToParagraphs(sc.content))
    .filter(Boolean)
  const body = scenes.join('\n<hr class="scene-break"/>\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeHtml(chapter.title)}</h1>
${body}
</body>
</html>
`
}

/** Build a valid EPUB 3 file for the project's manuscript. */
export async function projectToEpub(project: Project, opts: EpubOptions): Promise<Blob> {
  const title = project.name.trim() || 'Untitled'
  const author = opts.author.trim() || 'TomeForge Author'
  // A spine needs at least one document; give empty projects a placeholder.
  const chapters: Chapter[] =
    project.chapters.length > 0
      ? project.chapters
      : [{ id: 'placeholder', title, scenes: [] }]

  const cover = await bookCoverPng(title, author, project.genre)

  const zip = new JSZip()
  // Per the OCF spec, 'mimetype' must be the first entry and stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', CONTAINER_XML)
  zip.file('OEBPS/content.opf', contentOpf(title, author, chapters))
  zip.file('OEBPS/nav.xhtml', navXhtml(title, chapters))
  zip.file('OEBPS/style.css', STYLE_CSS)
  zip.file('OEBPS/cover.png', cover)
  zip.file('OEBPS/cover.xhtml', COVER_XHTML)
  chapters.forEach((ch, i) => {
    zip.file(`OEBPS/chapter-${i + 1}.xhtml`, chapterXhtml(ch))
  })

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
  })
}
