-- companion_usage: the companion's daily quota, moved from a KV read-then-write (parallel requests all read the same
-- count, and a failed or canceled reply was never counted) to one row per reader per UTC day. companionRepo reserves a
-- request's worst-case cost with a single conditional upsert before the model is called and settles it to the real cost
-- after; each is one statement, which D1 runs atomically.
-- Additive: one new table. No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE IF NOT EXISTS companion_usage (
  user_id TEXT NOT NULL REFERENCES `user`(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
