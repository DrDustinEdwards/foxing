// @foxing/api - the Hono app, mountable in any Worker. Routes are thin and call
// packages/core. The Worker injects resolveSession (Better Auth) via createApi.
import { Hono } from "hono";
import { errorHandler } from "./error";
import { adminAccessMw } from "./middleware/admin-access";
import { billingDepsMw } from "./middleware/billing-deps";
import { companionDepsMw } from "./middleware/companion-deps";
import { contextMw } from "./middleware/context";
import { hubDepsMw } from "./middleware/hub-deps";
import { operatorMw } from "./middleware/operator";
import { profileMw } from "./middleware/profile";
import { sessionMw } from "./middleware/session";
import { accountRoutes } from "./routes/account";
import { adminRoutes } from "./routes/admin";
import { annotationRoutes } from "./routes/annotations";
import { billingRoutes } from "./routes/billing";
import { catalogRoutes } from "./routes/catalog";
import { clubRoutes } from "./routes/clubs";
import { companionRoutes } from "./routes/companion";
import { companionOpsRoutes } from "./routes/companion-ops";
import { diaryRoutes } from "./routes/diary";
import { libraryRoutes } from "./routes/library";
import { profileRoutes } from "./routes/profiles";
import { pushRoutes } from "./routes/push";
import { reactionRoutes } from "./routes/reactions";
import { socialRoutes } from "./routes/social";
import { stripeWebhookRoutes } from "./routes/webhooks-stripe";
import { syncRoutes } from "./routes/sync";
import type { ApiDeps, Env } from "./types";

export function createApi(deps: ApiDeps) {
  const app = new Hono<Env>();

  app.onError(errorHandler);

  // An answer is the reader's own unless its route says it is public (the
  // catalog's EDGE_CACHE), so by default none is stored: the account export
  // and /me among them, errors included. A club's live socket is left alone: its
  // 101 comes from the ClubRoom's fetch, whose headers cannot be changed, and
  // setting one threw, so the upgrade answered 500 and no socket ever opened.
  app.use("*", async (c, next) => {
    await next();
    if (c.res.status !== 101 && !c.res.headers.has("Cache-Control"))
      c.res.headers.set("Cache-Control", "private, no-store");
  });

  // Middleware pipeline (spec-cf-api order): request id + db, session, profile.
  // Rate limit + zod validate apply per-route. Public reads skip auth naturally.
  // The operator bearer sits between session and profile, and only on /admin/*, so
  // its actor gets the same profile checks as a cookie session.
  app.use("*", contextMw);
  app.use("*", sessionMw(deps));
  app.use("/admin/*", operatorMw);
  app.use("/admin/*", adminAccessMw(deps));
  app.use("/ops/*", adminAccessMw(deps));
  app.use("*", profileMw);
  app.use("*", companionDepsMw(deps));
  app.use("*", billingDepsMw(deps));
  app.use("*", hubDepsMw(deps.resolveHub));

  app.route("/", catalogRoutes);
  app.route("/", profileRoutes);
  app.route("/", libraryRoutes);
  app.route("/", annotationRoutes);
  app.route("/", accountRoutes);
  app.route("/", companionRoutes);
  app.route("/", companionOpsRoutes);
  app.route("/", billingRoutes);
  app.route("/", stripeWebhookRoutes);
  app.route("/", clubRoutes);
  app.route("/", socialRoutes);
  app.route("/", diaryRoutes);
  app.route("/", reactionRoutes);
  app.route("/", syncRoutes);
  app.route("/", pushRoutes);
  app.route("/", adminRoutes);

  return app;
}

export { errors, AppError } from "./error";
export { rateLimit } from "./middleware/rate-limit";
export type { ApiDeps, Bindings, ClubLiveHub, Env, SessionUser, Variables } from "./types";
