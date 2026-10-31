// The signed-in reader's saved vocabulary (auth-gated, noindex). Words looked up while
// reading collect here. The loader reads core's vocabulary view; the list then lives in
// the @foxing/client cache and the mastered toggle flips in place (rolled back if the
// write fails). A filter narrows to still-to-master or mastered.
import { useSetMastered, useVocabulary } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import type { VocabularyWord } from "@foxing/types";
import { useState } from "react";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, FilterTab, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/vocabulary";

export function meta() {
  return [{ title: "Vocabulary | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return { words: await views.vocabulary(createDb(env.DB), user.id) };
}

type Filter = "all" | "learning" | "mastered";

export default function Vocabulary({ loaderData }: Route.ComponentProps) {
  const words = useVocabulary(loaderData.words).data;
  const [filter, setFilter] = useState<Filter>("all");
  const masteredCount = words.filter((w) => w.mastered).length;
  const learningCount = words.length - masteredCount;
  const shown =
    filter === "all"
      ? words
      : words.filter((w) => (filter === "mastered" ? w.mastered : !w.mastered));

  return (
    <PageShell>
      <Container>
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
            <nav aria-label="Filter words" className="mb-5 fx-vocabulary-row">
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
              <p className="meta">
                {filter === "mastered" ? "No mastered words yet." : "Nothing left to master."}
              </p>
            ) : (
              <ul className="stack-3">
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

function WordItem({ word }: { word: VocabularyWord }) {
  const setMastered = useSetMastered();

  return (
    <li className="card">
      <div className="fx-vocabulary-row-2">
        <h2 className="fx-vocabulary-title">{word.word}</h2>
        <div className="shrink-0 fx-vocabulary-row-3">
          {word.mastered ? <span className="fx-vocabulary-caps">Mastered</span> : null}
          <button
            type="button"
            onClick={() => setMastered.fire({ id: word.id, mastered: !word.mastered })}
            className="fx-vocabulary-btn"
          >
            {word.mastered ? "Unmark" : "Mark mastered"}
          </button>
        </div>
      </div>
      <p className="mt-1 ui">{word.definition}</p>
      {word.contextSentence ? (
        <p className="mt-2 italic fx-vocabulary-text">{word.contextSentence}</p>
      ) : null}
      {setMastered.error ? (
        <p className="mt-2 error xsmall" role="alert">
          {setMastered.error}
        </p>
      ) : null}
    </li>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
