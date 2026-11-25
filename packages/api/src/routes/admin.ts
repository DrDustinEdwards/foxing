// Admin surface, for a signed-in admin or the admin MCP Worker (operator bearer, middleware/operator.ts): both pass
// requireAdmin (admin-shared.ts), every mutation writes an admin_audit_log entry, and suspend and tier changes are preview then
// perform (admin-roles.ts). Who is an admin is the ADMIN_EMAIL and CO_OWNER_EMAILS setting alone.
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { adminRepo, CATALOG_CHECK_NAMES, catalogRepo, deleteAccount, webUrl } from "@foxing/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { errors } from "../error";
import { parseJson } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";
import { audit, requireAdmin } from "./admin-shared";

export const adminRoutes = new Hono<Env>();

const onOff = z.object({ on: z.boolean() });

const MAX_PAGE = 50;

const pageQuery = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

function validatedQuery<S extends z.ZodTypeAny>(c: Context<Env>, schema: S): z.infer<S> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw result.error;
  return result.data;
}

// Ask the repository for one row past the page to learn whether another page exists.
async function page<T>(
  query: { limit: number; offset: number },
  fetch: (limit: number, offset: number) => Promise<T[]>,
) {
  const rows = await fetch(query.limit + 1, query.offset);
  const hasMore = rows.length > query.limit;
  return {
    items: rows.slice(0, query.limit),
    has_more: hasMore,
    next_offset: hasMore ? query.offset + query.limit : null,
  };
}

adminRoutes.get("/admin/stats", async (c) => {
  requireAdmin(c);
  return c.json(await adminRepo.getAdminStats(c.get("db")));
});

adminRoutes.get("/admin/users", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(c, pageQuery);
  return c.json(
    await page(query, (limit, offset) =>
      adminRepo.listUsers(c.get("db"), { q: query.q, limit, offset, admins: c.env }),
    ),
  );
});

adminRoutes.get("/admin/users/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const db = c.get("db");
  const user = await adminRepo.getUserDetail(db, id, c.env);
  if (!user) throw errors.notFound("No user with that id.");
  return c.json({ user, activity: await adminRepo.getUserActivityStats(db, id) });
});

adminRoutes.get("/admin/books", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(c, pageQuery);
  return c.json(
    await page(query, (limit, offset) =>
      adminRepo.listBooksAdmin(c.get("db"), { q: query.q, limit, offset }),
    ),
  );
});

adminRoutes.get("/admin/clubs", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(c, pageQuery);
  return c.json(
    await page(query, (limit, offset) =>
      adminRepo.listClubsAdmin(c.get("db"), { q: query.q, limit, offset }),
    ),
  );
});

adminRoutes.get("/admin/botm", async (c) => {
  requireAdmin(c);
  return c.json({ items: await adminRepo.listBotmAdmin(c.get("db")) });
});

adminRoutes.get("/admin/botm/:id", async (c) => {
  requireAdmin(c);
  const botm = await adminRepo.getBotm(c.get("db"), c.req.param("id"));
  if (!botm) throw errors.notFound("No Book of the Month entry with that id.");
  return c.json(botm);
});

adminRoutes.get("/admin/pick-clubs", async (c) => {
  requireAdmin(c);
  return c.json({ items: await adminRepo.listPickClubsAdmin(c.get("db")) });
});

// listPicksAdmin returns the newest 200; filter by club_id to see one club's history.
adminRoutes.get("/admin/picks", async (c) => {
  requireAdmin(c);
  const { club_id } = validatedQuery(
    c,
    z.object({ club_id: z.string().min(1).max(100).optional() }),
  );
  return c.json({ items: await adminRepo.listPicksAdmin(c.get("db"), club_id) });
});

adminRoutes.get("/admin/audit-log", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(c, pageQuery.omit({ q: true }));
  return c.json(
    await page(query, (limit, offset) => adminRepo.listAuditLog(c.get("db"), limit, offset)),
  );
});

// The 404s the Worker counts per path and referring host (workers/app.ts countNotFound, pruned nightly by the
// prune-404 job), site-runtime's report: most-hit first, scanner probes left out unless asked for.
adminRoutes.get("/admin/not-found", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(
    c,
    z.object({
      days: z.coerce.number().int().min(1).max(90).default(30),
      limit: z.coerce.number().int().min(1).max(MAX_PAGE).default(20),
      include_probes: z.enum(["true", "false"]).default("false"),
    }),
  );
  const items = await notFoundReport(c.env.DB, {
    days: query.days,
    limit: query.limit,
    includeProbes: query.include_probes === "true",
  });
  return c.json({ days: query.days, items });
});

// Must match COVER_ORIGIN in apps/web/app/lib/origins.ts.
const COVER_ORIGIN = "https://covers.foxing.app";

adminRoutes.get("/admin/catalog-health", async (c) => {
  requireAdmin(c);
  const query = validatedQuery(
    c,
    pageQuery.omit({ q: true }).extend({ check: z.enum(CATALOG_CHECK_NAMES).optional() }),
  );
  const health = await adminRepo.getCatalogHealth(c.get("db"), {
    coverOrigin: COVER_ORIGIN,
    only: query.check,
  });
  const { findings, ...rest } = health;
  const rows = findings.slice(query.offset, query.offset + query.limit + 1);
  const hasMore = rows.length > query.limit;
  return c.json({
    ...rest,
    items: rows.slice(0, query.limit),
    has_more: hasMore,
    next_offset: hasMore ? query.offset + query.limit : null,
  });
});

