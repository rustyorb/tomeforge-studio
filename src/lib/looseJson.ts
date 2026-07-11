/** Forgiving JSON reader: fenced block (any tag), raw text, or bracket scan. */
export function looseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  for (const candidate of [fenced?.[1], text]) {
    if (!candidate) continue
    const trimmed = candidate.trim()
    try {
      return JSON.parse(trimmed)
    } catch {
      /* try bracket scan */
    }
    const start = trimmed.search(/[[{]/)
    if (start >= 0) {
      const end = trimmed.lastIndexOf(trimmed[start] === '[' ? ']' : '}')
      if (end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1))
        } catch {
          /* keep trying */
        }
      }
    }
  }
  return null
}
