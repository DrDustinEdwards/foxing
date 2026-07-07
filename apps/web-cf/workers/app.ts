// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
import { createApi } from "@foxing/api";
import { Hono } from "hono";
import { RouterContextProvider, createRequestHandler } from "react-router";
import { cloudflareContext } from "../app/context";
import { getAuth } from "../app/lib/auth.server";

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const api = createApi({
  resolveSession: async (req, env) => {
    const session = await getAuth(env as unknown as Env).api.getSession({ headers: req.headers });
    if (!session?.user) return null;
    return { id: session.user.id, email: session.user.email };
  },
});

const app = new Hono<{ Bindings: Env }>();

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.route("/api/v1", api);

app.all("*", (c) => {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: c.env,
    ctx: c.executionCtx as unknown as ExecutionContext,
  });
  return reactRouterHandler(c.req.raw, context);
});

export default app;
