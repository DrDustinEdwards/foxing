import { catalogRepo } from "@foxing/core";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, PageHeader } from "~/components/ui";
import { loaderBase, staticPageHeaders } from "~/lib/loader.server";
import { buildMeta, itemListLd, ldJson } from "~/lib/seo";
import type { Route } from "./+types/award-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const award = await catalogRepo.getAwardBySlug(db, params.slug);
  if (!award) throw new Response("Not found", { status: 404 });
  return { award };
}

export const headers = staticPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Award not found | Foxing" }];
  const { award } = data;
  return [
    ...buildMeta({
      title: award.name,
      description: `${award.entries.length} ${award.name} winners you can read on Foxing.`,
      pathname: location.pathname,
      pageType: "CollectionPage",
    }),
    ldJson(
      itemListLd(
        award.name,
        award.entries.map((e) => ({ title: e.book.title, path: `/books/${e.book.slug}` })),
      ),
    ),
  ];
}

export default function AwardDetail({ loaderData }: Route.ComponentProps) {
  const { award } = loaderData;
  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Awards", to: "/awards" },
            { label: award.name },
          ]}
        />
        <PageHeader
          eyebrow={award.scope ?? "Literary award"}
          title={award.name}
          lede={`${award.entries.length} ${award.entries.length === 1 ? "winner" : "winners"} in the library.`}
        />
        <BookGrid>
          {award.entries.map((e, i) => (
            <div key={`${e.book.slug}-${e.year}`}>
              <BookCard book={e.book} priority={i < 6} />
              {e.year ? (
                <p className="fx-award-detail-caps">
                  {e.year} · {e.distinction}
                </p>
              ) : null}
            </div>
          ))}
        </BookGrid>
      </Container>
    </PageShell>
  );
}
