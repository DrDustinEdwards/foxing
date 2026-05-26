/**
 * Pure textarea utilities used by the journal editor toolbar. No
 * imports, no side effects: every function takes a serialisable
 * selection snapshot and returns the next snapshot the caller can
 * apply with setState + setSelectionRange.
 */

export interface SelectionState {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function wrapSelection(
  s: SelectionState,
  prefix: string,
  suffix: string,
  placeholder: string,
): SelectionState {
  const before = s.value.slice(0, s.selectionStart)
  const selected = s.value.slice(s.selectionStart, s.selectionEnd)
  const after = s.value.slice(s.selectionEnd)
  const inner = selected.length > 0 ? selected : placeholder
  const value = `${before}${prefix}${inner}${suffix}${after}`
  const start = before.length + prefix.length
  const end = start + inner.length
  return { value, selectionStart: start, selectionEnd: end }
}

export function replaceSelection(
  s: SelectionState,
  replacement: string,
  selectInReplacement?: { start: number; end: number },
): SelectionState {
  const before = s.value.slice(0, s.selectionStart)
  const after = s.value.slice(s.selectionEnd)
  const value = `${before}${replacement}${after}`
  if (selectInReplacement) {
    const start = before.length + selectInReplacement.start
    const end = before.length + selectInReplacement.end
    return { value, selectionStart: start, selectionEnd: end }
  }
  const cursor = before.length + replacement.length
  return { value, selectionStart: cursor, selectionEnd: cursor }
}

/**
 * Insert a block-level snippet at the cursor, padding with blank lines
 * so the inserted block does not collide with adjacent prose. Cursor
 * lands at `cursorOffset` characters into the inserted block.
 */
export function insertBlock(
  s: SelectionState,
  block: string,
  cursorOffset: number,
): SelectionState {
  const before = s.value.slice(0, s.selectionStart)
  const after = s.value.slice(s.selectionEnd)

  let lead = ''
  if (before.length > 0) {
    if (before.endsWith('\n\n')) lead = ''
    else if (before.endsWith('\n')) lead = '\n'
    else lead = '\n\n'
  }

  let trail = ''
  if (after.length > 0) {
    if (after.startsWith('\n\n')) trail = ''
    else if (after.startsWith('\n')) trail = '\n'
    else trail = '\n\n'
  } else {
    trail = '\n'
  }

  const insert = `${lead}${block}${trail}`
  const value = `${before}${insert}${after}`
  const cursor = before.length + lead.length + cursorOffset
  return { value, selectionStart: cursor, selectionEnd: cursor }
}

/**
 * Prefix every line touched by the selection. If nothing is selected
 * the prefix is applied to the line under the cursor. Useful for
 * blockquote (>), list bullets (-), etc.
 */
export function prefixLines(
  s: SelectionState,
  prefix: string,
): SelectionState {
  const before = s.value.slice(0, s.selectionStart)
  const lineStart = before.lastIndexOf('\n') + 1
  const tailIndex = s.value.indexOf('\n', s.selectionEnd)
  const lineEnd = tailIndex === -1 ? s.value.length : tailIndex
  const block = s.value.slice(lineStart, lineEnd)
  const prefixed = block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
  const value =
    s.value.slice(0, lineStart) + prefixed + s.value.slice(lineEnd)
  const delta = prefixed.length - block.length
  return {
    value,
    selectionStart: s.selectionStart + prefix.length,
    selectionEnd: s.selectionEnd + delta,
  }
}

/**
 * Pull a YouTube video id out of any of the common URL shapes, or
 * return the raw 11-char id if the user pasted just that.
 */
export function extractYouTubeId(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  let m = /youtu\.be\/([A-Za-z0-9_-]{11})/.exec(s)
  if (m) return m[1]
  m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(s)
  if (m) return m[1]
  m = /youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/.exec(s)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  return null
}
