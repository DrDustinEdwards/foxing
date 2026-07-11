// @foxing/api - the Hono app, mountable in any Worker. Routes are thin and call
// packages/core. The Worker injects resolveSession (Better Auth) via createApi.
import { Hono } from "hono";
import { errorHandler } from "./error";
import { companionDepsMw } from "./middleware/companion-deps";
import { contextMw } from "./middleware/context";
import { profileMw } from "./middleware/profile";
import { sessionMw } from "./middleware/session";
import { accountRoutes } from "./routes/account";
import { companionRoutes } from "./routes/companion";
import { companionOpsRoutes } from "./routes/companion-ops";
import { libraryRoutes } from "./routes/library";
import { profileRoutes } from "./routes/profiles";
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

  app.route("/", profileRoutes);
  app.route("/", libraryRoutes);
  app.route("/", accountRoutes);
  app.route("/", companionRoutes);
  app.route("/", companionOpsRoutes);

  return app;
}

export { errors, AppError } from "./error";
export { rateLimit } from "./middleware/rate-limit";
export type { ApiDeps, Bindings, Env, SessionUser, Variables } from "./types";
