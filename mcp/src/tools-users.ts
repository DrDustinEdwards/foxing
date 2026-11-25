// Foxing Admin tools for readers: the platform snapshot, finding and reading a user, the audit log and suspension.
import { z } from "zod";
import { callAdmin } from "./api-client";
import {
  READER_DATA,
  READ_ONLY,
  apiPage,
  apiPageResult,
  confirmSchema,
  cursorSchema,
  guarded,
  idSchema,
  limitSchema,
  offsetOf,
  ok,
  querySchema,
  record,
  refusal,
  single,
  type ToolDefinition,
} from "./tool-kit";

const NOT_FOUND_DAYS = 7;

export const userTools: ToolDefinition[] = [
  {
    name: "foxing_get_health",
    scope: "read",
    config: {
      title: "Foxing platform snapshot",
      description:
        "One look at foxing.app: total users, Plus users, suspended users, books, staff picks, reader " +
        "clubs, published Journal posts, published Book of the Month entries, the ten newest sign-ups " +
        "(id, username, tier, when), and notFound: the pages visitors asked for that do not exist " +
        "(broken links), most-hit first, over the last 7 days, each with its hits and the sites that " +
        "linked to it. Scanner probes (/wp-admin, .env and the like) are left out. If the 404 report " +
        "cannot be read, notFound says so and the rest is still returned. Read only. It does not yet " +
        "report errors, logs or the deploy: the admin API has no route for those. For problems in the " +
        "book data use foxing_check_catalog.",
      inputSchema: z.strictObject({}),
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
        notFound: z
          .object({
            days: z.number().int().optional(),
            totalHits: z.number().int().optional(),
            top: z.array(record).optional(),
            unavailable: z.string().optional(),
          })
          .describe("The 404 report; `unavailable` says why it is missing."),
      }),
      annotations: READ_ONLY,
    },
    handler: (env, _args, signal) =>
      guarded(async () => {
        const stats = await callAdmin(env, "GET", "/stats", { signal });
        if (!stats.ok) return refusal(stats);
        const report = await callAdmin(env, "GET", "/not-found", {
          signal,
          query: { days: NOT_FOUND_DAYS, limit: 10 },
        });
        let notFound: Record<string, unknown>;
        if (report.ok) {
          const items = ((report.data as { items?: Array<{ hits?: number }> })?.items ??
            []) as Array<{ hits?: number }>;
          notFound = {
            days: NOT_FOUND_DAYS,
            totalHits: items.reduce((n, row) => n + Number(row.hits ?? 0), 0),
            top: items,
          };
        } else {
          notFound = {
            unavailable: `The 404 report was refused (${report.status}): ${report.error}`,
          };
        }
        return ok({ ...(stats.data as Record<string, unknown>), notFound }, READER_DATA);
      }),
  },

  {
    name: "foxing_find_user",
    scope: "read",
    config: {
      title: "Find Foxing users",
      description:
        "Searches readers by username or display name, newest first, a page at a time. Each has id, " +
        "username, displayName, tier (free or plus), isAdmin (an email on the site's ADMIN_EMAIL and CO_OWNER_EMAILS setting), " +
        "isSuspended and createdAt. Pass a user's id to foxing_get_user_state for everything about them.",
      inputSchema: z.strictObject({ query: querySchema, limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/users",
        {
          q: args.query as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.cursor ? offsetOf(args) : undefined,
        },
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
      inputSchema: z.strictObject({ user_id: idSchema("user") }),
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
    name: "foxing_read_audit_log",
    scope: "read",
    config: {
      title: "Read Foxing's admin audit log",
      description:
        "Foxing's own record of admin changes (admin_audit_log), newest first, a page at a time: action, " +
        "params, actor (the admin's user id), source IP and when. Changes made through this server carry " +
        'params.via "operator". This is the site\'s log; the MCP server keeps its own call log as well.',
      inputSchema: z.strictObject({ limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/audit-log",
        {
          limit: args.limit as number | undefined,
          offset: args.cursor ? offsetOf(args) : undefined,
        },
        READER_DATA,
        signal,
      ),
  },

  {
    name: "foxing_moderate_user",
    scope: "write",
    config: {
      title: "Suspend or unsuspend a reader",
      description:
        "Suspends a reader or lifts a suspension. A suspended reader can still sign in and read, but every " +
        "write they send is refused. Two steps, both on the same arguments: first call with user_id and " +
        "suspended (true suspends, false unsuspends). That changes nothing and returns the API's preview " +
        "(who, from, to, what it means) and a single-use confirm token good for two minutes. Show the " +
        "preview to the administrator; only on their yes, call again with the same user_id and suspended " +
        "plus confirm. If the reader changed in between, or the token expired or was used, the API refuses " +
        "and you preview again. Find the id with foxing_find_user. Every suspension is recorded in " +
        "Foxing's admin audit log (foxing_read_audit_log).",
      inputSchema: z.strictObject({
        user_id: idSchema("reader"),
        suspended: z.boolean().describe("true suspends the reader, false lifts the suspension."),
        confirm: confirmSchema,
      }),
      outputSchema: z.looseObject({
        ok: z.boolean().optional(),
        user_id: z.string().optional(),
        suspended: z.boolean().optional(),
        confirmation_required: z.literal(true).optional(),
        confirm: z.string().optional(),
        expires_at: z.string().optional(),
        preview: record.optional(),
        next_step: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        // Not destructive: nothing is deleted, and the same tool lifts it. It does restrict a person, which is
        // what the API's preview and token are for.
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: (env, args, signal) =>
      guarded(async () => {
        const body: Record<string, unknown> = { suspended: args.suspended };
        if (typeof args.confirm === "string") body.confirm = args.confirm;
        const result = await callAdmin(
          env,
          "POST",
          `/users/${encodeURIComponent(String(args.user_id))}/suspend`,
          { signal, body },
        );
        if (!result.ok) return refusal(result);
        if (typeof args.confirm === "string") {
          return ok({ ok: true, user_id: args.user_id, suspended: args.suspended });
        }
        // The preview names the reader (username, display name): reader-written text, so it is marked as data.
        const { preview, confirm } = result.data as {
          preview?: Record<string, unknown>;
          confirm?: { token?: string; expiresAt?: string };
        };
        return ok(
          {
            confirmation_required: true,
            confirm: confirm?.token,
            expires_at: confirm?.expiresAt,
            preview,
            next_step:
              "Nothing was changed. Show the administrator this preview and ask them to approve it. Only on " +
              "their yes, call foxing_moderate_user again with exactly the same user_id and suspended plus " +
              "confirm. The token is good for two minutes and only for this change.",
          },
          READER_DATA,
        );
      }),
  },
];
