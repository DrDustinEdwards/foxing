import { env } from "cloudflare:test";
import { clubsRepo, createDb, libraryRepo, profilesRepo, schema } from "@foxing/core";
import { beforeEach, describe, expect, it } from "vitest";

// The nav menus federate people + clubs into the command palette and show a live
// "N words to master" count in the account menu. These drive the core reads directly
// against D1 (the same reads the /search/suggest resource route and the root nav loader
// call). The visible menu behaviour is covered by the Playwright authed nav spec.

const db = () => createDb(env.DB);

async function seedUser(
  id: string,
  opts: { visibility?: Record<string, string>; displayName?: string } = {},
) {
  await db().insert(schema.user).values({
    id,
    name: "Test",
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db()
    .insert(schema.profiles)
    .values({
      id,
      username: id,
      displayName: opts.displayName ?? id,
      visibility: opts.visibility ?? null,
      onboardedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

describe("command-palette federated search (public only)", () => {
  beforeEach(async () => {
    await db().delete(schema.clubs);
    await db().delete(schema.vocabulary);
    await db().delete(schema.profiles);
    await db().delete(schema.user);
    await seedUser("marlowe", { displayName: "Marlowe Reads" });
    await seedUser("marlowe_private", {
      displayName: "Marlowe Hidden",
      visibility: { profile: "private" },
    });
    await seedUser("clubowner");
  });

  it("finds public people by name and hides private profiles", async () => {
    const hits = await profilesRepo.searchProfiles(db(), "marlowe", 10);
    const usernames = hits.map((h) => h.username);
    expect(usernames).toContain("marlowe");
    expect(usernames).not.toContain("marlowe_private");
  });

  it("finds public clubs and hides private ones", async () => {
    await db().insert(schema.clubs).values({
      id: "c1",
      name: "Gothic Readers",
      slug: "gothic-readers",
      creatorId: "clubowner",
      visibility: "public",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db().insert(schema.clubs).values({
      id: "c2",
      name: "Gothic Secret Society",
      slug: "gothic-secret",
      creatorId: "clubowner",
      visibility: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hits = await clubsRepo.searchClubs(db(), "gothic", 10);
    const slugs = hits.map((h) => h.slug);
    expect(slugs).toContain("gothic-readers");
    expect(slugs).not.toContain("gothic-secret");
  });

  it("returns nothing for a one-character query", async () => {
    expect(await profilesRepo.searchProfiles(db(), "m", 10)).toEqual([]);
    expect(await clubsRepo.searchClubs(db(), "g", 10)).toEqual([]);
  });
});

describe("account-menu vocabulary count", () => {
  beforeEach(async () => {
    await db().delete(schema.vocabulary);
    await db().delete(schema.profiles);
    await db().delete(schema.user);
    await seedUser("learner");
  });

  it("counts only words not yet mastered", async () => {
    const base = {
      userId: "learner",
      definition: "d",
      lookedUpAt: new Date(),
      createdAt: new Date(),
    };
    await db().insert(schema.vocabulary).values([
      { ...base, id: "v1", word: "one", mastered: false },
      { ...base, id: "v2", word: "two", mastered: false },
      { ...base, id: "v3", word: "three", mastered: true },
    ]);
    expect(await libraryRepo.countVocabularyToMaster(db(), "learner")).toBe(2);
  });
});
