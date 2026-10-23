import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, PageHeader } from "~/components/ui";
import { loaderBase, staticPageHeaders } from "~/lib/loader.server";
import { breadcrumbLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/pick-club";
import { MONTH_ABBR } from "~/lib/months";

function pickDate(year: number | null, month: number | null): string | null {
  if (!year) return null;
  return month && month >= 1 && month <= 12 ? `${MONTH_ABBR[month - 1]} ${year}` : String(year);
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const club = await catalogRepo.getClubBySlug(db, params.clubSlug);
  if (!club) throw new Response("Not found", { status: 404 });
  return { origin, club };
}

export const headers = staticPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Book club not found | Foxing" }];
  const { club, origin } = data;
  return [
    ...buildMeta({
      title: `${club.name} picks`,
      description: club.description ?? `Every ${club.name} book club pick, tracked on Foxing.`,
      origin,
      pathname: location.pathname,
    }),
    ldJson(
      breadcrumbLd(origin, [
        { name: "Home", path: "/" },
        { name: "Picks", path: "/picks" },
        { name: club.name, path: `/picks/${club.slug}` },
      ]),
    ),
  ];
}

export default function PickClub({ loaderData }: Route.ComponentProps) {
  const { club } = loaderData;
  const withBooks = club.picks.filter((p) => p.book);

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Picks", to: "/picks" },
            { label: club.name },
          ]}
        />
        <PageHeader
          eyebrow={club.curator ?? "Book club"}
          title={club.name}
          lede={club.description ?? `${withBooks.length} picks tracked.`}
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withBooks.map((p) => {
            const b = p.book;
            if (!b) return null;
            const date = pickDate(p.pickYear, p.pickMonth);
            return (
              <li
                key={p.id}
                className="flex gap-4 rounded-card border border-border-subtle bg-surface p-4 shadow-card-sm transition-shadow hover:shadow-card-md"
              >
                <Link to={`/books/${b.slug}`} className="w-20 shrink-0">
                  <CoverImage
                    src={b.coverUrl}
                    alt={`${b.title} by ${b.author}`}
                    fallbackLabel={b.title}
                    sizes="80px"
                  />
                </Link>
                <div className="min-w-0">
                  {date ? (
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-tertiary">
                      {date}
                      {p.category ? ` · ${p.category}` : ""}
                    </p>
                  ) : null}
                  <Link to={`/books/${b.slug}`} className="group block">
                    <h3 className="mt-1 font-display text-base leading-snug text-primary group-hover:text-brand-text">
                      {b.title}
                    </h3>
                    <p className="font-ui text-sm text-tertiary">{b.author}</p>
                  </Link>
                  {p.curatorQuote ? (
                    <p className="mt-2 line-clamp-3 font-body text-sm italic text-secondary">
                      &ldquo;{p.curatorQuote}&rdquo;
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </PageShell>
  );
}
