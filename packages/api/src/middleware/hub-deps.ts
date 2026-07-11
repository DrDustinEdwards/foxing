// Attaches the injected live-layer hub to each request (Phase 5). Same shape as the
// companion/billing dep middleware: the Worker resolves the ClubRoom-backed hub from
// its env; when no resolver is provided a no-op hub is used, so non-club callers and
// the pre-Phase-5 test suites run without a Durable Object. Routes read it via
// c.get("hub") and call broadcast only AFTER the write has committed to D1.
import { createMiddleware } from "hono/factory";
import type { Bindings, ClubLiveHub, Env } from "../types";

const noopHub: ClubLiveHub = {
  async broadcast() {},
  async connect() {
    return new Response("Live layer unavailable.", { status: 503 });
  },
};

export const hubDepsMw = (resolveHub?: (env: Bindings) => ClubLiveHub) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("hub", resolveHub ? resolveHub(c.env) : noopHub);
    await next();
  });
