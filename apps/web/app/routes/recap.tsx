// Year in Reading recap at /u/:username/recap/:year. Public when the profile is public
// (owner can always see their own). Aggregates finishes, top books, and stats in core,
// with a shareable OG image at /og/recap/:username/:year.
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { createDb, views } from "@foxing/core";
import type { Route } from "./+types/recap";
import { SITE_ORIGIN } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const data = await views.recap(
    createDb(env.DB),
    { username: params.username },
    year,
    session?.user?.id ?? null,
  );
  if (!data) throw new Response("Not found", { status: 404 });
  return { ...data, year, username: params.username };
}

export function meta({ loaderData: data, params }: Route.MetaArgs) {
  const pathname = `/u/${params.username}/recap/${params.year}`;
  if (!data) return buildMeta({ title: "Year in Reading", pathname });
  return buildMeta({
    title: `${data.displayName}'s ${data.year} in reading`,
    pathname,
    image: `${SITE_ORIGIN}/og/recap/${data.username}/${data.year}`,
    imageAlt: `${data.displayName}'s ${data.year} in reading on Foxing`,
    type: "profile",
  });
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
      <Container className="stack-10">
        <PageHeader eyebrow={`Year in Reading ${year}`} title={`${displayName}'s reading year`} />

        {recap.booksFinished === 0 ? (
          <EmptyState
            title={`No finishes logged in ${year}`}
            body="Books show up here as they are marked finished."
          />
        ) : (
          <>
            <section className="fx-recap-grid">
              {stats.map((s) => (
                <div key={s.label} className="text-center fx-recap-card">
                  <p className="display-3">{s.value}</p>
                  <p className="mt-1 fx-recap-caps">{s.label}</p>
                </div>
              ))}
            </section>

            {recap.topBooks.length > 0 ? (
              <section className="stack">
                <h2 className="display-2">Top books</h2>
                <ol className="stack-2">
                  {recap.topBooks.map((b) => (
                    <li key={b.bookId} className="py-3 fx-recap-card-2">
                      <Link to={`/books/${b.slug}`} className="fx-recap-link">
                        {b.title}
                      </Link>
                      <span className="fx-recap-label">
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
