// Year in Reading recap at /u/:username/recap/:year. Public when the profile is public
// (owner can always see their own). Aggregates finishes, top books, and stats in core,
// with a shareable OG image at /og/recap/:username/:year.
import { PageShell } from "~/components/page-shell";
import { TopBooks, YearNumbers } from "~/components/reading/year-view";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { createDb, views } from "@foxing/core";
import type { Route } from "./+types/recap";
import { SITE_ORIGIN } from "~/lib/origins";
import { SITE_NAME, buildMeta } from "~/lib/seo";

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
  const title = `${data.displayName}'s ${data.year} in reading`;
  const n = data.recap.booksFinished;
  return buildMeta({
    title,
    description: `${data.displayName} finished ${n} ${n === 1 ? "book" : "books"} on Foxing in ${data.year}${
      data.recap.topBooks.length ? `, including ${data.recap.topBooks[0].title}` : ""
    }.`,
    pathname,
    image: `${SITE_ORIGIN}/og/recap/${data.username}/${data.year}`,
    imageAlt: `${data.displayName}'s ${data.year} in reading on Foxing`,
    type: "profile",
    breadcrumbs: [
      { name: SITE_NAME, path: "/" },
      { name: data.displayName, path: `/u/${data.username}` },
      { name: title, path: pathname },
    ],
  });
}

export default function Recap({ loaderData }: Route.ComponentProps) {
  const { recap, displayName, year } = loaderData;
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
            <YearNumbers recap={recap} />
            <TopBooks books={recap.topBooks} />
          </>
        )}
      </Container>
    </PageShell>
  );
}
