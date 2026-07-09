import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { createDb, schema } from "@foxing/core";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

const api = createApi({
  resolveSession: async (req) => {
    const id = req.headers.get("x-test-user");
    return id ? { id, email: `${id}@example.com` } : null;
  },
});

const call = (pathname: string, init?: RequestInit) =>
  api.fetch(new Request(`https://test.local${pathname}`, init), env as never);

async function seedUser(id: string) {
  const db = createDb(env.DB);
  await db.insert(schema.user).values({
    id,
    name: "Test",
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedBook(id: string) {
  const db = createDb(env.DB);
  await db.insert(schema.books).values({
    id,
    title: "Test Book",
    author: "Test Author",
    slug: id,
    source: "test",
    sourceType: "catalog",
    language: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const authed = (id: string, body?: unknown): RequestInit => ({
  method: body ? "PUT" : "GET",
  headers: { "x-test-user": id, "content-type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

describe("library API (status -> event emission)", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.activityEvents);
    await db.delete(schema.notifications);
    await db.delete(schema.readingStreaks);
    await db.delete(schema.readingGoals);
    await db.delete(schema.customShelfBooks);
    await db.delete(schema.customShelves);
    await db.delete(schema.userBooks);
    await db.delete(schema.books);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
  });

  it("rejects an anonymous status write with 401", async () => {
    const res = await call("/library/b1", {
      method: "PUT",
      body: JSON.stringify({ status: "reading" }),
    });
    expect(res.status).toBe(401);
  });

  it("status=reading writes user_books and emits started_book", async () => {
    await seedUser("u1");
    await seedBook("b1");

    const res = await call("/library/b1", authed("u1", { status: "reading" }));
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const [ub] = await db
      .select()
      .from(schema.userBooks)
      .where(and(eq(schema.userBooks.userId, "u1"), eq(schema.userBooks.bookId, "b1")));
    expect(ub.status).toBe("reading");
    expect(ub.startedAt).not.toBeNull();

    const events = await db.select().from(schema.activityEvents);
    expect(events.some((e) => e.type === "started_book" && e.bookId === "b1")).toBe(true);
  });

  it("status=finished emits finished_book and increments the streak total", async () => {
    await seedUser("u2");
    await seedBook("b2");

    await call("/library/b2", authed("u2", { status: "reading" }));
    const res = await call("/library/b2", authed("u2", { status: "finished" }));
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const events = await db.select().from(schema.activityEvents);
    expect(events.some((e) => e.type === "finished_book" && e.bookId === "b2")).toBe(true);

    const [streak] = await db
      .select()
      .from(schema.readingStreaks)
      .where(eq(schema.readingStreaks.userId, "u2"));
    expect(streak.totalBooksFinished).toBe(1);
  });

  it("finishing a book that completes a books goal emits goal_met + a notification", async () => {
    await seedUser("u3");
    await seedBook("b3");
    const db = createDb(env.DB);
    await db.insert(schema.readingGoals).values({
      userId: "u3",
      type: "books",
      target: 1,
      periodType: "year",
      year: new Date().getUTCFullYear(),
    });

    await call("/library/b3", authed("u3", { status: "finished" }));

    const events = await db.select().from(schema.activityEvents);
    expect(events.some((e) => e.type === "goal_met")).toBe(true);
    const notes = await db.select().from(schema.notifications);
    expect(notes.some((n) => n.type === "goal_met" && n.userId === "u3")).toBe(true);
  });

  it("does not re-increment the streak when finished is set twice", async () => {
    await seedUser("u4");
    await seedBook("b4");
    await call("/library/b4", authed("u4", { status: "finished" }));
    await call("/library/b4", authed("u4", { status: "finished" }));

    const db = createDb(env.DB);
    const [streak] = await db
      .select()
      .from(schema.readingStreaks)
      .where(eq(schema.readingStreaks.userId, "u4"));
    expect(streak.totalBooksFinished).toBe(1);
  });

  it("GET /library returns the joined entry", async () => {
    await seedUser("u5");
    await seedBook("b5");
    await call("/library/b5", authed("u5", { status: "want" }));

    const res = await call("/library", { headers: { "x-test-user": "u5" } });
    const body = (await res.json()) as {
      library: Array<{ bookId: string; status: string; title: string }>;
    };
    expect(body.library).toHaveLength(1);
    expect(body.library[0]).toMatchObject({ bookId: "b5", status: "want", title: "Test Book" });
  });

  it("creates a shelf and adds a book to it", async () => {
    await seedUser("u6");
    await seedBook("b6");

    const shelfRes = await call("/shelves", {
      method: "POST",
      headers: { "x-test-user": "u6", "content-type": "application/json" },
      body: JSON.stringify({ name: "Favorites" }),
    });
    expect(shelfRes.status).toBe(201);
    const { shelf } = (await shelfRes.json()) as { shelf: { id: string } };

    const addRes = await call(`/shelves/${shelf.id}/books`, {
      method: "POST",
      headers: { "x-test-user": "u6", "content-type": "application/json" },
      body: JSON.stringify({ bookId: "b6" }),
    });
    expect(addRes.status).toBe(201);

    const listRes = await call(`/shelves/${shelf.id}/books`, { headers: { "x-test-user": "u6" } });
    const { books } = (await listRes.json()) as { books: Array<{ bookId: string }> };
    expect(books.map((b) => b.bookId)).toContain("b6");
  });
});
