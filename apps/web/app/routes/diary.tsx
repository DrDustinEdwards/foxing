import { useDiary } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import type { DiaryEntry as OwnDiaryEntry } from "@foxing/types";
import { useState } from "react";
import { NativeSelect } from "capsomer/react/select-native";
import { ButtonLink, Link } from "capsomer/react/link";
import { Rating } from "capsomer/react/rating";
import "capsomer/rating.css";
import { mediumDate } from "~/lib/dates";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary";
import { noindexPageMeta } from "~/lib/seo";

export function meta() {
  return noindexPageMeta("Your diary | Foxing");
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return { entries: await views.diary(createDb(env.DB), user.id) };
}

const VIS_LABEL: Record<string, string> = {
  private: "Private",
  friends: "Friends",
  public: "Public",
};

function VisibilityBadge({ visibility }: { visibility: string }) {
  return <span className="cap-keep fx-diary-caps">{VIS_LABEL[visibility] ?? visibility}</span>;
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
    copy.sort((a, b) => {
      const av = a.logDate ?? -Infinity;
      const bv = b.logDate ?? -Infinity;
      return order === "newest" ? bv - av : av - bv;
    });
  }
  return copy;
}

/** Group a chronologically-sorted list under year headings; a rating sort keeps one flat group since years interleave. */
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
      <Container className="cap-stack" data-gap="7">
        <PageHeader
          title="Your diary"
          actions={
            <ButtonLink to="/diary/new" className="cap-keep" variant="primary">
              New entry
            </ButtonLink>
          }
        />

        {entries.length === 0 ? (
          <EmptyState title="No diary entries yet." />
        ) : (
          <div className="cap-stack" data-gap="6">
            <div className="cap-cluster" data-gap="5">
              <label className="cap-text" data-size="small" data-tone="muted" data-face="ui">
                <span className="fx-diary-caps-2">Rating</span>
                <NativeSelect
                  value={rating}
                  onChange={(e) => setRating(e.target.value as RatingFilter)}
                  options={[
                    { value: "all", label: "All" },
                    { value: "rated", label: "Rated" },
                    { value: "unrated", label: "Unrated" },
                  ]}
                />
              </label>
              <label className="cap-text" data-size="small" data-tone="muted" data-face="ui">
                <span className="fx-diary-caps-2">Review</span>
                <NativeSelect
                  value={review}
                  onChange={(e) => setReview(e.target.value as ReviewFilter)}
                  options={[
                    { value: "all", label: "All" },
                    { value: "reviewed", label: "With a review" },
                  ]}
                />
              </label>
              <label className="cap-text" data-size="small" data-tone="muted" data-face="ui">
                <span className="fx-diary-caps-2">Sort</span>
                <NativeSelect
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOrder)}
                  options={[
                    { value: "newest", label: "Newest" },
                    { value: "oldest", label: "Oldest" },
                    { value: "rating", label: "Highest rated" },
                  ]}
                />
              </label>
              <span className="cap-text" data-size="tiny" data-tone="dim" data-face="ui">
                {shown.length} of {entries.length}
              </span>
            </div>

            {shown.length === 0 ? (
              <EmptyState title="No entries match those filters." />
            ) : (
              <div className="cap-stack" data-gap="7">
                {groups.map((g) => (
                  <section key={g.label ?? "all"} className="cap-stack">
                    {g.label ? <h2 className="fx-diary-caps-3">{g.label}</h2> : null}
                    <ul className="cap-stack">
                      {g.items.map((e) => (
                        <EntryCard key={e.id} entry={e} reread={rereadIds.has(e.bookId)} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
    </PageShell>
  );
}

function RereadBadge() {
  return <span className="cap-keep fx-diary-caps-4">Re-read</span>;
}

function EntryCard({ entry: e, reread }: { entry: OwnDiaryEntry; reread: boolean }) {
  return (
    <li className="cap-card fx-diary-card">
      <div className="cap-keep fx-diary-box">
        {e.book ? (
          <Link to={`/books/${e.book.slug}`} className="block">
            <CoverImage
              src={e.book.coverUrl}
              alt={`Cover of ${e.book.title}`}
              fallbackLabel={e.book.title}
              use="coverThumb"
              sizes="64px"
            />
          </Link>
        ) : null}
      </div>
      <div className="cap-stack fx-diary-box-2" data-gap="3">
        <div className="cap-spread" data-gap="4" data-align="start">
          <div className="cap-stack cap-shrink" data-gap="2">
            <div className="cap-cluster" data-gap="3">
              {e.book ? (
                <Link to={`/books/${e.book.slug}`} className="fx-diary-link">
                  {e.book.title}
                </Link>
              ) : (
                <span className="cap-title" data-size="5">
                  Unknown book
                </span>
              )}
              {reread ? <RereadBadge /> : null}
            </div>
            <div className="cap-cluster" data-gap="4">
              {e.ratingHalf == null ? null : <Rating value={e.ratingHalf / 2} size="sm" />}
              {e.logDate ? (
                <span className="cap-text" data-size="tiny" data-tone="dim" data-face="mono">
                  {mediumDate.format(e.logDate)}
                </span>
              ) : null}
            </div>
          </div>
          <VisibilityBadge visibility={e.visibility} />
        </div>
        {e.review?.trim() ? <p className="fx-diary-text">{e.review}</p> : null}
        <Link to={`/diary/${e.id}/edit`} className="fx-diary-link-2">
          Edit
        </Link>
      </div>
    </li>
  );
}

export const handle = { hydrate: true };
