// Push token registration + notification endpoints (Phase 7). Tokens register after
// sign-in; delivery gating (category prefs + quiet hours) happens in the Queue consumer
// via domain/push. The in-app notification list + read + prefs are here too so the
// mobile client has one place for the notification surface.
import {
  notificationPrefsInput,
  notificationsRepo,
  profilesRepo,
  pushRegisterInput,
  pushRepo,
} from "@foxing/core";
import { Hono } from "hono";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const pushRoutes = new Hono<Env>();

// -- Push tokens ------------------------------------------------------------

pushRoutes.post("/push/register", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const { token, platform } = await parseJson(c, pushRegisterInput);
  await pushRepo.registerToken(c.get("db"), session.id, token, platform);
  return c.json({ ok: true }, 201);
});

pushRoutes.delete("/push/:token", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  await pushRepo.deleteToken(c.get("db"), session.id, c.req.param("token"));
  return c.json({ ok: true });
});

// -- Notifications (in-app) -------------------------------------------------

pushRoutes.get("/notifications", async (c) => {
  const session = requireSession(c);
  const cursor = c.req.query("cursor");
  const [items, unread] = await Promise.all([
    notificationsRepo.listForUser(c.get("db"), session.id, {
      cursor: cursor ? Number(cursor) : null,
    }),
    notificationsRepo.unreadCount(c.get("db"), session.id),
  ]);
  return c.json({ notifications: items, unread });
});

pushRoutes.post("/notifications/read", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const body = (await c.req.raw
    .clone()
    .json()
    .catch(() => ({}))) as { ids?: string[] };
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await notificationsRepo.markRead(c.get("db"), session.id, body.ids);
  } else {
    await notificationsRepo.markAllRead(c.get("db"), session.id);
  }
  return c.json({ ok: true });
});

pushRoutes.patch("/me/notification-prefs", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const prefs = await parseJson(c, notificationPrefsInput);
  await profilesRepo.setNotificationPrefs(c.get("db"), session.id, {
    categories: prefs.categories,
    quietHours: prefs.quietHours ?? undefined,
  });
  return c.json({ ok: true });
});
