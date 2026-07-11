// @foxing/api - the Hono app, mountable in any Worker. Routes are thin and call
// packages/core. The Worker injects resolveSession (Better Auth) via createApi.
import { Hono } from "hono";
import { errorHandler } from "./error";
import { billingDepsMw } from "./middleware/billing-deps";
import { companionDepsMw } from "./middleware/companion-deps";
import { contextMw } from "./middleware/context";
import { hubDepsMw } from "./middleware/hub-deps";
import { profileMw } from "./middleware/profile";
import { sessionMw } from "./middleware/session";
import { accountRoutes } from "./routes/account";
import { billingRoutes } from "./routes/billing";
import { clubRoutes } from "./routes/clubs";
import { companionRoutes } from "./routes/companion";
import { companionOpsRoutes } from "./routes/companion-ops";
import { libraryRoutes } from "./routes/library";
import { profileRoutes } from "./routes/profiles";
import { stripeWebhookRoutes } from "./routes/webhooks-stripe";
import type { ApiDeps, Env } from "./types";

export function createApi(deps: ApiDeps) {
  const app = new Hono<Env>();

  app.onError(errorHandler);

  // Middleware pipeline (spec-cf-api order): request id + db, session, profile.
  // Rate limit + zod validate apply per-route. Public reads skip auth naturally.
  app.use("*", contextMw);
  app.use("*", sessionMw(deps));
  app.use("*", profileMw);
  app.use("*", companionDepsMw(deps));
  app.use("*", billingDepsMw(deps));
  app.use("*", hubDepsMw(deps.resolveHub));

  app.route("/", profileRoutes);
  app.route("/", libraryRoutes);
  app.route("/", accountRoutes);
  app.route("/", companionRoutes);
  app.route("/", companionOpsRoutes);
  app.route("/", billingRoutes);
  app.route("/", stripeWebhookRoutes);
  app.route("/", clubRoutes);

  return app;
}

export { errors, AppError } from "./error";
export { rateLimit } from "./middleware/rate-limit";
export type { ApiDeps, Bindings, ClubLiveHub, Env, SessionUser, Variables } from "./types";
