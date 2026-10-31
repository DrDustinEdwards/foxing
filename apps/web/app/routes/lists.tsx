// The signed-in reader's own reading lists index (auth-gated, noindex). Reads run
// in-process through the same core view GET /lists serves the app; requireProfile gates
// access. Each list links to its detail page; "New list" links to the create route.
import { createDb, views } from "@foxing/core";
import { useState } from "react";
import { Link } from "capsomer/react/link";
import { CoverPicture } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, EntityCard, FilterTab, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/lists";

type ListFilter = "all" | "public" | "private";

export function meta() {
  return [{ title: "Your lists | Foxing" }, { name: "robots", content: "noindex" }];
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
        <div className="mb-10 items-end fx-lists-row">
          <PageHeader eyebrow="Reading" title="Your lists" className="mb-0" />
          <Link to="/lists/new" className="cap-btn shrink-0" data-variant="primary">
            New list
          </Link>
        </div>
        {lists.length === 0 ? (
          <EmptyState
            title="No lists yet."
            body="Group books into a list to share what you are reading or want to read."
          />
        ) : (
          <>
            <nav aria-label="Filter lists" className="mb-6 fx-lists-row-2">
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
            <ul className="stack-3">
              {shown.map((l) => (
                <li key={l.id}>
                  <EntityCard to={`/lists/${l.id}`}>
                    <div className="fx-lists-row-3">
                      {l.covers.length > 0 ? <CoverStack covers={l.covers} /> : null}
                      <div className="fx-lists-box">
                        <div className="fx-lists-row-4">
                          <h2 className="display-0">{l.title}</h2>
                          {!l.isPublic ? (
                            <span className="shrink-0 fx-lists-caps">Private</span>
                          ) : null}
                        </div>
                        {l.description ? (
                          <p className="mt-1 fx-lists-text">{l.description}</p>
                        ) : null}
                        <p className="mt-2 fx-lists-text-2">
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
          </>
        )}
      </Container>
    </PageShell>
  );
}

// A small overlapping fan of up to four covers as a list preview. Decorative (the list
// title carries the link's meaning), so the images are alt-empty.
function CoverStack({ covers }: { covers: string[] }) {
  return (
    <div className="shrink-0 fx-lists-row-5">
      {covers.map((src, i) => (
        <CoverPicture
          key={src}
          src={src}
          alt=""
          use="coverThumb"
          sizes="44px"
          className="fx-lists-img"
          style={{ zIndex: covers.length - i }}
        />
      ))}
    </div>
  );
}
