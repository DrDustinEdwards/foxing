// Foxing Admin tools for the catalog: inspect, edit and check books.
import { z } from "zod";
import {
  READER_DATA,
  READ_ONLY,
  apiPage,
  apiPageResult,
  confirmSchema,
  confirmationFields,
  confirmed,
  cursorSchema,
  guarded,
  patchThenPost,
  idSchema,
  inputError,
  limitSchema,
  offsetOf,
  ok,
  querySchema,
  type ToolDefinition,
} from "./tool-kit";

export const catalogTools: ToolDefinition[] = [
  {
    name: "foxing_inspect_book",
    scope: "read",
    config: {
      title: "Find catalog books",
      description:
        "Searches the catalog by title or author, most recently updated first, a page at a time. Each " +
        "has id, title, author, slug (its page is foxing.app/books/<slug>), sourceType, isStaffPick and " +
        "publicationYear. Use the id with foxing_edit_book or foxing_set_book_of_month.",
      inputSchema: z.strictObject({ query: querySchema, limit: limitSchema, cursor: cursorSchema }),
      outputSchema: apiPage,
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/books",
        {
          q: args.query as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.cursor ? offsetOf(args) : undefined,
        },
        null,
        signal,
      ),
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
      inputSchema: z.strictObject({
        book_id: idSchema("book"),
        title: z.string().min(1).max(500).optional(),
        author: z.string().min(1).max(500).optional(),
        description: z.string().max(20000).nullable().optional(),
        publication_year: z.number().int().nullable().optional(),
        publisher: z.string().max(500).nullable().optional(),
        subjects: z
          .array(z.string().regex(/^[a-z-]{1,40}$/))
          .nullable()
          .optional(),
        staff_pick: z
          .strictObject({
            on: z.boolean().describe("true features the book as a staff pick, false removes it."),
            note: z.string().max(500).nullable().optional(),
          })
          .optional(),
        confirm: confirmSchema,
      }),
      outputSchema: z.object({
        book_id: z.string().optional(),
        applied: z
          .object({ fields: z.array(z.string()).optional(), staff_pick: z.boolean().optional() })
          .optional(),
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
          const done = await patchThenPost(
            env,
            signal,
            { path: `/books/${id}`, fields },
            {
              path: `/books/${id}/staff-pick`,
              body: pick ? { on: pick.on, note: pick.note ?? null } : null,
              key: "staff_pick",
              value: pick?.on,
              partial: "The field changes were applied; the staff pick was refused.",
            },
          );
          if (!("applied" in done)) return done;
          const { applied } = done;
          return ok({ book_id: args.book_id, applied });
        });
      }),
  },

  {
    name: "foxing_check_catalog",
    scope: "read",
    config: {
      title: "Check the catalog's health",
      description:
        "Audits every book in the catalog for data problems and returns counts for all checks plus the " +
        "affected books, errors first, a page at a time. Checks: missing_cover, cover_not_hosted (cover " +
        "is not on Foxing's covers host), missing_description, missing_epub, missing_year and " +
        "missing_subjects (these four only for catalog books, not reader-added community ones), " +
        "invalid_isbn (wrong length or failing check digit), isbn_mismatch (ISBN-10 and ISBN-13 are " +
        "different editions), duplicate_isbn, duplicate_gutenberg_id, duplicate_title_author (a " +
        "possible duplicate: case, accents, punctuation and a leading article are ignored), " +
        "bad_retailer_link (a Bookshop.org or Amazon link that is not an https link to that retailer). " +
        "Also counts published Book of the Month entries and celebrity picks with no book " +
        "(publishedWithoutBook). Start with no arguments for the counts; pass check to list one " +
        "check's books. Each finding has bookId, title, author, slug, severity and a detail line; fix " +
        "with foxing_edit_book. Read only.",
      inputSchema: z.strictObject({
        check: z
          .enum([
            "missing_cover",
            "cover_not_hosted",
            "missing_description",
            "missing_epub",
            "missing_year",
            "missing_subjects",
            "invalid_isbn",
            "isbn_mismatch",
            "duplicate_isbn",
            "duplicate_gutenberg_id",
            "duplicate_title_author",
            "bad_retailer_link",
          ])
          .optional()
          .describe("Optional. List only this check's books. Omit to list all, errors first."),
        limit: limitSchema,
        cursor: cursorSchema,
      }),
      outputSchema: apiPage.extend({
        checkedBooks: z.number().int(),
        checks: z.array(
          z.object({
            check: z.string(),
            severity: z.enum(["error", "warning"]),
            count: z.number().int(),
            meaning: z.string(),
          }),
        ),
        publishedWithoutBook: z.object({ botm: z.number().int(), picks: z.number().int() }),
      }),
      annotations: READ_ONLY,
    },
    handler: (env, args, signal) =>
      apiPageResult(
        env,
        "/catalog-health",
        {
          check: args.check as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.cursor ? offsetOf(args) : undefined,
        },
        READER_DATA,
        signal,
      ),
  },
];
