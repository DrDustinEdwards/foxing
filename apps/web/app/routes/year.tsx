// The signed-in reader's OWN Year in Reading (auth-gated, noindex). Reuses the exact
// recap aggregation that powers the public /u/:username/recap/:year, targeted by user id
// so it is always the viewer's own. /year shows the current year; /year/:year picks one.
// A year picker links between years. The shareable public version lives on the profile.
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { loadRecap } from "~/lib/social.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";

export function meta() {
  return [{ title: "Your year in reading | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = params.year ? Number(params.year) : thisYear;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const data = await loadRecap(env, { userId: user.id }, year, user.id);
  if (!data) throw new Response("Not found", { status: 404 });
  // Year picker spans this year back six, always including the selected one.
  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    recap: data.recap,
    displayName: data.displayName,
    username: data.username,
    year,
    years: [...years].sort((a, b) => b - a),
  };
}

export default function Year({ loaderData }: Route.ComponentProps) {
  const { recap, year, years, username } = loaderData;
  const stats = [
    { label: "books finished", value: recap.booksFinished },
    { label: "words read", value: recap.totalWords ? recap.totalWords.toLocaleString() : "0" },
    { label: "distinct authors", value: recap.distinctAuthors },
    {
      label: "average rating",
      value: recap.averageRating != null ? recap.averageRating.toFixed(1) : "-",
    },
  ];

  return (
    <PageShell>
      <Container className="max-w-3xl flex flex-col gap-8">
        <PageHeader eyebrow={`Year in Reading ${year}`} title="Your reading year" className="mb-0" />

        <nav aria-label="Choose a year" className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              to={y === new Date().getUTCFullYear() ? "/year" : `/year/${y}`}
              aria-current={y === year ? "page" : undefined}
              className="rounded-full border px-3 py-1 font-ui text-sm transition-colors aria-[current=page]:border-border-interactive aria-[current=page]:bg-selected aria-[current=page]:text-primary border-border-subtle text-secondary hover:border-border-interactive hover:text-primary"
            >
              {y}
            </Link>
          ))}
        </nav>

        {recap.booksFinished === 0 ? (
          <EmptyState
            title={`No finishes logged in ${year}`}
            body="Books show up here as you mark them finished."
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-card border border-border-subtle bg-surface p-5 text-center"
                >
                  <p className="font-display text-3xl text-primary">{s.value}</p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-tertiary">
                    {s.label}
                  </p>
                </div>
              ))}
            </section>

            {recap.topBooks.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-2xl">Top books</h2>
                <ol className="flex flex-col gap-2">
                  {recap.topBooks.map((b) => (
                    <li
                      key={b.bookId}
                      className="flex items-baseline justify-between gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3"
                    >
                      <Link
                        to={`/books/${b.slug}`}
                        className="font-display text-lg text-primary hover:text-brand-text"
                      >
                        {b.title}
                      </Link>
                      <span className="font-mono text-sm text-brand-text">
                        {b.ratingHalf != null ? `${(b.ratingHalf / 2).toFixed(1)}★` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}

        <p className="font-ui text-sm text-tertiary">
          Want to share this?{" "}
          <Link
            to={`/u/${username}/recap/${year}`}
            className="text-brand-text hover:underline"
          >
            View the public version
          </Link>
          .
        </p>
      </Container>
    </PageShell>
  );
}
