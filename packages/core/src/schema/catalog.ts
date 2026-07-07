// Catalog (8 tables). Migrates rows from Postgres in Phase 2.
// Community books are first-class here (tracking/diary/clubs/affiliate surface);
// readability is derived (source_type='catalog' AND epub_url present), not a column.
import { integer, primaryKey, real, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { bool, createdAt, idPk, json, ts, updatedAt } from "./_helpers";
import { user } from "./auth";

export const books = sqliteTable(
  "books",
  {
    id: idPk(),
    gutenbergId: integer("gutenberg_id"),
    title: text("title").notNull(),
    author: text("author").notNull(),
    authorSlug: text("author_slug"),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    coverUrl: text("cover_url"),
    epubUrl: text("epub_url"),
    source: text("source").notNull(),
    sourceType: text("source_type").notNull(), // catalog | community
    externalUrl: text("external_url"),
    language: text("language").notNull(),
    subjects: json<string[]>("subjects"),
    themes: json<string[]>("themes"),
    moodTags: json<string[]>("mood_tags"),
    contentWarnings: json<string[]>("content_warnings"),
    pacing: text("pacing"),
    readingDifficulty: real("reading_difficulty"),
    wordCount: integer("word_count"),
    publicationYear: integer("publication_year"),
    publisher: text("publisher"),
    country: text("country"),
    seriesName: text("series_name"),
    seriesOrder: real("series_order"),
    isbn: text("isbn"),
    isbn13: text("isbn13"),
    amazonUrl: text("amazon_url"),
    bookshopUrl: text("bookshop_url"),
    isStaffPick: bool("is_staff_pick").notNull().default(false),
    staffPickNote: text("staff_pick_note"),
    weightedRating: real("weighted_rating"),
    ratingCount: integer("rating_count").notNull().default(0),
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("books_author_slug_idx").on(t.authorSlug),
    index("books_source_type_idx").on(t.sourceType),
    index("books_isbn13_idx").on(t.isbn13),
  ],
);

export const bookAwards = sqliteTable(
  "book_awards",
  {
    id: idPk(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    awardSlug: text("award_slug").notNull(),
    awardName: text("award_name").notNull(),
    year: integer("year"),
    distinction: text("distinction").notNull(),
    scope: text("scope").notNull(),
    country: text("country"),
    url: text("url"),
    createdAt: createdAt(),
  },
  (t) => [index("book_awards_book_id_idx").on(t.bookId)],
);

export const externalBookClubs = sqliteTable("external_book_clubs", {
  id: idPk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  description: text("description"),
  curator: text("curator"),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  cadence: text("cadence"),
  focus: text("focus"),
  eras: json<string[]>("eras"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const externalBookClubPicks = sqliteTable(
  "external_book_club_picks",
  {
    id: idPk(),
    clubId: text("club_id")
      .notNull()
      .references(() => externalBookClubs.id, { onDelete: "cascade" }),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    pickedAt: ts("picked_at"),
    pickMonth: integer("pick_month"),
    pickYear: integer("pick_year"),
    category: text("category"),
    officialUrl: text("official_url"),
    notes: text("notes"),
    curatorQuote: text("curator_quote"),
    eraLabel: text("era_label"),
    eraStartYear: integer("era_start_year"),
    eraEndYear: integer("era_end_year"),
    autoSource: text("auto_source"),
    autoConfidence: real("auto_confidence"),
    isAutoDiscovered: bool("is_auto_discovered").notNull().default(false),
    isPublished: bool("is_published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("external_picks_club_id_idx").on(t.clubId)],
);

export const bookOfTheMonth = sqliteTable("book_of_the_month", {
  id: idPk(),
  bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  category: text("category"),
  curatorNote: text("curator_note"),
  amazonUrl: text("amazon_url"),
  bookshopUrl: text("bookshop_url"),
  isPublished: bool("is_published").notNull().default(false),
  createdAt: createdAt(),
});

export const journalPosts = sqliteTable(
  "journal_posts",
  {
    id: idPk(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    coverImageUrl: text("cover_image_url"),
    coverImageAlt: text("cover_image_alt"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    tags: json<string[]>("tags"),
    relatedPostIds: json<string[]>("related_post_ids"),
    featured: bool("featured").notNull().default(false),
    isPublished: bool("is_published").notNull().default(false),
    publishedAt: ts("published_at"),
    showPublishedAt: bool("show_published_at").notNull().default(true),
    showUpdatedAt: bool("show_updated_at").notNull().default(true),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    canonicalUrl: text("canonical_url"),
    readingTimeMinutes: integer("reading_time_minutes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("journal_posts_published_idx").on(t.isPublished, t.publishedAt)],
);

export const journalPostVersions = sqliteTable(
  "journal_post_versions",
  {
    id: idPk(),
    postId: text("post_id")
      .notNull()
      .references(() => journalPosts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    savedAt: ts("saved_at").notNull(),
    savedBy: text("saved_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("journal_post_versions_post_id_idx").on(t.postId)],
);

// Populated by Queue in Phase 4, catalog books only. PK (book_id, action).
export const bookAiCache = sqliteTable(
  "book_ai_cache",
  {
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    content: text("content", { mode: "json" }).notNull(),
    model: text("model"),
    generatedAt: ts("generated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.action] })],
);
