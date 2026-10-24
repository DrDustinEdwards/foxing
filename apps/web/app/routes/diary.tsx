// The signed-in reader's own reading log index (auth-gated, noindex). Reads run
// in-process via views.diary (the same view GET /diary serves) and seed the shared cache,
// so a new or edited entry shows here without a reload. Client-side filters by rating and whether
// an entry has a review. Logging a new entry lives at /diary/new.
import { useDiary } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import type { DiaryEntry as OwnDiaryEntry } from "@foxing/types";
import { useState } from "react";
import { Link } from "react-router";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary";

export function meta() {
  return [{ title: "Your diary | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return { entries: await views.diary(createDb(env.DB), user.id) };
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function Stars({ ratingHalf }: { ratingHalf: number | null }) {
  if (ratingHalf == null) return null;
  return (
    <span role="img" aria-label={`${ratingHalf / 2} stars`} className="fx-diary-label">
      {"★".repeat(Math.floor(ratingHalf / 2))}
      {ratingHalf % 2 === 1 ? "½" : ""}
    </span>
  );
}

const VIS_LABEL: Record<string, string> = {
  private: "Private",
  friends: "Friends",
  public: "Public",
};

function VisibilityBadge({ visibility }: { visibility: string }) {
  return <span className="shrink-0 fx-diary-caps">{VIS_LABEL[visibility] ?? visibility}</span>;
}

type RatingFilter = "all" | "rated" | "unrated";
type ReviewFilter = "all" | "reviewed";
type SortOrder = "newest" | "oldest" | "rating";

function matches(entry: OwnDiaryEntry, rating: RatingFilter, review: ReviewFilter): boolean {
  if (rating === "rated" && entry.ratingHalf == null) return false;
  if (rating === "unrated" && entry.ratingHalf != null) return false;
  if (review === "reviewed" && !entry.review?.trim()) return false;
  return true;
}

function yearOf(entry: OwnDiaryEntry): string {
  return entry.logDate ? String(new Date(entry.logDate).getUTCFullYear()) : "Undated";
}

function sortEntries(list: OwnDiaryEntry[], order: SortOrder): OwnDiaryEntry[] {
  const copy = [...list];
  if (order === "rating") {
    copy.sort(
      (a, b) => (b.ratingHalf ?? -1) - (a.ratingHalf ?? -1) || (b.logDate ?? 0) - (a.logDate ?? 0),
    );
  } else {
    // Nulls last for both directions.
    copy.sort((a, b) => {
      const av = a.logDate ?? -Infinity;
      const bv = b.logDate ?? -Infinity;
      return order === "newest" ? bv - av : av - bv;
    });
  }
  return copy;
}

/** Group a chronologically-sorted list under year headings (a timeline). Rating sort keeps
 *  one flat group since years interleave. */
function groupByYear(
  sorted: OwnDiaryEntry[],
  order: SortOrder,
): Array<{ label: string | null; items: OwnDiaryEntry[] }> {
  if (order === "rating") return [{ label: null, items: sorted }];
  const out: Array<{ label: string | null; items: OwnDiaryEntry[] }> = [];
  for (const e of sorted) {
    const y = yearOf(e);
    const last = out[out.length - 1];
    if (last && last.label === y) last.items.push(e);
    else out.push({ label: y, items: [e] });
  }
  return out;
}

export default function Diary({ loaderData }: Route.ComponentProps) {
  const entries = useDiary(loaderData.entries).data;
  const [rating, setRating] = useState<RatingFilter>("all");
  const [review, setReview] = useState<ReviewFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  // A book logged more than once anywhere in the diary is a re-read, flagged on each entry.
  const rereadIds = new Set<string>();
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.bookId)) rereadIds.add(e.bookId);
    else seen.add(e.bookId);
  }
  const shown = sortEntries(
    entries.filter((e) => matches(e, rating, review)),
    sort,
  );
  const groups = groupByYear(shown, sort);

  return (
    <PageShell>
      <Container>
        <div className="mb-8 items-end fx-diary-row">
          <PageHeader eyebrow="Reading" title="Your diary" className="mb-0" />
          <Link to="/diary/new" className="cap-btn shrink-0" data-variant="primary">
            New entry
          </Link>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title="No diary entries yet."
            body="Log a book to record what you read, when you read it, and what you thought."
          />
        ) : (
          <>
            <div className="mb-6 row-4 wrap">
              <label className="ui">
                <span className="fx-diary-caps-2">Rating</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value as RatingFilter)}
                  className="cap-select"
                >
                  <option value="all">All</option>
                  <option value="rated">Rated</option>
                  <option value="unrated">Unrated</option>
                </select>
              </label>
              <label className="ui">
                <span className="fx-diary-caps-2">Review</span>
                <select
                  value={review}
                  onChange={(e) => setReview(e.target.value as ReviewFilter)}
                  className="cap-select"
                >
                  <option value="all">All</option>
                  <option value="reviewed">With a review</option>
                </select>
              </label>
              <label className="ui">
                <span className="fx-diary-caps-2">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOrder)}
                  className="cap-select"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="rating">Highest rated</option>
                </select>
              </label>
              <span className="fine">
                {shown.length} of {entries.length}
              </span>
            </div>

            {shown.length === 0 ? (
              <EmptyState
                title="No entries match those filters."
                body="Try widening the filters."
              />
            ) : (
              <div className="stack-8">
                {groups.map((g) => (
                  <section key={g.label ?? "all"} className="stack">
                    {g.label ? <h2 className="fx-diary-caps-3">{g.label}</h2> : null}
                    <ul className="stack">
                      {g.items.map((e) => (
                        <EntryCard key={e.id} entry={e} reread={rereadIds.has(e.bookId)} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </PageShell>
  );
}

function RereadBadge() {
  return <span className="shrink-0 fx-diary-caps-4">Re-read</span>;
}

function EntryCard({ entry: e, reread }: { entry: OwnDiaryEntry; reread: boolean }) {
  return (
    <li className="fx-diary-card">
      <div className="shrink-0 fx-diary-box">
        {e.book ? (
          <Link to={`/books/${e.book.slug}`} className="block">
            <CoverImage
              src={e.book.coverUrl}
              alt={`Cover of ${e.book.title}`}
              fallbackLabel={e.book.title}
              sizes="64px"
            />
          </Link>
        ) : null}
      </div>
      <div className="fx-diary-box-2">
        <div className="row spread top">
          <div className="min-0">
            <div className="row-2 wrap">
              {e.book ? (
                <Link to={`/books/${e.book.slug}`} className="fx-diary-link">
                  {e.book.title}
                </Link>
              ) : (
                <span className="display-0">Unknown book</span>
              )}
              {reread ? <RereadBadge /> : null}
            </div>
            <div className="mt-1 row">
              <Stars ratingHalf={e.ratingHalf} />
              {e.logDate ? <span className="mono fine">{fmtDate.format(e.logDate)}</span> : null}
            </div>
          </div>
          <VisibilityBadge visibility={e.visibility} />
        </div>
        {e.review?.trim() ? <p className="mt-2 fx-diary-text">{e.review}</p> : null}
        <Link to={`/diary/${e.id}/edit`} className="mt-2 fx-diary-link-2">
          Edit
        </Link>
      </div>
    </li>
  );
}
