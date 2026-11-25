// Foxing Admin tools for Book of the Month and club picks.
import { z } from "zod";
import { callAdmin } from "./api-client";
import {
  READER_DATA,
  READ_ONLY,
  confirmSchema,
  confirmationFields,
  confirmed,
  cursorSchema,
  guarded,
  idSchema,
  inputError,
  limitSchema,
  localPage,
  offsetOf,
  ok,
  pageOf,
  refusal,
  single,
  type ToolDefinition,
} from "./tool-kit";

const yearSchema = z.number().int().min(2000).max(2100);
const monthSchema = z.number().int().min(1).max(12);

const botmFields = {
  book_id: z.string().min(1).max(100).nullable().optional().describe("The book's id, or null."),
  category: z.string().max(200).nullable().optional(),
  curator_note: z.string().max(5000).nullable().optional().describe("Foxing's note on the pick."),
  bookshop_url: z
    .url({ protocol: /^https?$/ })
    .max(1000)
    .nullable()
    .optional()
    .describe("Bookshop.org link."),
  amazon_url: z
    .url({ protocol: /^https?$/ })
    .max(1000)
    .nullable()
    .optional()
    .describe("Amazon link."),
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

export const picksTools: ToolDefinition[] = [
  {
    name: "foxing_read_book_of_month",
    scope: "read",
    config: {
      title: "Read Foxing's Book of the Month",
      description:
        "Foxing's own monthly pick (foxing.app/book-of-the-month), not reader clubs or celebrity picks. " +
        "Actions:\n" +
        "- list: every entry, newest month first, a page at a time, with its book title and author.\n" +
        "- get (botm_id): one entry.\n" +
        "Writes nothing; foxing_set_book_of_month changes an entry.",
      inputSchema: z.strictObject({
        action: z.enum(["list", "get"]),
        botm_id: z.string().min(1).max(100).optional().describe("For get."),
        limit: limitSchema,
        cursor: cursorSchema,
      }),
      outputSchema: z
        .looseObject({
          items: z.array(z.unknown()).optional(),
          total: z.number().int().optional(),
          has_more: z.boolean().optional(),
          next_cursor: z.string().nullable().optional(),
          id: z.string().optional(),
        })
        .describe("list: a page; get: the entry."),
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        if (args.action === "list") {
          const result = await callAdmin(env, "GET", "/botm", { signal });
          if (!result.ok) return refusal(result);
          const items = ((result.data as { items?: unknown[] })?.items ?? []) as unknown[];
          return ok(pageOf(items, (args.limit as number) ?? 20, offsetOf(args)));
        }
        if (!args.botm_id)
          return inputError("Action get needs botm_id. Call action list for the ids.");
        return single(env, "GET", `/botm/${encodeURIComponent(String(args.botm_id))}`, { signal });
      }),
  },

  {
    name: "foxing_set_book_of_month",
    scope: "write",
    config: {
      title: "Change Foxing's Book of the Month",
      description:
        "Foxing's own monthly pick (foxing.app/book-of-the-month), not reader clubs or celebrity picks. " +
        "Reading the entries is foxing_read_book_of_month. Actions:\n" +
        "- create (year, month, and any of book_id, category, curator_note, bookshop_url, amazon_url): " +
        "a new entry, unpublished. Returns its id.\n" +
        "- update (botm_id, any of those fields): changes only what is passed.\n" +
        "- publish or unpublish (botm_id): shows or hides it on the site.\n" +
        "Deleting an entry stays in the admin screen.",
      inputSchema: z.strictObject({
        action: z.enum(["create", "update", "publish", "unpublish"]),
        botm_id: z.string().min(1).max(100).optional().describe("For update, publish, unpublish."),
        year: yearSchema.optional().describe("For create (required) or update."),
        month: monthSchema.optional().describe("For create (required) or update. 1 to 12."),
        ...botmFields,
        confirm: confirmSchema,
      }),
      outputSchema: z
        .looseObject({
          id: z.string().optional(),
          ok: z.boolean().optional(),
          ...confirmationFields,
        })
        .describe(
          "create: its id; update, publish, unpublish: ok. A create, update, publish " +
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
      inputSchema: z.strictObject({
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
        return ok(
          {
            clubs: (clubs.data as { items?: unknown[] })?.items ?? [],
            picks: pageOf(items, (args.limit as number) ?? 20, offsetOf(args)),
          },
          READER_DATA,
        );
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
      inputSchema: z.strictObject({
        pick_id: idSchema("pick"),
        publish: z.boolean().optional().describe("Optional. true publishes, false unpublishes."),
        notes: z.string().max(5000).nullable().optional(),
        curator_quote: z.string().max(2000).nullable().optional(),
        category: z.string().max(200).nullable().optional(),
        confirm: confirmSchema,
      }),
      outputSchema: z.object({
        pick_id: z.string().optional(),
        applied: z
          .object({ fields: z.array(z.string()).optional(), published: z.boolean().optional() })
          .optional(),
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
          return inputError(
            "Nothing to change. Pass publish, or at least one of notes, curator_quote or category.",
          );
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
                out.content[0].text = `The edits were applied; the publish change was refused.\n${out.content[0].text}`;
              }
              return out;
            }
            applied.published = args.publish;
          }
          return ok({ pick_id: args.pick_id, applied });
        });
      }),
  },
];
