// Offline write queue, for calls that should land eventually even if the
// device drops connection between tap and round-trip. Stores pending writes
// in AsyncStorage and flushes them in order.
//
// Connection awareness is OPTIONAL, @react-native-community/netinfo gives
// us live transition events when installed. Without it, we fall back to a
// modest polling interval (every 60s) that attempts a flush; the network
// stack will fail fast when offline and we move on.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

type QueueOp = 'insert' | 'upsert' | 'update' | 'delete'

interface QueueItem {
  id: string
  table: string
  op: QueueOp
  data: Record<string, unknown>
  // Optional onConflict hint for upsert.
  onConflict?: string
  // For update/delete, eq filters to apply before the op.
  match?: Record<string, unknown>
  // Wall-clock when the item was enqueued, for debugging + ordering.
  timestamp: string
}

const QUEUE_KEY = 'offline_queue'
const FLUSH_INTERVAL_MS = 60_000

let netInfoUnsub: (() => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let flushing = false

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  } catch (e) {
    console.warn('[offline-queue] write failed:', e instanceof Error ? e.message : e)
  }
}

export async function enqueue(input: {
  table: string
  op: QueueOp
  data: Record<string, unknown>
  onConflict?: string
  match?: Record<string, unknown>
}): Promise<void> {
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    table: input.table,
    op: input.op,
    data: input.data,
    onConflict: input.onConflict,
    match: input.match,
    timestamp: new Date().toISOString(),
  }
  const cur = await readQueue()
  cur.push(item)
  await writeQueue(cur)
  console.log('[offline-queue] enqueued', { table: item.table, op: item.op, queued: cur.length })
}

// Execute a single queue item. Returns true if the write succeeded (and
// should be removed); false to leave it in the queue for the next flush.
async function execItem(item: QueueItem): Promise<boolean> {
  try {
    // We don't try to be clever about Postgrest's overloaded builder
    // types, cast to a thenable that surfaces { error } and we're done.
    type Awaitable = Promise<{ error: { message: string } | null }>
    if (item.op === 'insert') {
      const { error } = await (supabase.from(item.table).insert(item.data) as unknown as Awaitable)
      if (error) throw new Error(error.message)
      return true
    }
    if (item.op === 'upsert') {
      const opts = item.onConflict ? { onConflict: item.onConflict } : undefined
      const { error } = await (supabase.from(item.table).upsert(item.data, opts) as unknown as Awaitable)
      if (error) throw new Error(error.message)
      return true
    }
    if (item.op === 'update') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(item.table).update(item.data)
      for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v)
      const { error } = (await q) as { error: { message: string } | null }
      if (error) throw new Error(error.message)
      return true
    }
    if (item.op === 'delete') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(item.table).delete()
      for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v)
      const { error } = (await q) as { error: { message: string } | null }
      if (error) throw new Error(error.message)
      return true
    }
    return true
  } catch (e) {
    console.warn('[offline-queue] item failed (keeping in queue):', e instanceof Error ? e.message : e)
    return false
  }
}

export async function flush(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const items = await readQueue()
    if (items.length === 0) return
    const remaining: QueueItem[] = []
    for (const item of items) {
      const ok = await execItem(item)
      if (!ok) remaining.push(item)
    }
    if (remaining.length !== items.length) {
      console.log('[offline-queue] flushed', { drained: items.length - remaining.length, remaining: remaining.length })
    }
    await writeQueue(remaining)
  } finally {
    flushing = false
  }
}

// Setup live connection awareness if NetInfo is available; otherwise fall
// back to a polling flush. Safe to call multiple times, cleans up first.
export function startOfflineWatch(): void {
  stopOfflineWatch()
  // Try NetInfo. We accept its absence and fall back to polling.
  type NetInfoModule = {
    addEventListener: (
      cb: (state: { isConnected: boolean | null }) => void,
    ) => () => void
  }
  let NetInfo: NetInfoModule | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NetInfo = require('@react-native-community/netinfo') as NetInfoModule
  } catch {
    NetInfo = null
  }
  if (NetInfo?.addEventListener) {
    let prev: boolean | null = null
    netInfoUnsub = NetInfo.addEventListener((state) => {
      const now = state.isConnected
      // Fire only on the offline→online transition; same-state events fire
      // for cellular ↔ wifi swaps and we don't need to refire for those.
      if (now === true && prev !== true) {
        flush().catch(() => {})
      }
      prev = now
    })
  } else {
    // Polling fallback, try every minute. Failed flushes are cheap when
    // the queue is empty (early return).
    pollTimer = setInterval(() => {
      flush().catch(() => {})
    }, FLUSH_INTERVAL_MS)
  }
  // Also kick off an immediate flush attempt on startup in case the device
  // came back online while the app was killed.
  flush().catch(() => {})
}

export function stopOfflineWatch(): void {
  if (netInfoUnsub) {
    try { netInfoUnsub() } catch {}
    netInfoUnsub = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
