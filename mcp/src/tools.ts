/**
 * The tools. Ruling mcp-2026-10-10 and capsid/research/design-mcp-servers.md
 * section 5 (Foxing Admin).
 *
 * WHOLE JOBS, NOT ENDPOINT MIRRORS (rule 4). Each tool finishes a job, and every
 * step of it is one authenticated request to /api/v1/admin, which owns every
 * rule. NAMES (rule 5) are `foxing_{action}_{resource}`. ANNOTATIONS (rule 6)
 * are set honestly, with the reasoning beside any that is not obvious.
 * RESPONSES (rule 7) page every list with has_more and an opaque next_cursor (checklist T8).
 * CONFIRMATION (checklist T11): the three tools that overwrite or publish change nothing until called again with the
 * token their first answer carries (confirm.ts).
 *
 * ONLY TOOLS THE API OFFERS. This server adds no route of its own, so a design
 * tool whose API route does not exist yet is not here:
 * - foxing_read_errors (no error or log read in the API),
 * - foxing_award_badge (no badge route),
 * - foxing_run_task (the one task route, /ops/companion-cache-batch, is outside
 *   /admin and takes no operator bearer),
 * - foxing_moderate_user and foxing_stage_tier_change, which wait for the
 *   preview-then-perform admin routes (DrDustinEdwards/foxing#20), so a tier
 *   change from here can only ever be staged for Dustin to confirm in the app.
 * create_journal_post is dropped for good: Carrel owns writing (rule 11). Book
 * of the Month delete stays in the admin screen.
 *
 * EVERY CALL GOES THROUGH site-runtime's invokeTool (mcp-handler.ts), which
 * proves the caller owns what the tool names (rule 12.1), checks the scope each
 * tool declares (12.3), and writes the append-only log before and after (12.4).
 */

