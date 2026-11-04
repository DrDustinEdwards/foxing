import { env } from "cloudflare:test";
import { type ApiDeps, createApi } from "@foxing/api";
import { billing, createDb, deleteAccount, schema } from "@foxing/core";

// The API as the integration suites build it: the caller is whoever the x-test-user header
// names, and the companion and billing are stubs that fail if a suite reaches them. A suite
// passes only the dependencies it tests.
export function testApi(deps: Partial<ApiDeps> = {}) {
  return createApi({
    resolveSession: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id, email: `${id}@example.com` } : null;
    },
    resolveCompanionCaller: () =>
      // biome-ignore lint/correctness/useYield: throws on first iteration by design, never yields
      async function* unused() {
        throw new Error("not used in this suite");
      },
    // Every test caller signed in just now.
    isFresh: async () => true,
    // The real one is Better Auth's deleteUser (security-notice.integration.test.ts).
    deleteUser: async (_req, e, { userId, successors }) => {
      await deleteAccount(createDb(e.DB), userId, successors);
      return "deleted";
    },
    resolveBilling: () => ({
      client: billing.notConfiguredBilling(),
      prices: { monthly: "", annual: "" },
    }),
    ...deps,
  });
}

type Req = { method?: string; user?: string; body?: unknown };

/** One JSON request to the API, as `user` or signed out. */
export function callApi(
  api: ReturnType<typeof testApi>,
  path: string,
  { method = "GET", user, body }: Req = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (user) headers["x-test-user"] = user;
  return api.fetch(
    new Request(`https://test.local${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env as never,
  );
}

/** A user and their profile: the two rows a signed-in caller needs. */
export async function seedUser(id: string, tier: "free" | "plus" = "free") {
  const db = createDb(env.DB);
  await db.insert(schema.user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.profiles).values({
    id,
    username: id,
    subscriptionTier: tier,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
