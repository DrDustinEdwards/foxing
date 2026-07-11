// The signed-in reader's saved highlights (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Each highlight shows its passage, a color swatch, and
// its book context. Read-only.
import { createDb, annotationsRepo } from "@foxing/core";
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
    return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />;
  }
  return (
    <span
      aria-hidden="true"
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: hex }}
    />
  );
}

export default function Highlights({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData;

  return (
    <PageShell>
      <Container className="max-w-2xl">
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
          <ul className="flex flex-col gap-3">
            {highlights.map((h) => {
              const bookLabel = h.bookTitle ?? h.sourceTitle;
              return (
                <li key={h.id} className="rounded-card border border-border-subtle bg-surface p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-2">
                      <ColorDot color={h.color} />
                    </span>
                    <blockquote className="font-body text-base italic text-primary">
                      {h.selectedText}
                    </blockquote>
                  </div>
                  {bookLabel || h.chapter ? (
                    <p className="mt-3 pl-[22px] font-ui text-xs text-tertiary">
                      {h.bookSlug ? (
                        <Link to={`/books/${h.bookSlug}`} className="text-brand-text hover:underline">
                          {bookLabel}
                        </Link>
                      ) : bookLabel ? (
                        <span>{bookLabel}</span>
                      ) : null}
                      {bookLabel && h.bookAuthor ? <span> by {h.bookAuthor}</span> : null}
                      {bookLabel && h.chapter ? <span> </span> : null}
                      {h.chapter ? <span>{h.chapter}</span> : null}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
