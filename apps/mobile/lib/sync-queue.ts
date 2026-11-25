import AsyncStorage from "@react-native-async-storage/async-storage";

export type SyncResource = "annotation" | "user_book" | "session" | "vocabulary" | "diary";
export type SyncVerb = "create" | "update" | "delete";

interface SyncOp {
  id: string;
  resource: SyncResource;
  verb: SyncVerb;
  payload?: Record<string, unknown>;
  clientTs: number;
}

interface SyncOpResult {
  id: string;
  status: "applied" | "skipped";
  action: string;
  reason?: string;
  error?: string;
}

interface SyncPushResponse {
  results: SyncOpResult[];
}

export type SyncTransport = (path: string, init: RequestInit) => Promise<Response>;

const QUEUE_KEY = "sync_queue_v1";
const MAX_BATCH = 500;

let flushing = false;

// Math.random id: nanoid is not installed and a native crypto dep is a device gate; a collision only replays as an idempotent no-op.
const ID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
export function clientId(): string {
  let out = "";
  for (let i = 0; i < 21; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}

async function readQueue(): Promise<SyncOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(ops: SyncOp[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}

let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

export function clearQueue(): Promise<void> {
  return exclusive(() => AsyncStorage.removeItem(QUEUE_KEY));
}

export async function enqueue(input: {
  resource: SyncResource;
  verb: SyncVerb;
  payload?: Record<string, unknown>;
  id?: string;
}): Promise<string> {
  const op: SyncOp = {
    id: input.id ?? clientId(),
    resource: input.resource,
    verb: input.verb,
    payload: input.verb === "delete" ? undefined : (input.payload ?? {}),
    clientTs: Date.now(),
  };
  await exclusive(async () => writeQueue([...(await readQueue()), op]));
  return op.id;
}

// Flush in <=500 batches; applied and skipped ops are terminal and dropped, unanswered ops stay queued. The `flushing` latch makes it re-entrant safe.
export async function flush(
  transport: SyncTransport,
): Promise<{ pushed: number; remaining: number }> {
  if (flushing) return { pushed: 0, remaining: (await readQueue()).length };
  flushing = true;
  let pushed = 0;
  try {
    for (;;) {
      const queue = await readQueue();
      if (queue.length === 0) break;
      const batch = queue.slice(0, MAX_BATCH);
      let res: Response;
      try {
        res = await transport("/api/v1/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ops: batch }),
        });
      } catch (e) {
        console.warn("[sync-queue] flush network error:", e instanceof Error ? e.message : e);
        break;
      }
      if (!res.ok) {
        console.warn("[sync-queue] flush rejected:", res.status);
        break;
      }
      const body = (await res.json().catch(() => null)) as SyncPushResponse | null;
      const results = body?.results ?? [];
      // An op-level error is terminal (a bad payload will not become valid on retry), so those are dropped too.
      const answered = new Set(results.map((r) => r.id));
      pushed += results.filter((r) => r.status === "applied").length;
      const rest = await exclusive(async () => {
        const fresh = (await readQueue()).filter((op) => !answered.has(op.id));
        await writeQueue(fresh);
        return fresh;
      });
      // No forward progress: stop rather than hot-loop on a failing head op.
      if (results.length === 0 || rest.length === 0) break;
    }
    return { pushed, remaining: (await readQueue()).length };
  } finally {
    flushing = false;
  }
}
