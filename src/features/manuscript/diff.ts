// Word-level diff for the Scene Time Machine, via classic LCS. Capped so a
// pathological scene can't freeze the UI — callers check `tooLarge`.

export interface DiffPart {
  kind: 'same' | 'add' | 'del'
  text: string
}

const MAX_WORDS = 1800

export function wordDiff(oldText: string, newText: string):
  | { tooLarge: true }
  | { tooLarge: false; parts: DiffPart[]; added: number; removed: number } {
  const a = oldText.split(/(\s+)/).filter((t) => t.length)
  const b = newText.split(/(\s+)/).filter((t) => t.length)
  if (a.length > MAX_WORDS * 2 || b.length > MAX_WORDS * 2) return { tooLarge: true }

  // LCS table (small enough at the cap: ~3600² is too big — use word tokens only,
  // whitespace glued onto the preceding word instead).
  const aw = tokenize(oldText)
  const bw = tokenize(newText)
  if (aw.length > MAX_WORDS || bw.length > MAX_WORDS) return { tooLarge: true }

  const n = aw.length
  const m = bw.length
  const dp = new Uint16Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] =
        aw[i] === bw[j]
          ? dp[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) last.text += text
    else parts.push({ kind, text })
  }
  let i = 0
  let j = 0
  let added = 0
  let removed = 0
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      push('same', aw[i])
      i++
      j++
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
      push('del', aw[i])
      removed++
      i++
    } else {
      push('add', bw[j])
      added++
      j++
    }
  }
  while (i < n) {
    push('del', aw[i++])
    removed++
  }
  while (j < m) {
    push('add', bw[j++])
    added++
  }
  return { tooLarge: false, parts, added, removed }
}

/** Words with their trailing whitespace attached, so joins reconstruct text. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}