import type { AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { base64url } from "@dustinedwards/site-runtime/encoding";
import { outsideResult } from "@dustinedwards/site-runtime/mcp-server";
import { z } from "zod";

import { ApiLegError, callAdmin, type ApiCallResult, type ApiEnv } from "./api-client";
import { confirmationFor, isConfirmed } from "./confirm";

export type ToolEnv = Partial<ApiEnv> & Partial<AuditEnv> & { ADMIN_EMAIL?: string };

/** The MCP content shape a tool returns. */
export type ToolOutput = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

/**
 * Rule 12.5 and checklist S2. Display names, usernames, bios and club names are written by Foxing's readers, and audit
 * params can carry them too: a result holding them goes through site-runtime's outsideResult, the shared data notice and
 * the value inside its <data> delimiters, under this label.
 */
const READER_DATA = "foxing-reader-data";

function ok(data: Record<string, unknown>, outside: string | null = null): ToolOutput {
  if (outside) return outsideResult(outside, data);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

/** A result that opens with a line for the client, then the JSON. */
function said(data: Record<string, unknown>, line: string): ToolOutput {
  return { content: [{ type: "text", text: `${line}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}

function inputError(message: string): ToolOutput {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** The API's refusal, its message VERBATIM, with its code and field details alongside. */
function refusal(result: ApiCallResult): ToolOutput {
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

/**
 * A failure on this side, named so it cannot be mistaken for the API refusing something. The client gets only its kind
 * (checklist S4: no raw error text, which can carry hosts, stack lines or config names); the detail goes to the log.
 */
function wrapperFailure(cause: unknown): ToolOutput {
  const kind = cause instanceof ApiLegError ? cause.kind : "unexpected";
  console.error(JSON.stringify({ tool_failure: kind, error: cause instanceof Error ? cause.message : String(cause) }));
  const message =
    cause instanceof ApiLegError
      ? `The MCP server could not complete its request to the Foxing admin API (${kind}). Nothing more is shown here; the detail is in the server's log.`
      : "The MCP server failed unexpectedly. Nothing more is shown here; the detail is in the server's log.";
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Wraps a handler body so an API-leg failure becomes a named tool error. */
async function guarded(body: () => Promise<ToolOutput>): Promise<ToolOutput> {
  try {
    return await body();
  } catch (cause) {
    return wrapperFailure(cause);
  }
}

/** One request; a 2xx JSON body becomes the result, anything else the API's refusal. */
function single(
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

/**
 * Opaque cursors (checklist T8). A cursor names a position in a list; a client passes it back unchanged and never
 * builds one. Today it wraps an offset, which the admin API takes; the shape can change without a tool change.
 */
const CURSOR = /^c([0-9]{1,7})$/;

export function encodeCursor(offset: number): string {
  return base64url(`c${offset}`);
}

/** The offset a cursor names, or null for anything this server did not issue. */
export function decodeCursor(cursor: string): number | null {
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(cursor)) return null;
  try {
    const match = CURSOR.exec(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

const offsetOf = (args: Record<string, unknown>) => (typeof args.cursor === "string" ? (decodeCursor(args.cursor) ?? 0) : 0);

/** Pages a list the API returns whole ({ items }), keeping has_more and next_cursor honest. */
function pageOf(items: unknown[], limit: number, offset: number) {
  const hasMore = offset + limit < items.length;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    has_more: hasMore,
    next_cursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}

/** One page the API cut ({ items, has_more, next_offset }), with its offset turned into a cursor. */
function apiPageResult(
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
    return ok({ ...rest, next_cursor: typeof next === "number" ? encodeCursor(next) : null }, outside);
  });
}

/**
 * The confirmation step (confirm.ts). Without `confirm`, nothing is sent: the answer is the preview and a token for
 * exactly these arguments. With a token that matches, `run` sends the change.
 */
async function confirmed(
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
  if (!issued) return wrapperFailure(new ApiLegError("ADMIN_OPERATOR_TOKEN is unset", "unconfigured"));
  const pending = { confirmation_required: true, confirm: issued.token, expires_at: issued.expiresAt, preview };
  return said(
    pending,
    "Nothing was changed. Show the administrator this preview and ask them to approve it. Only on their yes, call " +
      `${tool} again with exactly the same arguments plus confirm. The token is good for ten minutes and only for ` +
      "these arguments.",
  );
}

type Annotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

type Level = "read" | "write";

export interface ToolDefinition {
  name: string;
  /** The scope a call needs, never inferred from an annotation. A function where the action decides it. */
  scope: Level | ((args: Record<string, unknown>) => Level);
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodObject<z.ZodRawShape>;
    /** The shape of structuredContent on success (the SDK validates it); a refusal is isError and unchecked. */
    outputSchema: z.ZodObject<z.ZodRawShape>;
    annotations: Annotations;
  };
  handler: (env: ToolEnv, args: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolOutput>;
}

const READ_ONLY: Annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const idSchema = (what: string) => z.string().min(1).max(100).describe(`The ${what}'s id.`);

const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .describe("Optional. Text to search for. Omit to list newest first.");

/** The admin API pages at most 50 at a time (MAX_PAGE in packages/api/src/routes/admin.ts). */
const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .optional()
  .describe("Optional. How many records to return, 1 to 50. Defaults to 20.");

/** One record as the admin API returns it; its fields are the API's to change. */
const record = z.record(z.string(), z.unknown());

const cursorSchema = z
  .string()
  .max(16)
  .refine((c) => decodeCursor(c) !== null, "Invalid cursor: pass next_cursor from the previous page unchanged.")
  .optional()
  .describe("Optional. Pass next_cursor from the previous page, unchanged. Omit for the first page.");

const confirmSchema = z
  .string()
  .max(100)
  .optional()
  .describe(
    "Leave out on the first call: it changes nothing and returns a preview and a confirm token. After the " +
      "administrator approves the preview, call again with the same arguments and this token.",
  );

/** What the first, unconfirmed call returns instead of a result. */
const confirmationFields = {
  confirmation_required: z.literal(true).optional(),
  confirm: z.string().optional(),
  expires_at: z.string().optional(),
  preview: record.optional(),
};


/** A page from the admin API (`page` in packages/api/src/routes/admin.ts), its offset as a cursor. */
const apiPage = z.looseObject({
  items: z.array(record),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

/** A page this server cuts from a whole list (pageOf). */
const localPage = z.object({
  items: z.array(z.unknown()),
  total: z.number().int(),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

const yearSchema = z.number().int().min(2000).max(2100);
const monthSchema = z.number().int().min(1).max(12);

/** Book of the Month fields, in the tool's snake_case, mapped to the API's body. */
const botmFields = {
  book_id: z.string().min(1).max(100).nullable().optional().describe("The book's id, or null."),
  category: z.string().max(200).nullable().optional(),
  curator_note: z.string().max(5000).nullable().optional().describe("Foxing's note on the pick."),
  bookshop_url: z.string().url().max(1000).nullable().optional().describe("Bookshop.org link."),
  amazon_url: z.string().url().max(1000).nullable().optional().describe("Amazon link."),
};

function botmBody(args: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    book_id: "bookId",
    year: "year",
    month: "month",
    category: "category",
    curator_note: "curatorNote",
    bookshop_url: "bookshopUrl",
    amazon_url: "amazonUrl",
  };
  const body: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(map)) {
    if (args[from] !== undefined) body[to] = args[from];
  }
  return body;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "foxing_get_health",
    scope: "read",
    config: {
      title: "Foxing platform snapshot",
      description:
        "One look at foxing.app's numbers from D1: total users, Plus users, suspended users, books, " +
        "staff picks, reader clubs, published Journal posts, published Book of the Month entries, and " +
        "the ten newest sign-ups (id, username, tier, when). Read only. It does not yet report errors, " +
        "logs or the deploy: the admin API has no route for those.",
      inputSchema: z.object({}),
      outputSchema: z.looseObject({
        totalUsers: z.number(),
        plusUsers: z.number(),
        suspendedUsers: z.number(),
        totalBooks: z.number(),
        staffPicks: z.number(),
        totalClubs: z.number(),
        publishedJournal: z.number(),
        publishedBotm: z.number(),
        recentSignups: z.array(record),
      }),
      annotations: READ_ONLY,
    },
    handler: (env, _args, signal) => single(env, "GET", "/stats", { signal }, READER_DATA),
  },

  {
    name: "foxing_find_user",
    scope: "read",
    config: {
      title: "Find Foxing users",
      description:
        "Searches readers by username or display name, newest first, a page at a time. Each has id, " +
        "username, displayName, tier (free or plus), isAdmin (an email on the site's ADMIN_EMAILS setting, " +
        "or the old profiles.is_admin flag while that setting is unset), isSuspended and createdAt. Pass a user's " +
        "id to foxing_get_user_state for everything about them.",
      inputSchema: z.object({ query: querySchema, limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/users",
        { q: args.query as string | undefined, limit: args.limit as number | undefined, offset: args.cursor ? offsetOf(args) : undefined },
        READER_DATA,
        signal,
      ),
  },

  {
    name: "foxing_get_user_state",
    scope: "read",
    config: {
      title: "Read one user's state",
      description:
        "Everything the admin screen shows about one reader: the profile (tier, admin, suspended, " +
        "timezone and the rest), email, last active (latest session start), and activity counts (books " +
        "finished, highlights, clubs joined, diary entries). A 404 means no user has that id.",
      inputSchema: z.object({ user_id: idSchema("user") }),
      outputSchema: z.looseObject({ user: record, activity: record }),
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      single(
        env,
        "GET",
        `/users/${encodeURIComponent(String(args.user_id))}`,
        { signal },
        READER_DATA,
      ),
  },

  {
    name: "foxing_inspect_book",
    scope: "read",
    config: {
      title: "Find catalog books",
      description:
        "Searches the catalog by title or author, most recently updated first, a page at a time. Each " +
        "has id, title, author, slug (its page is foxing.app/books/<slug>), sourceType, isStaffPick and " +
        "publicationYear. Use the id with foxing_edit_book or foxing_set_book_of_month.",
      inputSchema: z.object({ query: querySchema, limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(env, "/books", {
        q: args.query as string | undefined,
        limit: args.limit as number | undefined,
        offset: args.cursor ? offsetOf(args) : undefined,
      }, null, signal),
  },

  {
    name: "foxing_edit_book",
    scope: "write",
    config: {
      title: "Edit a book's metadata or staff pick",
      description:
        "Corrects one catalog book and reports what was applied. Pass any of title, author, " +
        "description, publication_year, publisher and subjects to change those fields (null clears an " +
        "optional one), and/or staff_pick to feature or unfeature it with an optional note. Fields left " +
        "out are not touched. The admin API validates every field and records the change in Foxing's " +
        "admin audit log.",
      inputSchema: z.object({
        book_id: idSchema("book"),
        title: z.string().min(1).max(500).optional(),
        author: z.string().min(1).max(500).optional(),
        description: z.string().max(20000).nullable().optional(),
        publication_year: z.number().int().nullable().optional(),
        publisher: z.string().max(500).nullable().optional(),
        subjects: z.array(z.string()).nullable().optional(),
        staff_pick: z
          .object({
            on: z.boolean().describe("true features the book as a staff pick, false removes it."),
            note: z.string().max(500).nullable().optional(),
          })
          .optional(),
        confirm: confirmSchema,
      }),
      outputSchema: z.object({
        book_id: z.string().optional(),
        applied: z.object({ fields: z.array(z.string()).optional(), staff_pick: z.boolean().optional() }).optional(),
        ...confirmationFields,
      }),
      annotations: {
        readOnlyHint: false,
        // Destructive: a metadata edit overwrites the field, and books keep no history of it.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        const id = encodeURIComponent(String(args.book_id));
        const fields: Record<string, unknown> = {};
        const map: Record<string, string> = {
          title: "title",
          author: "author",
          description: "description",
          publication_year: "publicationYear",
          publisher: "publisher",
          subjects: "subjects",
        };
        for (const [from, to] of Object.entries(map)) {
          if (args[from] !== undefined) fields[to] = args[from];
        }
        const pick = args.staff_pick as { on: boolean; note?: string | null } | undefined;
        if (Object.keys(fields).length === 0 && !pick) {
          return inputError(
            "Nothing to change. Pass at least one of title, author, description, publication_year, " +
              "publisher, subjects or staff_pick.",
          );
        }
        const preview = { book_id: args.book_id, fields, staff_pick: pick ?? null };
        return confirmed(env, "foxing_edit_book", args, preview, async () => {
        const applied: Record<string, unknown> = {};
        if (Object.keys(fields).length > 0) {
          const result = await callAdmin(env, "PATCH", `/books/${id}`, { signal, body: fields });
          if (!result.ok) return refusal(result);
          applied.fields = Object.keys(fields);
        }
        if (pick) {
          const result = await callAdmin(env, "POST", `/books/${id}/staff-pick`, {
            signal,
            body: { on: pick.on, note: pick.note ?? null },
          });
          if (!result.ok) {
            const out = refusal(result);
            if (applied.fields) {
              out.content[0].text =
                `The field changes were applied; the staff pick was refused.\n${out.content[0].text}`;
            }
            return out;
          }
          applied.staff_pick = pick.on;
        }
        return ok({ book_id: args.book_id, applied });
        });
      }),
  },

  {
    name: "foxing_set_book_of_month",
    scope: (args) => (args.action === "list" || args.action === "get" ? "read" : "write"),
    config: {
      title: "Keep Foxing's Book of the Month",
      description:
        "Foxing's own monthly pick (foxing.app/book-of-the-month), not reader clubs or celebrity picks. " +
        "Actions:\n" +
        "- list: every entry, newest month first, a page at a time, with its book title and author.\n" +
        "- get (botm_id): one entry.\n" +
        "- create (year, month, and any of book_id, category, curator_note, bookshop_url, amazon_url): " +
        "a new entry, unpublished. Returns its id.\n" +
        "- update (botm_id, any of those fields): changes only what is passed.\n" +
        "- publish or unpublish (botm_id): shows or hides it on the site.\n" +
        "Deleting an entry stays in the admin screen.",
      inputSchema: z.object({
        action: z.enum(["list", "get", "create", "update", "publish", "unpublish"]),
        botm_id: z.string().min(1).max(100).optional().describe("For get, update, publish, unpublish."),
        year: yearSchema.optional().describe("For create (required) or update."),
        month: monthSchema.optional().describe("For create (required) or update. 1 to 12."),
        ...botmFields,
        limit: limitSchema,
        cursor: cursorSchema,
        confirm: confirmSchema,
      }),
      outputSchema: z
        .looseObject({
          items: z.array(z.unknown()).optional(),
          total: z.number().int().optional(),
          has_more: z.boolean().optional(),
          next_cursor: z.string().nullable().optional(),
          id: z.string().optional(),
          ok: z.boolean().optional(),
          ...confirmationFields,
        })
        .describe(
          "list: a page; get: the entry; create: its id; update, publish, unpublish: ok. A create, update, publish " +
            "or unpublish without confirm: the preview and its confirm token.",
        ),
      annotations: {
        readOnlyHint: false,
        // Destructive: update overwrites a curator note or link with no history.
        destructiveHint: true,
        // Not idempotent: create makes a new entry each time.
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        const action = args.action as string;
        if (action === "list") {
          const result = await callAdmin(env, "GET", "/botm", { signal });
          if (!result.ok) return refusal(result);
          const items = ((result.data as { items?: unknown[] })?.items ?? []) as unknown[];
          return ok(pageOf(items, (args.limit as number) ?? 20, offsetOf(args)));
        }
        const tool = "foxing_set_book_of_month";
        if (action === "create") {
          if (args.year === undefined || args.month === undefined) {
            return inputError("Action create needs year and month.");
          }
          const body = botmBody(args);
          return confirmed(env, tool, args, { action, send: body }, async () => {
            const result = await callAdmin(env, "POST", "/botm", { signal, body });
            return result.ok ? ok(result.data as Record<string, unknown>) : refusal(result);
          });
        }
        if (!args.botm_id) {
          return inputError(`Action ${action} needs botm_id. Call action list for the ids.`);
        }
        const id = encodeURIComponent(String(args.botm_id));
        if (action === "get") return single(env, "GET", `/botm/${id}`, { signal });
        if (action === "update") {
          const body = botmBody(args);
          if (Object.keys(body).length === 0) {
            return inputError("Action update needs at least one field to change.");
          }
          return confirmed(env, tool, args, { action, botm_id: args.botm_id, send: body }, () =>
            single(env, "PATCH", `/botm/${id}`, { signal, body }),
          );
        }
        const on = action === "publish";
        return confirmed(env, tool, args, { action, botm_id: args.botm_id }, () =>
          single(env, "POST", `/botm/${id}/publish`, { signal, body: { on } }),
        );
      }),
  },

  {
    name: "foxing_review_club_picks",
    scope: "read",
    config: {
      title: "Review celebrity book club picks",
      description:
        "The celebrity book clubs Foxing follows (foxing.app/book-clubs) and their picks, newest first, " +
        "a page at a time. Each pick has its club, book, month, isPublished, notes, curatorQuote and " +
        "category. Pass club_id to see one club's picks. Use a pick's id with foxing_publish_club_pick.",
      inputSchema: z.object({
        club_id: z.string().min(1).max(100).optional().describe("Optional. One club's id."),
        limit: limitSchema,
        cursor: cursorSchema,
      }),
      outputSchema: z.object({ clubs: z.array(z.unknown()), picks: localPage }),
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        const clubs = await callAdmin(env, "GET", "/pick-clubs", { signal });
        if (!clubs.ok) return refusal(clubs);
        const picks = await callAdmin(env, "GET", "/picks", {
          signal,
          query: { club_id: args.club_id as string | undefined },
        });
        if (!picks.ok) return refusal(picks);
        const items = ((picks.data as { items?: unknown[] })?.items ?? []) as unknown[];
        return ok({
          clubs: (clubs.data as { items?: unknown[] })?.items ?? [],
          picks: pageOf(items, (args.limit as number) ?? 20, offsetOf(args)),
        }, READER_DATA);
      }),
  },

  {
    name: "foxing_publish_club_pick",
    scope: "write",
    config: {
      title: "Publish or edit a celebrity pick",
      description:
        "Edits one celebrity book club pick and/or publishes or unpublishes it on foxing.app/book-clubs. " +
        "Pass any of notes, curator_quote and category to change them (null clears one), and publish " +
        "true or false to show or hide the pick. Edits are applied before the publish change.",
      inputSchema: z.object({
        pick_id: idSchema("pick"),
        publish: z.boolean().optional().describe("Optional. true publishes, false unpublishes."),
        notes: z.string().max(5000).nullable().optional(),
        curator_quote: z.string().max(2000).nullable().optional(),
        category: z.string().max(200).nullable().optional(),
        confirm: confirmSchema,
      }),
      outputSchema: z.object({
        pick_id: z.string().optional(),
        applied: z.object({ fields: z.array(z.string()).optional(), published: z.boolean().optional() }).optional(),
        ...confirmationFields,
      }),
      annotations: {
        readOnlyHint: false,
        // Destructive: an edit overwrites the notes or quote with no history.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        const id = encodeURIComponent(String(args.pick_id));
        const edits: Record<string, unknown> = {};
        if (args.notes !== undefined) edits.notes = args.notes;
        if (args.curator_quote !== undefined) edits.curatorQuote = args.curator_quote;
        if (args.category !== undefined) edits.category = args.category;
        if (Object.keys(edits).length === 0 && args.publish === undefined) {
          return inputError("Nothing to change. Pass publish, or at least one of notes, curator_quote or category.");
        }
        const preview = { pick_id: args.pick_id, fields: edits, publish: args.publish ?? null };
        return confirmed(env, "foxing_publish_club_pick", args, preview, async () => {
        const applied: Record<string, unknown> = {};
        if (Object.keys(edits).length > 0) {
          const result = await callAdmin(env, "PATCH", `/picks/${id}`, { signal, body: edits });
          if (!result.ok) return refusal(result);
          applied.fields = Object.keys(edits);
        }
        if (args.publish !== undefined) {
          const result = await callAdmin(env, "POST", `/picks/${id}/publish`, {
            signal,
            body: { on: args.publish },
          });
          if (!result.ok) {
            const out = refusal(result);
            if (applied.fields) {
              out.content[0].text =
                `The edits were applied; the publish change was refused.\n${out.content[0].text}`;
            }
            return out;
          }
          applied.published = args.publish;
        }
        return ok({ pick_id: args.pick_id, applied });
        });
      }),
  },

  {
    name: "foxing_read_audit_log",
    scope: "read",
    config: {
      title: "Read Foxing's admin audit log",
      description:
        "Foxing's own record of admin changes (admin_audit_log), newest first, a page at a time: action, " +
        "params, actor (the admin's user id), source IP and when. Changes made through this server carry " +
        'params.via "operator". This is the site\'s log; the MCP server keeps its own call log as well.',
      inputSchema: z.object({ limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/audit-log",
        { limit: args.limit as number | undefined, offset: args.cursor ? offsetOf(args) : undefined },
        READER_DATA,
        signal,
      ),
  },
];
