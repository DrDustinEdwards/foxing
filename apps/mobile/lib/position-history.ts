// Per-book position history, the last 50 unique reading positions, persisted
// to AsyncStorage so a swipe-back gesture or the GoTo > History tab can take
// the user to where they were. Keyed by bookId so multiple books don't share
// a single timeline.

import AsyncStorage from '@react-native-async-storage/async-storage'

export interface PositionEntry {
  cfi: string
  chapter: string | null
  timestamp: number
  progress: number
}

const KEY_PREFIX = 'foxing.position-history.'
const MAX_ENTRIES = 50

function key(bookId: string): string {
  return `${KEY_PREFIX}${bookId}`
}

export async function loadHistory(bookId: string): Promise<PositionEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(key(bookId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PositionEntry[]
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : []
  } catch {
    return []
  }
}

export async function saveHistory(bookId: string, history: PositionEntry[]): Promise<void> {
  try {
    const trimmed = history.slice(-MAX_ENTRIES)
    await AsyncStorage.setItem(key(bookId), JSON.stringify(trimmed))
  } catch (e) {
    console.warn('[position-history] save failed:', e instanceof Error ? e.message : e)
  }
}

export async function clearHistory(bookId: string): Promise<void> {
  try { await AsyncStorage.removeItem(key(bookId)) } catch {}
}

// Append an entry; if the new entry has the same CFI as the current tail,
// refresh that entry in place instead of growing the list. Keeps the
// history a meaningful list of distinct positions rather than every tick.
export function appendEntry(history: PositionEntry[], entry: PositionEntry): PositionEntry[] {
  const last = history[history.length - 1]
  if (last && last.cfi === entry.cfi) {
    const out = history.slice(0, -1)
    out.push(entry)
    return out
  }
  return [...history, entry].slice(-MAX_ENTRIES)
}
