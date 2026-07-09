import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { beforeEach, describe, expect, it } from "vitest";
import { requireProfileForUser } from "../app/lib/profile.server";

// Regression: a signed-in user with NO profile row (account predates onboarding, or
// signed up but never chose a username) must be redirected to /onboarding. The /me
// loader used to fetch its own API and crash on the response, throwing a raw 500.
// Every profile-gated loader (/me, /library) now routes through requireProfile.

async function seedUser(id: string) {
  await createDb(env.DB)
    .insert(schema.user)
    .values({
      id,
      name: "Test",
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

describe("profile gate", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
  });

  it("redirects a signed-in user with no profile to /onboarding", async () => {
    await seedUser("u_noprofile");
    let thrown: unknown;
    try {
      await requireProfileForUser(env as never, {
        id: "u_noprofile",
        email: "u_noprofile@example.com",
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Response);
    const res = thrown as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/onboarding");
  });

  it("returns the profile when one exists (no redirect)", async () => {
    await seedUser("u_hasprofile");
    await createDb(env.DB).insert(schema.profiles).values({
      id: "u_hasprofile",
      username: "haver",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const ctx = await requireProfileForUser(env as never, {
      id: "u_hasprofile",
      email: "u_hasprofile@example.com",
    });
    expect(ctx.profile.username).toBe("haver");
  });
});
