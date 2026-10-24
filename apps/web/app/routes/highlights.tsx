// The signed-in reader's saved highlights (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Each highlight shows its passage, a color swatch, and
// its book context. Read-only.
import { createDb, annotationsRepo } from "@foxing/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router";
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
  const rows = await annotationsRepo.listForUser(db, user.id, { types: ["highlight"] });
  const highlights = rows.map((a) => ({
    id: a.id,
    selectedText: a.selectedText,
    color: a.color,
    chapter: a.chapter,
    sourceTitle: a.sourceTitle,
    bookTitle: a.bookTitle,
    bookSlug: a.bookSlug,
    bookAuthor: a.bookAuthor,
  }));
  return { highlights };
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

type Highlight = {
  id: string;
  selectedText: string | null;
  color: string | null;
  chapter: string | null;
  sourceTitle: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
};

function bookKey(h: Highlight): string {
  return h.bookSlug ?? h.bookTitle ?? h.sourceTitle ?? "unknown";
}
function bookLabelOf(h: Highlight): string {
  return h.bookTitle ?? h.sourceTitle ?? "Unknown book";
}

export default function Highlights({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData;
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("all");
  const [color, setColor] = useState("all");

  // Distinct books and colors present, in first-seen order, for the filter controls.
  const books: Array<{ key: string; label: string }> = [];
  const seenBooks = new Set<string>();
  const colors: string[] = [];
  const seenColors = new Set<string>();
  for (const h of highlights) {
    const k = bookKey(h);
    if (!seenBooks.has(k)) {
      seenBooks.add(k);
      books.push({ key: k, label: bookLabelOf(h) });
    }
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

  // Group the filtered highlights under their book.
  const groups: Array<{
    key: string;
    label: string;
    author: string | null;
    slug: string | null;
    items: Highlight[];
  }> = [];
  const groupIndex = new Map<string, number>();
  for (const h of filtered) {
    const k = bookKey(h);
    let i = groupIndex.get(k);
    if (i === undefined) {
      i = groups.length;
      groupIndex.set(k, i);
      groups.push({
        key: k,
        label: bookLabelOf(h),
        author: h.bookAuthor,
        slug: h.bookSlug,
        items: [],
      });
    }
    groups[i].items.push(h);
  }

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
            <div className="mb-6 stack-3">
              <div className="row wrap">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search passages"
                  aria-label="Search highlights"
                  className="cap-input fx-highlights-input"
                />
                {books.length > 1 ? (
                  <label className="ui">
                    <span className="cap-sr-only">Filter by book</span>
                    <select
                      value={book}
                      onChange={(e) => setBook(e.target.value)}
                      className="cap-select"
                    >
                      <option value="all">All books</option>
                      {books.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
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
              <span className="fine">
                {filtered.length} of {highlights.length}
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="meta">No highlights match those filters.</p>
            ) : (
              <div className="stack-8">
                {groups.map((g) => (
                  <section key={g.key} className="stack-3">
                    <h2 className="display-0">
                      {g.slug ? (
                        <Link to={`/books/${g.slug}`} className="hover-accent">
                          {g.label}
                        </Link>
                      ) : (
                        g.label
                      )}
                      {g.author ? <span className="dim"> by {g.author}</span> : null}
                    </h2>
                    <ul className="stack-3">
                      {g.items.map((h) => (
                        <li key={h.id} className="card card-5">
                          <div className="items-start fx-highlights-row">
                            <span className="mt-2">
                              <ColorDot color={h.color} />
                            </span>
                            <blockquote className="italic fx-highlights-quote">
                              {h.selectedText}
                            </blockquote>
                          </div>
                          {h.chapter ? (
                            <p className="mt-3 fx-highlights-text">{h.chapter}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
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
