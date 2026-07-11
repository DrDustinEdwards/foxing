// Step 4: Workers rate-limiting. auth class keys on IP (5/min), write class keys on
// user id (60/min), companion class keys on user id (20/min, spec-cf-api). Bindings
// are optional so local/miniflare runs without them.
import { createMiddleware } from "hono/factory";
import { errors } from "../error";
import type { Env } from "../types";

type RlClass = "auth" | "write" | "companion";

export const rateLimit = (cls: RlClass) =>
  createMiddleware<Env>(async (c, next) => {
    const binding =
      cls === "auth" ? c.env.AUTH_RL : cls === "write" ? c.env.WRITE_RL : c.env.COMPANION_RL;
    if (binding) {
      const ip = c.req.raw.headers.get("cf-connecting-ip") ?? "anon";
      const key = cls === "auth" ? ip : (c.get("session")?.id ?? ip);
      const { success } = await binding.limit({ key });
      if (!success) throw errors.rateLimited();
    }
    await next();
  });
