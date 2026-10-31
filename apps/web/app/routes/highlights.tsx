// The signed-in reader's saved highlights (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Each highlight shows its passage, a color swatch, and
// its book context. Read-only.
import { createDb, views } from "@foxing/core";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  AnnotationFilters,
  BookGroups,
  bookKey,
  bookOptions,
} from "~/components/annotations-by-book";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/highlights";

export function meta() {
  return [{ title: "Highlights | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  return { highlights: await views.myAnnotations(db, user.id, ["highlight"]) };
}

// Highlight colors are user content (annotation swatches), not UI chrome, so the dot uses
// the saved color. Unknown or missing names fall back to a neutral border token.
const SWATCH: Record<string, string> = {
  yellow: "#E7C24B",
  green: "#5BA96A",
  blue: "#4B82D4",
  pink: "#D46A9B",
  red: "#C7513B",
  orange: "#D4622E",
  purple: "#8A5BD4",
};

function ColorDot({ color }: { color: string | null }) {
  const hex = color ? SWATCH[color.toLowerCase()] : undefined;
  if (!hex) {
    return <span aria-hidden="true" className="shrink-0 fx-highlights-label" />;
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 fx-highlights-label-2"
      style={{ backgroundColor: hex }}
    />
  );
}

export default function Highlights({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData;
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("all");
  const [color, setColor] = useState("all");

  // Distinct colors present, in first-seen order, for the color chips.
  const colors: string[] = [];
  const seenColors = new Set<string>();
  for (const h of highlights) {
    const c = h.color?.toLowerCase();
    if (c && !seenColors.has(c)) {
      seenColors.add(c);
      colors.push(c);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = highlights.filter((h) => {
    if (color !== "all" && (h.color?.toLowerCase() ?? "") !== color) return false;
    if (book !== "all" && bookKey(h) !== book) return false;
    if (q) {
      const hay =
        `${h.selectedText ?? ""} ${h.bookTitle ?? ""} ${h.sourceTitle ?? ""} ${h.bookAuthor ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Reading"
          title="Highlights"
          lede="The passages you highlight while reading gather here."
        />
        {highlights.length === 0 ? (
          <EmptyState
            title="No highlights yet."
            body="Highlights you make in the reader will appear here."
          />
        ) : (
          <>
            <AnnotationFilters
              query={query}
              onQuery={setQuery}
              placeholder="Search passages"
              label="Search highlights"
              inputClassName="fx-highlights-input"
              books={bookOptions(highlights)}
              book={book}
              onBook={setBook}
              shown={filtered.length}
              total={highlights.length}
            >
              {colors.length > 1 ? (
                <div className="row-2 wrap">
                  <ColorChip active={color === "all"} onClick={() => setColor("all")} color={null}>
                    All colors
                  </ColorChip>
                  {colors.map((c) => (
                    <ColorChip key={c} active={color === c} onClick={() => setColor(c)} color={c}>
                      {c}
                    </ColorChip>
                  ))}
                </div>
              ) : null}
            </AnnotationFilters>
            <BookGroups
              items={filtered}
              empty="No highlights match those filters."
              renderItem={(h) => (
                <>
                  <div className="items-start fx-highlights-row">
                    <span className="mt-2">
                      <ColorDot color={h.color} />
                    </span>
                    <blockquote className="italic fx-highlights-quote">{h.selectedText}</blockquote>
                  </div>
                  {h.chapter ? <p className="mt-3 fx-highlights-text">{h.chapter}</p> : null}
                </>
              )}
            />
          </>
        )}
      </Container>
    </PageShell>
  );
}

function ColorChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string | null;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="cap-chip fx-highlights-chip"
    >
      {color ? <ColorDot color={color} /> : null}
      {children}
    </button>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
