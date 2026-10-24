import { catalogRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, EntityCard, PageHeader } from "~/components/ui";
import { loaderBase, staticPageHeaders } from "~/lib/loader.server";
import { buildMeta, itemListLd, ldJson } from "~/lib/seo";
import type { Route } from "./+types/picks";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const clubs = await catalogRepo.listExternalClubs(db);
  return { origin, clubs };
}

export const headers = staticPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Book club picks | Foxing" }];
  return [
    ...buildMeta({
      title: "Celebrity and retailer book club picks",
      description:
        "Every pick from Oprah, Reese, Jenna, Belletrist, and more, gathered in one place on Foxing.",
      origin: data.origin,
      pathname: location.pathname,
    }),
    ldJson(
      itemListLd(
        data.origin,
        "Book club picks",
        data.clubs.map((c) => ({ title: c.name, path: `/picks/${c.slug}` })),
      ),
    ),
  ];
}

export default function Picks({ loaderData }: Route.ComponentProps) {
  const { clubs } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Curated elsewhere"
          title="Book club picks"
          lede="The reading lists behind the famous book clubs, tracked and searchable."
        />
        <div className="fx-picks-grid">
          {clubs.map((c) => (
            <EntityCard key={c.slug} to={`/picks/${c.slug}`}>
              <h2 className="fx-picks-title">{c.name}</h2>
              {c.curator ? <p className="mt-1 ui">{c.curator}</p> : null}
              <p className="mt-3 fx-picks-caps">
                {c.pickCount} {c.pickCount === 1 ? "pick" : "picks"}
                {c.focus ? ` · ${c.focus}` : ""}
              </p>
            </EntityCard>
          ))}
        </div>
      </Container>
    </PageShell>
  );
}
