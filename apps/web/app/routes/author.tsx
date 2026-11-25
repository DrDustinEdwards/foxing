import { thing } from "@drdustinedwards/site-helpers/schema";
import { views } from "@foxing/core";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, PageHeader } from "~/components/ui";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { SITE_NAME, absoluteUrl, buildMeta } from "~/lib/seo";
import type { Route } from "./+types/author";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const author = await views.author(db, params.slug);
  if (!author) throw new Response("Not found", { status: 404 });
  return { author };
}

export const headers = catalogPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Author not found | Foxing" }];
  const { author } = data;
  const { first, last } = author.yearRange ?? {};
  const titles = author.books.slice(0, 3).map((b) => b.title);
  return [
    ...buildMeta({
      title: author.name,
      description: `${author.name}: ${author.bookCount} public-domain ${author.bookCount === 1 ? "book" : "books"} on Foxing${
        first ? ` (${first === last ? first : `${first} to ${last}`})` : ""
      }${author.bookCount === 1 ? ":" : ", including"} ${new Intl.ListFormat("en").format(titles)}.`,
      pathname: location.pathname,
      type: "profile",
      pageType: "CollectionPage",
      breadcrumbs: [
        { name: SITE_NAME, path: "/" },
        { name: "Books", path: "/books" },
        { name: author.name, path: `/authors/${author.slug}` },
      ],
    }),
    jsonLd(
      thing("Person", {
        name: author.name,
        url: absoluteUrl(`/authors/${author.slug}`),
        knowsAbout: "Literature",
      }),
    ),
  ];
}

export default function Author({ loaderData }: Route.ComponentProps) {
  const { author } = loaderData;
  const range = author.yearRange
    ? author.yearRange.first === author.yearRange.last
      ? `${author.yearRange.first}`
      : `${author.yearRange.first} to ${author.yearRange.last}`
    : null;

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Books", to: "/books" },
            { label: author.name },
          ]}
        />
        <PageHeader
          title={author.name}
          lede={`${author.bookCount} ${author.bookCount === 1 ? "book" : "books"}${range ? `, ${range}` : ""}`}
        />
        <BookGrid>
          {author.books.map((b, i) => (
            <BookCard key={b.slug} book={b} position={i} headingLevel={2} />
          ))}
        </BookGrid>
      </Container>
    </PageShell>
  );
}

export { ErrorBoundary } from "~/components/route-error";
