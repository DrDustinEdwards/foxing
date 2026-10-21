// Hono environment for the mounted API. Bindings are bare (DB, APP_KV, rate
// limiters) per capsid/conventions.md; Variables carry the resolved request context.
import type {
  BillingClient,
  BillingPriceConfig,
  CompanionCaller,
  Db,
  LiveMessage,
  Profile,
} from "@foxing/core";

// The live-layer seam. The Worker builds this from the ClubRoom Durable
// Object namespace; tests inject a no-op. `broadcast` is called AFTER a write commits
// to D1 (write -> commit -> notify); `connect` upgrades a membership-checked request to
// the club's ClubRoom WebSocket. The DO is fan-out only and never writes D1.
export type ClubLiveHub = {
  broadcast: (clubId: string, message: LiveMessage | LiveMessage[]) => Promise<void>;
  connect: (clubId: string, userId: string, request: Request) => Promise<Response>;
};

export type Bindings = {
  DB: D1Database;
  APP_KV: KVNamespace;
  // Workers rate-limiting bindings (spec-cf-api middleware pipeline).
  AUTH_RL: RateLimit;
  WRITE_RL: RateLimit;
  COMPANION_RL: RateLimit;
  // Operator bearer for /admin/* (the admin MCP Worker). A Worker secret; when unset,
  // every bearer request to /admin/* is refused (operator.ts).
  ADMIN_OPERATOR_TOKEN?: string;
};

export type SessionUser = { id: string; email: string };

export type Variables = {
  requestId: string;
  db: Db;
  session: SessionUser | null;
  // True when the session was resolved from the operator bearer, not a cookie.
  viaOperator: boolean;
  profile: Profile | null;
  streamCompanion: CompanionCaller;
  billing: { client: BillingClient; prices: BillingPriceConfig };
  hub: ClubLiveHub;
};

export type Env = { Bindings: Bindings; Variables: Variables };

// The Worker injects how to resolve a Better Auth session, keeping this package free
// of an auth-provider dependency (thin routes, testable pipeline). resolveCompanionCaller
// follows the same shape (a function of the per-request Bindings, not a value built at
// module scope, since secrets are only reachable per-request): the Worker builds the
// real Anthropic-backed caller from env.ANTHROPIC_API_KEY; tests inject a stub with no
// network call and no key.
export type ApiDeps = {
  resolveSession: (req: Request, env: Bindings) => Promise<SessionUser | null>;
  resolveCompanionCaller: (env: Bindings) => CompanionCaller;
  // Same per-request shape (secrets are only reachable via env): the Worker builds the
  // real Stripe client + price ids from its secrets; when they are unset it returns the
  // not-configured stub (methods throw BillingNotConfiguredError) so routes 503 cleanly.
  resolveBilling: (env: Bindings) => { client: BillingClient; prices: BillingPriceConfig };
  // Same per-request shape: the Worker builds the hub from the ClubRoom DO namespace.
  // Optional: when absent, createApi supplies a no-op hub so non-club callers (and the
  // pre-Phase-5 integration suites) run without a Durable Object binding.
  resolveHub?: (env: Bindings) => ClubLiveHub;
};
