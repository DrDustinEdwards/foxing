// The signed-in reader's saved vocabulary (auth-gated, noindex). Words looked up while
// reading collect here. Reads run in-process via core; the mastered toggle writes to
// /api/v1/vocabulary/:id from the browser and the page revalidates. A filter narrows to
// still-to-master or mastered. Words originate in the reader (R2-blocked), so an empty
// list is expected until it ships; the honest empty state stays.
import type { ReactNode } from "react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { createDb, libraryRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/vocabulary";

export function meta() {
  return [{ title: "Vocabulary | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const rows = await libraryRepo.listVocabulary(db, user.id);
  const words = rows.map((w) => ({
    id: w.id,
    word: w.word,
    definition: w.definition,
    contextSentence: w.contextSentence,
    mastered: w.mastered,
  }));
  return { words };
}

type Filter = "all" | "learning" | "mastered";

export default function Vocabulary({ loaderData }: Route.ComponentProps) {
  const { words } = loaderData;
  const [filter, setFilter] = useState<Filter>("all");
  const masteredCount = words.filter((w) => w.mastered).length;
  const learningCount = words.length - masteredCount;
  const shown =
    filter === "all"
      ? words
      : words.filter((w) => (filter === "mastered" ? w.mastered : !w.mastered));

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <PageHeader
          eyebrow="Reading"
          title="Vocabulary"
          lede="Words you save while reading collect here with their definitions."
        />
        {words.length === 0 ? (
          <EmptyState
            title="No saved words yet."
            body="Look up a word in the reader and it will be kept here for review."
          />
        ) : (
          <>
            <nav aria-label="Filter words" className="mb-5 flex flex-wrap gap-2">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
                All {words.length}
              </FilterTab>
              <FilterTab active={filter === "learning"} onClick={() => setFilter("learning")}>
                To master {learningCount}
              </FilterTab>
              <FilterTab active={filter === "mastered"} onClick={() => setFilter("mastered")}>
                Mastered {masteredCount}
              </FilterTab>
            </nav>

            {shown.length === 0 ? (
              <p className="font-ui text-sm text-tertiary">
                {filter === "mastered" ? "No mastered words yet." : "Nothing left to master."}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {shown.map((w) => (
                  <WordItem key={w.id} word={w} />
                ))}
              </ul>
            )}
          </>
        )}
      </Container>
    </PageShell>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 font-ui text-sm transition-colors aria-pressed:border-border-interactive aria-pressed:bg-selected aria-pressed:text-primary border-border-subtle text-secondary hover:border-border-interactive hover:text-primary"
    >
      {children}
    </button>
  );
}

function WordItem({
  word,
}: {
  word: { id: string; word: string; definition: string; contextSentence: string | null; mastered: boolean };
}) {
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/vocabulary/${word.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mastered: !word.mastered }),
      });
      // Do not swallow: a failed write must be visible, not a silent no-op.
      if (!res.ok) {
        setError("Could not update that word. Try again.");
        return;
      }
      revalidator.revalidate();
    } catch {
      setError("Could not update that word. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="rounded-card border border-border-subtle bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-primary">{word.word}</h2>
        <div className="flex shrink-0 items-center gap-3">
          {word.mastered ? (
            <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text">
              Mastered
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="font-ui text-xs text-tertiary hover:text-brand-text hover:underline disabled:opacity-50"
          >
            {pending ? "Saving..." : word.mastered ? "Unmark" : "Mark mastered"}
          </button>
        </div>
      </div>
      <p className="mt-1 font-ui text-sm text-secondary">{word.definition}</p>
      {word.contextSentence ? (
        <p className="mt-2 font-body text-sm italic text-tertiary">{word.contextSentence}</p>
      ) : null}
      {error ? (
        <p className="mt-2 font-ui text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
