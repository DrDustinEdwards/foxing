// Route helpers: session guard, the capped body read and step-5 zod validation at the boundary.
import { readCapped } from "@dustinedwards/site-runtime/body";
import type { Context } from "hono";
import type { z } from "zod";
import { errors } from "./error";
import type { Env, SessionUser } from "./types";

export function requireSession(c: Context<Env>): SessionUser {
  const session = c.get("session");
  if (!session) throw errors.unauthorized();
  return session;
}

/** The ceiling for an /api/v1 JSON body: far past a journal post or a 20,000-character review. */
export const BODY_MAX_BYTES = 1024 * 1024;

/** A sync push: up to 500 queued writes, each with up to 20,000 characters of text. */
export const SYNC_BODY_MAX_BYTES = 16 * 1024 * 1024;

/** A Stripe webhook event: Stripe's largest (an invoice with many lines) is well under this. */
export const WEBHOOK_BODY_MAX_BYTES = 1024 * 1024;

/** The request body as text, read to `max` as it arrives (site-runtime ./body); 413 over it. */
export async function readBody(c: Context<Env>, max = BODY_MAX_BYTES): Promise<string> {
  const text = await readCapped(c.req.raw, max);
  if (text === null) throw errors.tooLarge();
  return text;
}

export async function parseJson<S extends z.ZodTypeAny>(
  c: Context<Env>,
  schema: S,
  max = BODY_MAX_BYTES,
): Promise<z.infer<S>> {
  const text = await readBody(c, max);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw errors.validation({ body: "expected a JSON body" });
  }
  const result = schema.safeParse(body);
  if (!result.success) throw errors.validation(result.error.flatten());
  return result.data;
}
