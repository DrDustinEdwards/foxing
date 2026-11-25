// Hono environment for the mounted API; Variables carry the resolved request context.
import type { limit } from "@dustinedwards/site-runtime/rate-limit";
import type {
  BillingClient,
  BillingPriceConfig,
  ClubSuccessors,
  CompanionCaller,
  Db,
  LiveMessage,
  SignedInProfile,
  StructuredCaller,
} from "@foxing/core";

// The live-layer seam. `broadcast` runs AFTER the D1 write commits; `connect` upgrades a membership-checked request to the club's
// ClubRoom socket. The DO is fan-out only and never writes D1.
export type ClubLiveHub = {
  broadcast: (clubId: string, message: LiveMessage | LiveMessage[]) => Promise<void>;
  connect: (clubId: string, userId: string, request: Request) => Promise<Response>;
  disconnect: (clubId: string, userId: string) => Promise<void>;
};

export type Bindings = {
  DB: D1Database;
  APP_KV: KVNamespace;
  // site-runtime's RateLimiter Durable Object (middleware/rate-limit.ts).
  RATE_LIMITER?: Parameters<typeof limit>[0];
  // Operator bearer for /admin/* (the admin MCP Worker). A Worker secret; when unset,
  // every bearer request to /admin/* is refused (operator.ts).
  ADMIN_OPERATOR_TOKEN?: string;
  // Better Auth's secret; the admin confirmation key is derived from it (admin-confirm.ts).
  BETTER_AUTH_SECRET?: string;
  // Who is an admin (site-runtime isAdminEmail): the main admin and the comma-separated co-owners.
  // ADMIN_EMAIL unset: nobody.
  ADMIN_EMAIL?: string;
  CO_OWNER_EMAILS?: string;
  // Affiliate ids appended to buy links (core config/affiliate.ts); vars, both optional.
  AMAZON_ASSOC_TAG?: string;
  BOOKSHOP_AFFILIATE_ID?: string;
};

export type SessionUser = { id: string; email: string };

export type Variables = {
  requestId: string;
  db: Db;
  session: SessionUser | null;
  viaOperator: boolean;
  profile: SignedInProfile | null;
  streamCompanion: CompanionCaller;
  structuredCompanion: StructuredCaller | null;
  billing: { client: BillingClient; prices: BillingPriceConfig };
  hub: ClubLiveHub;
  deleteUser: ApiDeps["deleteUser"];
  isFresh: ApiDeps["isFresh"];
};

export type Env = { Bindings: Bindings; Variables: Variables };

// The Worker injects session resolution, keeping this package free of an auth-provider dependency. Like resolveCompanionCaller it is a
// per-request function, since secrets are only reachable per request; tests inject stubs.
export type ApiDeps = {
  resolveSession: (req: Request, env: Bindings) => Promise<SessionUser | null>;
  resolveCompanionCaller: (env: Bindings) => CompanionCaller;
  resolveStructuredCaller?: (env: Bindings) => StructuredCaller | null;
  // Per-request like the above; unset secrets yield a stub whose methods throw BillingNotConfiguredError, so routes 503 cleanly.
  resolveBilling: (env: Bindings) => { client: BillingClient; prices: BillingPriceConfig };
  // Optional: a no-op hub is supplied when absent, so non-club callers run without a Durable Object binding.
  resolveHub?: (env: Bindings) => ClubLiveHub;
  // Whether Cloudflare Access let this request through for `email` (the signed-in
  // admin), checked on /admin/* and /ops/* (middleware/admin-access.ts). The Worker
  // verifies Access's signed token (site-runtime ./access accessAdmin). Absent: refused.
  checkAdminAccess?: (req: Request, env: Bindings, email: string) => Promise<boolean>;
  // The reader's own deletion (DELETE /account): the Worker runs Better Auth's deleteUser, which
  // needs a sign-in from the last 10 minutes and runs core eraseAccountData with `successors`
  // first. "not_fresh": refused, nothing deleted.
  // Whether the reader signed in within the last 10 minutes (site-runtime requireFreshSession),
  // for the account export. Deletion checks its own, in Better Auth's deleteUser.
  isFresh: (req: Request, env: Bindings) => Promise<boolean>;
  deleteUser: (
    req: Request,
    env: Bindings,
    input: { userId: string; successors: ClubSuccessors },
  ) => Promise<"deleted" | "not_fresh">;
};
