import { createDb, views } from "@foxing/core";
import { useState } from "react";
import { ButtonLink } from "capsomer/react/link";
import { CoverPicture } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, EntityCard, FilterTab, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/lists";
import { noindexPageMeta } from "~/lib/seo";

type ListFilter = "all" | "public" | "private";

export function meta() {
  return noindexPageMeta("Your lists | Foxing");
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const lists = await views.myLists(createDb(env.DB), user.id);
  return { lists };
}

export default function Lists({ loaderData }: Route.ComponentProps) {
  const { lists } = loaderData;
  const [filter, setFilter] = useState<ListFilter>("all");
  const publicCount = lists.filter((l) => l.isPublic).length;
  const shown =
    filter === "all"
      ? lists
      : lists.filter((l) => (filter === "public" ? l.isPublic : !l.isPublic));

  return (
    <PageShell>
      <Container>
        <PageHeader
          title="Your lists"
          actions={
            <ButtonLink to="/lists/new" className="cap-keep" variant="primary">
              New list
            </ButtonLink>
          }
        />
        {lists.length === 0 ? (
          <EmptyState title="No lists yet." />
        ) : (
          <div className="cap-stack" data-gap="6">
            <nav aria-label="Filter lists" className="fx-lists-row-2">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
                All {lists.length}
              </FilterTab>
              <FilterTab active={filter === "public"} onClick={() => setFilter("public")}>
                Public {publicCount}
              </FilterTab>
              <FilterTab active={filter === "private"} onClick={() => setFilter("private")}>
                Private {lists.length - publicCount}
              </FilterTab>
            </nav>
            <ul className="cap-stack" data-gap="4">
              {shown.map((l) => (
                <li key={l.id}>
                  <EntityCard to={`/lists/${l.id}`}>
                    <div className="fx-lists-row-3">
                      {l.covers.length > 0 ? <CoverStack covers={l.covers} /> : null}
                      <div className="cap-stack fx-lists-box" data-gap="3">
                        <div className="cap-stack" data-gap="2">
                          <div className="fx-lists-row-4">
                            <h2 className="cap-title" data-size="5">
                              {l.title}
                            </h2>
                            {!l.isPublic ? (
                              <span className="cap-keep fx-lists-caps">Private</span>
                            ) : null}
                          </div>
                          {l.description ? <p className="fx-lists-text">{l.description}</p> : null}
                        </div>
                        <p className="fx-lists-text-2">
                          {l.bookCount} {l.bookCount === 1 ? "book" : "books"}
                          {" · "}
                          {l.isPublic ? "public" : "private"}
                        </p>
                      </div>
                    </div>
                  </EntityCard>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </PageShell>
  );
}

function CoverStack({ covers }: { covers: string[] }) {
  return (
    <div className="cap-keep fx-lists-row-5">
      {covers.map((src) => (
        <CoverPicture
          key={src}
          src={src}
          alt=""
          use="coverThumb"
          sizes="44px"
          className="fx-lists-img"
        />
      ))}
    </div>
  );
}

export const handle = { hydrate: true };
