// Hono environment for the mounted API. Bindings are bare (DB, APP_KV, rate
// limiters) per capsid/conventions.md; Variables carry the resolved request context.
import type { Db, Profile } from "@foxing/core";

export type Bindings = {
  DB: D1Database;
  APP_KV: KVNamespace;
  // Workers rate-limiting bindings (spec-cf-api middleware pipeline).
  AUTH_RL: RateLimit;
  WRITE_RL: RateLimit;
};

export type SessionUser = { id: string; email: string };

export type Variables = {
  requestId: string;
  db: Db;
  session: SessionUser | null;
  profile: Profile | null;
};

export type Env = { Bindings: Bindings; Variables: Variables };

// The Worker injects how to resolve a Better Auth session, keeping this package
// free of an auth-provider dependency (thin routes, testable pipeline).
export type ApiDeps = {
  resolveSession: (req: Request, env: Bindings) => Promise<SessionUser | null>;
};
