// A short per-isolate memo for public reads that every request repeats and that change rarely (the nav's featured
// clubs, the genre facets). Workers keep module state while an isolate lives, so a hit costs no D1 rows and a
// cold isolate simply reads again; nothing here is shared or durable. A read that throws is not kept, so a failed
// read still surfaces (rule 5). Stale at most `ttlMs`: do not use it for anything a person just wrote and expects to see.
const kept = new Map<string, { at: number; value: unknown }>();

export async function memo<T>(key: string, ttlMs: number, read: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = kept.get(key);
  if (hit && now - hit.at < ttlMs && now >= hit.at) return hit.value as T;
  const value = await read();
  kept.set(key, { at: now, value });
  return value;
}