adminRoutes.post("/admin/users/:id/notify", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const input = await parseJson(
    c,
    z.object({
      title: z.string().min(1).max(200),
      body: z.string().max(2000).nullable().optional(),
    }),
  );
  await adminRepo.notifyUser(c.get("db"), id, {
    type: "system",
    title: input.title,
    body: input.body ?? null,
  });
  await audit(c, "user.notify", { id, title: input.title });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/users/:id", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  if (id === admin.id)
    throw errors.validation(
      [{ path: "id", message: "Delete your own account from settings." }],
      "Delete your own account from settings.",
    );
  const target = await adminRepo.getUserDetail(c.get("db"), id, c.env);
  if (!target) throw errors.notFound("No user with that id.");
  if (target.isAdmin) throw errors.forbidden("An admin account cannot be deleted from here.");
  await deleteAccount(c.get("db"), id);
  await audit(c, "user.delete", { id });
  return c.json({ ok: true });
});

const bookMetaInput = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  publicationYear: z.number().int().nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  // Genre slugs from Foxing's fixed list only, so a raw subject heading never becomes a reader's genre.
  subjects: z.array(z.enum(catalogRepo.GENRE_SLUGS)).nullable().optional(),
});

function found(changed: boolean) {
  if (!changed) throw errors.notFound("Nothing with that id.");
}

adminRoutes.patch("/admin/books/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const patch = await parseJson(c, bookMetaInput);
  found(await adminRepo.updateBookAdmin(c.get("db"), id, patch));
  await audit(c, "book.update", { id, fields: Object.keys(patch) });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/books/:id/staff-pick", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on, note } = await parseJson(
    c,
    z.object({ on: z.boolean(), note: z.string().max(500).nullable().optional() }),
  );
  found(await adminRepo.setBookStaffPick(c.get("db"), id, on, note ?? null));
  await audit(c, on ? "book.feature" : "book.unfeature", { id });
  return c.json({ ok: true });
});

const botmInput = z.object({
  bookId: z.string().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  category: z.string().max(200).nullable().optional(),
  curatorNote: z.string().max(5000).nullable().optional(),
  amazonUrl: webUrl(1000).nullable().optional(),
  bookshopUrl: webUrl(1000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

adminRoutes.post("/admin/botm", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const input = await parseJson(c, botmInput);
  const id = await adminRepo.createBotm(c.get("db"), input);
  await audit(c, "botm.create", { id, year: input.year, month: input.month });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/botm/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const input = await parseJson(c, botmInput.partial());
  found(await adminRepo.updateBotm(c.get("db"), id, input));
  await audit(c, "botm.update", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/botm/:id/publish", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  found(await adminRepo.setBotmPublished(c.get("db"), id, on));
  await audit(c, on ? "botm.publish" : "botm.unpublish", { id });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/botm/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  found(await adminRepo.deleteBotm(c.get("db"), id));
  await audit(c, "botm.delete", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/picks/:id/publish", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  found(await adminRepo.setPickPublished(c.get("db"), id, on));
  await audit(c, on ? "pick.publish" : "pick.unpublish", { id });
  return c.json({ ok: true });
});

adminRoutes.patch("/admin/picks/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const patch = await parseJson(
    c,
    z.object({
      notes: z.string().max(5000).nullable().optional(),
      curatorQuote: z.string().max(2000).nullable().optional(),
      category: z.string().max(200).nullable().optional(),
    }),
  );
  found(await adminRepo.updatePick(c.get("db"), id, patch));
  await audit(c, "pick.update", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/clubs/:id/verify", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  found(await adminRepo.setClubVerified(c.get("db"), id, on, admin.id));
  await audit(c, on ? "club.verify" : "club.unverify", { id });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/clubs/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  found(await adminRepo.deleteClubAdmin(c.get("db"), id));
  await audit(c, "club.delete", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/notifications/broadcast", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const input = await parseJson(
    c,
    z.object({
      type: z.string().max(60).default("system"),
      title: z.string().min(1).max(200),
      body: z.string().max(2000).nullable().optional(),
    }),
  );
  const count = await adminRepo.broadcastNotification(c.get("db"), input);
  await audit(c, "notification.broadcast", { title: input.title, recipients: count });
  return c.json({ recipients: count });
});

const announcementInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  placement: z.enum(["banner", "home", "journal"]).optional(),
  linkUrl: webUrl(1000).nullable().optional(),
  linkLabel: z.string().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

adminRoutes.post("/admin/announcements", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const input = await parseJson(c, announcementInput);
  const id = await adminRepo.createAnnouncement(c.get("db"), input, admin.id);
  await audit(c, "announcement.create", { id, title: input.title });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/announcements/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const input = await parseJson(c, announcementInput.partial());
  await adminRepo.updateAnnouncement(c.get("db"), id, input);
  await audit(c, "announcement.update", { id });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/announcements/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  await adminRepo.deleteAnnouncement(c.get("db"), id);
  await audit(c, "announcement.delete", { id });
  return c.json({ ok: true });
});
