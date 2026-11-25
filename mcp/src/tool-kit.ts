// Shared plumbing for the Foxing Admin tools: result shapes, the admin API call wrappers, paging cursors, the confirm step and common input schemas.
import type { AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { base64url } from "@dustinedwards/site-runtime/encoding";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import { outsideResult } from "@dustinedwards/site-runtime/mcp-server";
import { z } from "zod";

import { ApiLegError, callAdmin, type ApiCallResult, type ApiEnv } from "./api-client";
import { confirmationFor, isConfirmed } from "./confirm";

export type ToolEnv = Partial<ApiEnv> & Partial<AuditEnv> & { ADMIN_EMAIL?: string };

export type ToolOutput = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

/** Reader-written text (names, bios, club names) goes through site-runtime's outsideResult, inside <data> delimiters. */
export const READER_DATA = "foxing-reader-data";

export function ok(data: Record<string, unknown>, outside: string | null = null): ToolOutput {
  if (outside) return outsideResult(outside, data);
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function said(data: Record<string, unknown>, line: string): ToolOutput {
  return {
    content: [{ type: "text", text: `${line}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: data,
  };
}

export function inputError(message: string): ToolOutput {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function refusal(result: ApiCallResult): ToolOutput {
  const parts = [result.error ?? "The Foxing admin API refused the request."];
  if (result.code) parts.push(`code: ${result.code}`);
  if (result.details !== undefined) parts.push(`details: ${JSON.stringify(result.details)}`);
  return {
    isError: true,
    content: [{ type: "text", text: parts.join("\n") }],
    structuredContent: {
      status: result.status,
      code: result.code ?? null,
      error: result.error ?? null,
      details: result.details ?? null,
    },
  };
}

/** A failure on this side: the client gets only its kind (raw text can carry hosts or config names); the detail goes to the log. */
export function wrapperFailure(cause: unknown): ToolOutput {
  const kind = cause instanceof ApiLegError ? cause.kind : "unexpected";
  console.error(
    JSON.stringify({
      tool_failure: kind,
      error: errorMessage(cause),
    }),
  );
  const message =
    cause instanceof ApiLegError
      ? `The MCP server could not complete its request to the Foxing admin API (${kind}). Nothing more is shown here; the detail is in the server's log.`
      : "The MCP server failed unexpectedly. Nothing more is shown here; the detail is in the server's log.";
  return { isError: true, content: [{ type: "text", text: message }] };
}

export async function guarded(body: () => Promise<ToolOutput>): Promise<ToolOutput> {
  try {
    return await body();
  } catch (cause) {
    return wrapperFailure(cause);
  }
}

export function single(
  env: ToolEnv,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: Parameters<typeof callAdmin>[3] = {},
  outside: string | null = null,
): Promise<ToolOutput> {
  return guarded(async () => {
    const result = await callAdmin(env, method, path, options);
    if (!result.ok) return refusal(result);
    return ok((result.data ?? {}) as Record<string, unknown>, outside);
  });
}

/** A cursor wraps an offset the client passes back unchanged; its shape can change without a tool change. */
export const CURSOR = /^c([0-9]{1,7})$/;

export function encodeOffsetCursor(offset: number): string {
  return base64url(`c${offset}`);
}

export function decodeOffsetCursor(cursor: string): number | null {
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(cursor)) return null;
  try {
    const match = CURSOR.exec(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export const offsetOf = (args: Record<string, unknown>) =>
  typeof args.cursor === "string" ? (decodeOffsetCursor(args.cursor) ?? 0) : 0;

export function pageOf(items: unknown[], limit: number, offset: number) {
  const hasMore = offset + limit < items.length;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    has_more: hasMore,
    next_cursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
  };
}

export function apiPageResult(
  env: ToolEnv,
  path: string,
  query: Record<string, string | number | undefined>,
  outside: string | null,
  signal?: AbortSignal,
) {
  return guarded(async () => {
    const result = await callAdmin(env, "GET", path, { signal, query });
    if (!result.ok) return refusal(result);
    const { next_offset: next, ...rest } = (result.data ?? {}) as Record<string, unknown>;
    return ok(
      { ...rest, next_cursor: typeof next === "number" ? encodeOffsetCursor(next) : null },
      outside,
    );
  });
}

/** Without `confirm` nothing is sent: the answer is a preview and a token for exactly these arguments. */
export async function confirmed(
  env: ToolEnv,
  tool: string,
  args: Record<string, unknown>,
  preview: Record<string, unknown>,
  run: () => Promise<ToolOutput>,
): Promise<ToolOutput> {
  if (typeof args.confirm === "string") {
    if (await isConfirmed(env, tool, args, args.confirm)) return run();
    return inputError(
      "This confirm token was not issued for exactly these arguments, or it has expired. Nothing was changed. " +
        "Call again without confirm for a fresh preview.",
    );
  }
  const issued = await confirmationFor(env, tool, args);
  if (!issued)
    return wrapperFailure(new ApiLegError("ADMIN_OPERATOR_TOKEN is unset", "unconfigured"));
  const pending = {
    confirmation_required: true,
    confirm: issued.token,
    expires_at: issued.expiresAt,
    preview,
  };
  return said(
    pending,
    "Nothing was changed. Show the administrator this preview and ask them to approve it. Only on their yes, call " +
      `${tool} again with exactly the same arguments plus confirm. The token is good for ten minutes and only for ` +
      "these arguments.",
  );
}

export type Annotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type Level = "read" | "write";

export interface ToolDefinition {
  name: string;
  /** The scope a call needs, fixed per tool and never inferred from an annotation. */
  scope: Level;
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodObject<z.ZodRawShape>;
    outputSchema: z.ZodObject<z.ZodRawShape>;
    annotations: Annotations;
  };
  handler: (
    env: ToolEnv,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<ToolOutput>;
}

export const READ_ONLY: Annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const idSchema = (what: string) => z.string().min(1).max(100).describe(`The ${what}'s id.`);

export const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .describe("Optional. Text to search for. Omit to list newest first.");

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .optional()
  .describe("Optional. How many records to return, 1 to 50. Defaults to 20.");

export const record = z.record(z.string(), z.unknown());

export const cursorSchema = z
  .string()
  .max(16)
  .refine(
    (c) => decodeOffsetCursor(c) !== null,
    "Invalid cursor: pass next_cursor from the previous page unchanged.",
  )
  .optional()
  .describe(
    "Optional. Pass next_cursor from the previous page, unchanged. Omit for the first page.",
  );

export const confirmSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/,
    "Pass the confirm token from the preview, unchanged.",
  )
  .optional()
  .describe(
    "Leave out on the first call: it changes nothing and returns a preview and a confirm token. After the " +
      "administrator approves the preview, call again with the same arguments and this token.",
  );

export const confirmationFields = {
  confirmation_required: z.literal(true).optional(),
  confirm: z.string().optional(),
  expires_at: z.string().optional(),
  preview: record.optional(),
};

export const apiPage = z.looseObject({
  items: z.array(record),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

export const localPage = z.object({
  items: z.array(z.unknown()),
  total: z.number().int(),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});
