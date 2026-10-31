// Route helpers: session guard, the capped body read and step-5 zod validation at the boundary.
import { readCapped, requireJson } from "@dustinedwards/site-runtime/body";
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
const BODY_MAX_BYTES = 1024 * 1024;

/** A sync push: up to 500 queued writes, each with up to 20,000 characters of text. */
export const SYNC_BODY_MAX_BYTES = 16 * 1024 * 1024;

/** A Stripe webhook event: Stripe's largest (an invoice with many lines) is well under this. */
export const WEBHOOK_BODY_MAX_BYTES = 1024 * 1024;

/**
 * The request body as text, read to `max` as it arrives (site-runtime ./body); 413 over it. A session's body is JSON, so
 * one of any other type is a 415 (requireJson): a form or text/plain post is one any page can send with the session
 * cookie and no preflight. An empty body (DELETE /account with no choices) needs no type, and a signed webhook passes
 * `anyType`, since its signature, not a cookie, is what it carries.
 */
export async function readBody(c: Context<Env>, max = BODY_MAX_BYTES, anyType = false): Promise<string> {
  const text = await readCapped(c.req.raw, max);
  if (text === null) throw errors.tooLarge();
  if (!anyType && text !== "" && requireJson(c.req.raw)) throw errors.unsupportedType();
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
