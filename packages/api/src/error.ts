// Error envelope: every failure returns { error: { code, message, details? } }.
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new AppError(401, "unauthorized", "Sign in required."),
  forbidden: (message = "Not allowed.") => new AppError(403, "forbidden", message),
  notFound: (message = "Not found.") => new AppError(404, "not_found", message),
  conflict: (message: string) => new AppError(409, "conflict", message),
  rateLimited: () => new AppError(429, "rate_limited", "Too many requests."),
  validation: (details: unknown) => new AppError(422, "validation", "Invalid request.", details),
};

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as never,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "validation", message: "Invalid request.", details: err.flatten() } },
      422,
    );
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: "http_error", message: err.message } }, err.status);
  }
  const requestId = c.get("requestId");
  console.error(`[${requestId}] unhandled`, err);
  return c.json({ error: { code: "internal", message: "Something went wrong." } }, 500);
}
