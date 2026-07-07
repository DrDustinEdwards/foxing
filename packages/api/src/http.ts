// Route helpers: session guard and step-5 zod validation at the boundary.
import type { Context } from "hono";
import type { z } from "zod";
import { errors } from "./error";
import type { Env, SessionUser } from "./types";

export function requireSession(c: Context<Env>): SessionUser {
  const session = c.get("session");
  if (!session) throw errors.unauthorized();
  return session;
}

export async function parseJson<S extends z.ZodTypeAny>(
  c: Context<Env>,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw errors.validation({ body: "expected a JSON body" });
  }
  const result = schema.safeParse(body);
  if (!result.success) throw errors.validation(result.error.flatten());
  return result.data;
}
