// Role and permission changes for the admin surface (the rest is admin.ts), mounted beside it in index.ts.
import { adminRepo, type Db } from "@foxing/core";
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
import { parseJson } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env, SessionUser } from "../types";
import { audit, requireAdmin } from "./admin-shared";

export const adminRoleRoutes = new Hono<Env>();

// Role and permission changes are preview then perform: without `confirm` nothing changes and the answer is who gains or loses what plus a
// single-use token bound to that change (admin-confirm.ts); the second request writes only while the target still holds the previewed state
// and audits the actor. The Stripe webhook is the only other writer of tier.

const confirmToken = z.string().regex(CONFIRM_TOKEN_PATTERN).optional();

type RoleChangeSpec = {
  kind: RoleChangeKind;
  to: RoleValue;
  current: (state: adminRepo.UserRoleState) => RoleValue;
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
    const { token, expiresAt } = await mintConfirmation(c.env.BETTER_AUTH_SECRET, {
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

  const pending = await redeemConfirmation(c.env.BETTER_AUTH_SECRET, c.env.APP_KV, confirm, {
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

adminRoleRoutes.post("/admin/users/:id/suspend", rateLimit("write"), async (c) => {
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

adminRoleRoutes.post("/admin/users/:id/tier", rateLimit("write"), async (c) => {
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
