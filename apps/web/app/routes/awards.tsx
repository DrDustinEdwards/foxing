import { catalogRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, EntityCard, PageHeader } from "~/components/ui";
import { loaderBase, staticPageHeaders } from "~/lib/loader.server";
import { buildMeta, itemListLd, ldJson } from "~/lib/seo";
import type { Route } from "./+types/awards";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const awards = await catalogRepo.listAwards(db);
  return { awards };
}

export const headers = staticPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Awards | Foxing" }];
  return [
    ...buildMeta({
      title: "Literary awards",
      description:
        "Nobel, Pulitzer, Newbery, and more. Browse award-winning classics you can read on Foxing.",
      pathname: location.pathname,
      pageType: "CollectionPage",
    }),
    ldJson(
      itemListLd(
        "Literary awards",
        data.awards.map((a) => ({ title: a.name, path: `/awards/${a.slug}` })),
      ),
    ),
  ];
}

export default function Awards({ loaderData }: Route.ComponentProps) {
  const { awards } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Recognition"
          title="Literary awards"
          lede="The prizes that shaped the canon, mapped to books you can read now."
        />
        <div className="fx-awards-grid">
          {awards.map((a) => (
            <EntityCard key={a.slug} to={`/awards/${a.slug}`}>
              <h2 className="fx-awards-title">{a.name}</h2>
              <p className="mt-2 meta">
                {a.count} {a.count === 1 ? "title" : "titles"}
                {a.scope ? ` · ${a.scope}` : ""}
              </p>
            </EntityCard>
          ))}
        </div>
      </Container>
    </PageShell>
  );
}
