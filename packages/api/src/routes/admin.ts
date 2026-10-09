// Admin write surface. Reads run in-process from the RR admin loaders (adminRepo,
// gated by requireAdmin); this router holds only the mutations, each gated on
// profiles.is_admin and wrapped in an admin_audit_log entry (actor + source ip). Every
// write returns a plain result; the admin UI surfaces a visible error on non-2xx. Role
// and permission changes (suspend, tier, admin) are preview then perform; see below.
import { adminRepo, type Db, deleteAccount } from "@foxing/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  CONFIRM_TOKEN_PATTERN,
  mintConfirmation,
  type RoleChangeKind,
  type RoleValue,
  redeemConfirmation,
} from "../admin-confirm";
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

// Role and permission changes are preview then perform. A request without `confirm`
// changes nothing: it returns who gains or loses what, and a single-use token bound to
// that change (admin-confirm.ts). Only a second request carrying the token performs
// it, writes only while the target still holds the previewed state, and records an
// audit row naming the actor. These three routes are every role or permission write in
// the admin surface; the Stripe webhook is the only other writer of tier.

const confirmToken = z.string().regex(CONFIRM_TOKEN_PATTERN).optional();

type RoleChangeSpec = {
  kind: RoleChangeKind;
  to: RoleValue;
  current: (state: adminRepo.UserRoleState) => RoleValue;
  /** What the target gains or loses, in words, after their @username. */
  effect: string;
  auditAction: string;
  apply: (db: Db, id: string, from: RoleValue) => Promise<boolean>;
};

async function previewOrPerform(
  c: Context<Env>,
  actor: SessionUser,
  confirm: string | undefined,
  spec: RoleChangeSpec,
) {
  const db = c.get("db");
  const id = c.req.param("id") as string;
  const state = await adminRepo.getUserRoleState(db, id);
  if (!state) throw errors.notFound("No such user.");
  const from = spec.current(state);

  if (!confirm) {
    if (from === spec.to) throw errors.conflict(`@${state.username} already has that.`);
    const { token, expiresAt } = await mintConfirmation(c.env.APP_KV, {
      actor: actor.id,
      target: id,
      kind: spec.kind,
      from,
      to: spec.to,
    });
    return c.json({
      preview: {
        target: { id, username: state.username, displayName: state.displayName },
        kind: spec.kind,
        from,
        to: spec.to,
        summary: `@${state.username} ${spec.effect}`,
      },
      confirm: { token, expiresAt },
    });
  }

  const pending = await redeemConfirmation(c.env.APP_KV, confirm, {
    actor: actor.id,
    target: id,
    kind: spec.kind,
    to: spec.to,
  });
  const applied = await spec.apply(db, id, pending.from);
  if (!applied) {
    throw errors.conflict(
      `@${state.username} changed after the preview. Preview the change again.`,
    );
  }
  await audit(c, spec.auditAction, { id, from: pending.from, to: spec.to });
  return c.json({ ok: true });
}

adminRoutes.post("/admin/users/:id/suspend", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const { suspended, confirm } = await parseJson(
    c,
    z.object({ suspended: z.boolean(), confirm: confirmToken }),
  );
  return previewOrPerform(c, admin, confirm, {
    kind: "suspend",
    to: suspended,
    current: (s) => s.isSuspended,
    effect: suspended
      ? "is suspended: they can still sign in and read, but every write they send is refused."
      : "is unsuspended and can write again.",
    auditAction: suspended ? "user.suspend" : "user.unsuspend",
    apply: (db, id, from) => adminRepo.setUserSuspended(db, id, suspended, from as boolean),
  });
});

adminRoutes.post("/admin/users/:id/tier", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const { tier, confirm } = await parseJson(
    c,
    z.object({ tier: z.enum(["free", "plus"]), confirm: confirmToken }),
  );
  return previewOrPerform(c, admin, confirm, {
    kind: "tier",
    to: tier,
    current: (s) => s.tier,
    effect:
      tier === "plus"
        ? "moves to Plus and gets the AI companion. Nothing changes in Stripe, and a later Stripe event can set the tier again."
        : "moves to Free and loses the AI companion. Nothing changes in Stripe, and a later Stripe event can set the tier again.",
    auditAction: "user.tier",
    apply: (db, id, from) => adminRepo.setUserTier(db, id, tier, from as string),
  });
});

adminRoutes.post("/admin/users/:id/admin", rateLimit("write"), async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param("id");
  const { on, confirm } = await parseJson(c, z.object({ on: z.boolean(), confirm: confirmToken }));
  // Guard against locking yourself out by revoking your own admin here.
  if (!on && id === admin.id) throw errors.validation({ id: "You cannot revoke your own admin." });
  return previewOrPerform(c, admin, confirm, {
    kind: "admin",
    to: on,
    current: (s) => s.isAdmin,
    effect: on
      ? "gains admin: every admin page and every admin write, including granting admin to others."
      : "loses admin: no admin pages and no admin writes.",
    auditAction: on ? "user.grant_admin" : "user.revoke_admin",
    apply: (db, id, from) => adminRepo.setUserAdmin(db, id, on, from as boolean),
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
