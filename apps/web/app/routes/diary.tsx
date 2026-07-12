// The signed-in reader's own reading log index (auth-gated, noindex). Reads run
// in-process via loadOwnDiary (same diary query + book overlay the public profile uses,
// scoped to the owner with all visibilities). Client-side filters by rating and whether
// an entry has a review. Logging a new entry lives at /diary/new.
import { useState } from "react";
import { Link } from "react-router";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import type { OwnDiaryEntry } from "~/lib/social.server";
import { loadOwnDiary } from "~/lib/social.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary";

export function meta() {
  return [{ title: "Your diary | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const entries = await loadOwnDiary(env, user.id);
  return { entries };
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function Stars({ ratingHalf }: { ratingHalf: number | null }) {
  if (ratingHalf == null) return null;
  return (
    <span
      role="img"
      aria-label={`${ratingHalf / 2} stars`}
      className="font-mono text-sm text-brand-text"
    >
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
  return (
    <span className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
      {VIS_LABEL[visibility] ?? visibility}
    </span>
  );
}

type RatingFilter = "all" | "rated" | "unrated";
type ReviewFilter = "all" | "reviewed";

function matches(entry: OwnDiaryEntry, rating: RatingFilter, review: ReviewFilter): boolean {
  if (rating === "rated" && entry.ratingHalf == null) return false;
  if (rating === "unrated" && entry.ratingHalf != null) return false;
  if (review === "reviewed" && !entry.review?.trim()) return false;
  return true;
}

export default function Diary({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;
  const [rating, setRating] = useState<RatingFilter>("all");
  const [review, setReview] = useState<ReviewFilter>("all");
  const shown = entries.filter((e) => matches(e, rating, review));

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <PageHeader eyebrow="Reading" title="Your diary" className="mb-0" />
          <Link
            to="/diary/new"
            className="shrink-0 rounded-md bg-brand-ui px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:opacity-90"
          >
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
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <label className="font-ui text-sm text-secondary">
                <span className="mr-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
                  Rating
                </span>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value as RatingFilter)}
                  className="rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="rated">Rated</option>
                  <option value="unrated">Unrated</option>
                </select>
              </label>
              <label className="font-ui text-sm text-secondary">
                <span className="mr-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
                  Review
                </span>
                <select
                  value={review}
                  onChange={(e) => setReview(e.target.value as ReviewFilter)}
                  className="rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="reviewed">With a review</option>
                </select>
              </label>
              <span className="font-ui text-xs text-tertiary">
                {shown.length} of {entries.length}
              </span>
            </div>

            {shown.length === 0 ? (
              <EmptyState title="No entries match those filters." body="Try widening the filters." />
            ) : (
              <ul className="flex flex-col gap-4">
                {shown.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-4 rounded-card border border-border-subtle bg-surface p-4"
                  >
                    <div className="w-16 shrink-0">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {e.book ? (
                            <Link
                              to={`/books/${e.book.slug}`}
                              className="font-display text-lg text-primary hover:text-brand-text"
                            >
                              {e.book.title}
                            </Link>
                          ) : (
                            <span className="font-display text-lg text-primary">Unknown book</span>
                          )}
                          <div className="mt-1 flex items-center gap-3">
                            <Stars ratingHalf={e.ratingHalf} />
                            {e.logDate ? (
                              <span className="font-mono text-xs text-tertiary">
                                {fmtDate.format(e.logDate)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <VisibilityBadge visibility={e.visibility} />
                      </div>
                      {e.review?.trim() ? (
                        <p className="mt-2 line-clamp-3 font-body text-sm text-secondary">
                          {e.review}
                        </p>
                      ) : null}
                      <Link
                        to={`/diary/${e.id}/edit`}
                        className="mt-2 inline-block font-ui text-xs text-tertiary hover:text-brand-text hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Container>
    </PageShell>
  );
}
