// Attaches the injected live-layer hub; a no-op hub is used when no resolver is provided. Routes call broadcast only AFTER the write has committed to D1.
import { createMiddleware } from "hono/factory";
import type { Bindings, ClubLiveHub, Env } from "../types";

const noopHub: ClubLiveHub = {
  async broadcast() {},
  async disconnect() {},
  async connect() {
    return new Response("Live layer unavailable.", { status: 503 });
  },
};

export const hubDepsMw = (resolveHub?: (env: Bindings) => ClubLiveHub) =>
  createMiddleware<Env>(async (c, next) => {
    c.set("hub", resolveHub ? resolveHub(c.env) : noopHub);
    await next();
  });
