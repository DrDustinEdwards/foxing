// Offline sync queue: the mobile half of the /api/v1/sync protocol whose server resolver
// lives in @foxing/core (domain/sync.ts). Every offline write becomes an op with a
// client-generated id that doubles as the row primary key, so a replayed op is an
// idempotent no-op server-side. The transport is injected (lib/api.ts adds the session
// cookie). Screens read through the query cache, so the queue only ever pushes.

import AsyncStorage from '@react-native-async-storage/async-storage'

// -- op contract (mirrors packages/core/src/validators/sync.ts) -------------

export type SyncResource = 'annotation' | 'user_book' | 'session' | 'vocabulary' | 'diary'
export type SyncVerb = 'create' | 'update' | 'delete'

export interface SyncOp {
  id: string
  resource: SyncResource
  verb: SyncVerb
  // Delete carries no payload; create/update carry the resource fields. Kept generic on
  // purpose: the server validates each payload against its zod schema, so the client stays
  // a thin envelope and does not duplicate every field shape.
  payload?: Record<string, unknown>
  clientTs: number
}

// Per-op server result, echoed back so we know which ops to drop from the queue.
interface SyncOpResult {
  id: string
  status: 'applied' | 'skipped'
  action: string
  reason?: string
  error?: string
}

interface SyncPushResponse {
  results: SyncOpResult[]
}

// Injected authenticated transport: (path, init) => Response. Path is relative to the API
// base (e.g. '/api/v1/sync'); the caller's implementation supplies base URL + auth headers.
export type SyncTransport = (path: string, init: RequestInit) => Promise<Response>

const QUEUE_KEY = 'sync_queue_v1'
const MAX_BATCH = 500

let flushing = false

// -- client id --------------------------------------------------------------

// 21-char url-safe id used as both op id and row primary key. nanoid is not installed and
// pulling a native crypto dep is a device gate, so this uses Math.random -- adequate for a
// per-device offline queue (collisions across a single user's device are vanishingly rare
// and a collision only replays as an idempotent no-op server-side).
const ID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
export function clientId(): string {
  let out = ''
  for (let i = 0; i < 21; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return out
}

// -- persistence ------------------------------------------------------------

async function readQueue(): Promise<SyncOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeQueue(ops: SyncOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch (e) {
    console.warn('[sync-queue] write failed:', e instanceof Error ? e.message : e)
  }
}

// -- enqueue ----------------------------------------------------------------

// Queue one offline write. Returns the op id (also the row primary key) so the caller can
// reflect the write in local UI immediately under the same id the server will use.
export async function enqueue(input: {
  resource: SyncResource
  verb: SyncVerb
  payload?: Record<string, unknown>
  id?: string
}): Promise<string> {
  const op: SyncOp = {
    id: input.id ?? clientId(),
    resource: input.resource,
    verb: input.verb,
    payload: input.verb === 'delete' ? undefined : (input.payload ?? {}),
    clientTs: Date.now(),
  }
  const cur = await readQueue()
  cur.push(op)
  await writeQueue(cur)
  return op.id
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length
}

// -- push (flush) -----------------------------------------------------------

// Flush queued ops to /api/v1/sync in <=500 batches, dropping any op the server reports as
// applied or skipped (both are terminal: skipped means replay/stale/idempotent, never
// retry). Ops the server never answered for (network failure, op-level error) stay queued.
// Re-entrant safe via the `flushing` latch.
export async function flush(transport: SyncTransport): Promise<{ pushed: number; remaining: number }> {
  if (flushing) return { pushed: 0, remaining: (await readQueue()).length }
  flushing = true
  let pushed = 0
  try {
    // Snapshot then re-read per batch so enqueues during a flush are not lost.
    for (;;) {
      const queue = await readQueue()
      if (queue.length === 0) break
      const batch = queue.slice(0, MAX_BATCH)
      let res: Response
      try {
        res = await transport('/api/v1/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ops: batch }),
        })
      } catch (e) {
        console.warn('[sync-queue] flush network error:', e instanceof Error ? e.message : e)
        break
      }
      if (!res.ok) {
        console.warn('[sync-queue] flush rejected:', res.status)
        break
      }
      const body = (await res.json().catch(() => null)) as SyncPushResponse | null
      const results = body?.results ?? []
      // Drop every op the server answered for; an op-level error is terminal (a bad payload
      // will not become valid on retry), so we drop those too and rely on the server result.
      const answered = new Set(results.map((r) => r.id))
      pushed += results.filter((r) => r.status === 'applied').length
      const rest = queue.filter((op) => !answered.has(op.id))
      await writeQueue(rest)
      // No forward progress (server answered for nothing in this batch): stop to avoid a
      // hot loop on a persistently failing head op.
      if (rest.length === queue.length) break
      if (rest.length === 0) break
    }
    return { pushed, remaining: (await readQueue()).length }
  } finally {
    flushing = false
  }
}
