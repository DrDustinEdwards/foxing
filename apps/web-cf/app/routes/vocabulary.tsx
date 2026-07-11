// The signed-in reader's saved vocabulary (auth-gated, noindex). Words looked up while
// reading collect here. Reads run in-process via core; requireProfile gates access.
// Read-only.
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

export default function Vocabulary({ loaderData }: Route.ComponentProps) {
  const { words } = loaderData;

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
          <ul className="flex flex-col gap-3">
            {words.map((w) => (
              <li
                key={w.id}
                className="rounded-card border border-border-subtle bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-primary">{w.word}</h2>
                  {w.mastered ? (
                    <span className="shrink-0 rounded-full bg-brand-subtle px-2.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text">
                      Mastered
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-ui text-sm text-secondary">{w.definition}</p>
                {w.contextSentence ? (
                  <p className="mt-2 font-body text-sm italic text-tertiary">
                    {w.contextSentence}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
