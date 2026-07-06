// ---------- Browser download helpers (pure DOM, no React) ----------

/** Turn an arbitrary name into a safe, lowercase filename slug. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics left by NFKD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

/** Trigger a browser download of a Blob via a temporary object URL. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the download has had a moment to start.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Trigger a browser download of a text file with the given MIME type. */
export function downloadText(name: string, text: string, mime: string): void {
  downloadBlob(name, new Blob([text], { type: `${mime};charset=utf-8` }))
}
