// Admin write surface. Reads run in-process from the RR admin loaders (adminRepo,
// gated by requireAdmin); this router holds only the mutations, each gated on
// profiles.is_admin and wrapped in an admin_audit_log entry (actor + source ip). Every
// write returns a plain result; the admin UI surfaces a visible error on non-2xx.
import { adminRepo, deleteAccount } from "@foxing/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env, SessionUser } from "../types";

export const adminRoutes = new Hono<Env>();

// Session + is_admin gate. Suspended admins are already blocked from writes by
// profileMw; this adds the operator check on top.
function requireAdmin(c: Context<Env>): SessionUser {
  const session = requireSession(c);
  const profile = c.get("profile");
  if (!profile?.isAdmin) throw errors.forbidden("Admin only.");
  return session;
}

// Record every admin write. Called after the mutation commits so the log reflects
// applied changes only.
async function audit(c: Context<Env>, action: string, params: Record<string, unknown>) {
  await adminRepo.writeAuditLog(c.get("db"), {
    action,
    params,
    actor: c.get("session")?.id ?? null,
    sourceIp: c.req.header("CF-Connecting-IP") ?? null,
  });
}

const onOff = z.object({ on: z.boolean() });

// ---- Users --------------------------------------------------------------------

adminRoutes.post("/admin/users/:id/suspend", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { suspended } = await parseJson(c, z.object({ suspended: z.boolean() }));
  await adminRepo.setUserSuspended(c.get("db"), id, suspended);
  await audit(c, suspended ? "user.suspend" : "user.unsuspend", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/users/:id/tier", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { tier } = await parseJson(c, z.object({ tier: z.enum(["free", "plus"]) }));
  await adminRepo.setUserTier(c.get("db"), id, tier);
  await audit(c, "user.tier", { id, tier });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/users/:id/admin", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  // Guard against locking yourself out by revoking your own admin here.
  if (!on && id === admin.id) throw errors.validation({ id: "You cannot revoke your own admin." });
  await adminRepo.setUserAdmin(c.get("db"), id, on);
  await audit(c, on ? "user.grant_admin" : "user.revoke_admin", { id });
  return c.json({ ok: true });
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
  if (id === admin.id) throw errors.validation({ id: "Delete your own account from settings." });
  await deleteAccount(c.get("db"), id);
  await audit(c, "user.delete", { id });
  return c.json({ ok: true });
});

// ---- Books --------------------------------------------------------------------

const bookMetaInput = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  publicationYear: z.number().int().nullable().optional(),
  publisher: z.string().max(500).nullable().optional(),
  subjects: z.array(z.string()).nullable().optional(),
});

adminRoutes.patch("/admin/books/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const patch = await parseJson(c, bookMetaInput);
  await adminRepo.updateBookAdmin(c.get("db"), id, patch);
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
  await adminRepo.setBookStaffPick(c.get("db"), id, on, note ?? null);
  await audit(c, on ? "book.feature" : "book.unfeature", { id });
  return c.json({ ok: true });
});

// ---- Book of the Month --------------------------------------------------------

const botmInput = z.object({
  bookId: z.string().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  category: z.string().max(200).nullable().optional(),
  curatorNote: z.string().max(5000).nullable().optional(),
  amazonUrl: z.string().url().max(1000).nullable().optional(),
  bookshopUrl: z.string().url().max(1000).nullable().optional(),
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
  await adminRepo.updateBotm(c.get("db"), id, input);
  await audit(c, "botm.update", { id });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/botm/:id/publish", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  await adminRepo.setBotmPublished(c.get("db"), id, on);
  await audit(c, on ? "botm.publish" : "botm.unpublish", { id });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/botm/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  await adminRepo.deleteBotm(c.get("db"), id);
  await audit(c, "botm.delete", { id });
  return c.json({ ok: true });
});

// ---- Celebrity picks ----------------------------------------------------------

adminRoutes.post("/admin/picks/:id/publish", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  await adminRepo.setPickPublished(c.get("db"), id, on);
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
  await adminRepo.updatePick(c.get("db"), id, patch);
  await audit(c, "pick.update", { id });
  return c.json({ ok: true });
});

// ---- Reader clubs -------------------------------------------------------------

adminRoutes.post("/admin/clubs/:id/verify", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  await adminRepo.setClubVerified(c.get("db"), id, on, admin.id);
  await audit(c, on ? "club.verify" : "club.unverify", { id });
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/clubs/:id", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  await adminRepo.deleteClubAdmin(c.get("db"), id);
  await audit(c, "club.delete", { id });
  return c.json({ ok: true });
});

// ---- Journal ------------------------------------------------------------------

const journalInput = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens."),
  content: z.string().min(1),
  excerpt: z.string().max(1000).nullable().optional(),
  coverImageUrl: z.string().url().max(1000).nullable().optional(),
  coverImageAlt: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(60)).max(20).nullable().optional(),
  featured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

adminRoutes.post("/admin/journal", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const input = await parseJson(c, journalInput);
  const existing = await adminRepo.getJournalBySlug(c.get("db"), input.slug);
  if (existing) throw errors.conflict("A post with that slug already exists.");
  const id = await adminRepo.createJournalPost(c.get("db"), input, admin.id);
  await audit(c, "journal.create", { id, slug: input.slug });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/journal/:id", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  const input = await parseJson(c, journalInput.partial());
  await adminRepo.updateJournalPost(c.get("db"), id, input, admin.id);
  await audit(c, "journal.update", { id, fields: Object.keys(input) });
  return c.json({ ok: true });
});

adminRoutes.post("/admin/journal/:id/publish", rateLimit("write"), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { on } = await parseJson(c, onOff);
  await adminRepo.setJournalPublished(c.get("db"), id, on);
  await audit(c, on ? "journal.publish" : "journal.unpublish", { id });
  return c.json({ ok: true });
});

// ---- Broadcast notifications --------------------------------------------------

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

// ---- Announcements ------------------------------------------------------------

const announcementInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  placement: z.enum(["banner", "home", "journal"]).optional(),
  linkUrl: z.string().url().max(1000).nullable().optional(),
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
