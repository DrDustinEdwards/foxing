// Year in Reading recap at /u/:username/recap/:year. Public when the profile is public
// (owner can always see their own). Aggregates finishes, top books, and stats in core,
// with a shareable OG image at /og/recap/:username/:year.
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadRecap } from "~/lib/social.server";
import type { Route } from "./+types/recap";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const data = await loadRecap(env, { username: params.username }, year, session?.user?.id ?? null);
  if (!data) throw new Response("Not found", { status: 404 });
  return { ...data, year, username: params.username };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: "Year in Reading | Foxing" }];
  const title = `${data.displayName}'s ${data.year} in reading | Foxing`;
  const ogImage = `https://foxing.app/og/recap/${data.username}/${data.year}`;
  return [
    { title },
    { property: "og:title", content: title },
    { property: "og:image", content: ogImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
  ];
}

export default function Recap({ loaderData }: Route.ComponentProps) {
  const { recap, displayName, year } = loaderData;
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
      <Container className="max-w-3xl flex flex-col gap-10">
        <PageHeader eyebrow={`Year in Reading ${year}`} title={`${displayName}'s reading year`} />

        {recap.booksFinished === 0 ? (
          <EmptyState
            title={`No finishes logged in ${year}`}
            body="Books show up here as they are marked finished."
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
      </Container>
    </PageShell>
  );
}
