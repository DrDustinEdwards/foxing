// The reader's personal library (auth-gated). The first paint comes from the loader,
// which reads core's views in-process (loaders never self-fetch the Worker's own
// /api/v1); after that each card lives in the @foxing/client cache. Writes (status,
// shelves, goals) patch the cache at once and refetch only what they touched, so the
// page never reloads. Status transitions emit events server-side.
import {
  goalPeriodLabel,
  useCreateShelf,
  useDeleteGoal,
  useDeleteShelf,
  useGoals,
  useLibrary,
  useShelves,
  useStreak,
} from "@foxing/client";
import type { GoalWithProgress, Shelf, ShelfStatus, Streak } from "@foxing/types";
import { useState } from "react";
import { redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { Meter } from "capsomer/react/meter";
import { BookStatusControl } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { GoalPeriodSelect, useGoalDraft } from "~/components/goal-form";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadLibraryData } from "~/lib/library.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/library";

const STATUS_TABS: { value: ShelfStatus; label: string }[] = [
  { value: "reading", label: "Reading" },
  { value: "want", label: "Want to read" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
];

const EMPTY_COPY: Record<ShelfStatus, string> = {
  reading: "Nothing in progress.",
  want: "Your shelf is empty.",
  finished: "No books finished yet.",
  paused: "No paused books.",
  abandoned: "No abandoned books.",
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login?redirect=/library");
  // Signed-in but not onboarded -> /onboarding (never render with a null profile).
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  return loadLibraryData(env, session.user.id);
}

export function meta() {
  return [{ title: "Your library | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const library = useLibrary(loaderData.library).data;
  const shelves = useShelves(loaderData.shelves).data;
  const goals = useGoals(loaderData.goals).data;
  const streak = useStreak(loaderData.streak).data;
  const [tab, setTab] = useState<ShelfStatus>("reading");

  const counts = library.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  const shown = library.filter((e) => e.status === tab);

  return (
    <PageShell>
      <Container>
        <h1 className="display-4">Your library</h1>

        <div className="mt-8 fx-library-grid">
          <div>
            {/* Status tabs */}
            <div className="cap-tabs-list" role="tablist" aria-label="Reading status">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className="cap-tab"
                >
                  {t.label}
                  {counts[t.value] ? (
                    <span className="cap-tab-count">{counts[t.value]}</span>
                  ) : null}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="mt-10 text-center fx-library-card">
                <p className="meta">{EMPTY_COPY[tab]}</p>
                <Link to="/books" className="mt-2 fx-library-link">
                  Find a book
                </Link>
              </div>
            ) : (
              <div className="mt-6 fx-library-grid-2">
                {shown.map((e) => (
                  <div key={e.bookId} className="fx-library-card-2">
                    <Link to={`/books/${e.slug}`} className="relative block">
                      <CoverImage
                        src={e.coverUrl}
                        alt={`Cover of ${e.title}`}
                        fallbackLabel={e.title}
                        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
                      />
                      {e.status === "paused" || e.status === "abandoned" ? (
                        <span className="fx-library-label-2">
                          {e.status === "paused" ? "Paused" : "Set aside"}
                        </span>
                      ) : null}
                      {e.status === "reading" && e.progressPct > 0 ? (
                        <span className="fx-library-label-3">
                          <span
                            className="block fx-library-label-4"
                            style={{ width: `${Math.min(100, e.progressPct)}%` }}
                          />
                        </span>
                      ) : null}
                    </Link>
                    <div className="mt-3 fx-library-box">
                      <Link to={`/books/${e.slug}`} className="fx-library-link-2">
                        {e.title}
                      </Link>
                      <p className="mt-1 meta">{e.author}</p>
                    </div>
                    <div className="mt-2 fx-library-box">
                      <BookStatusControl
                        book={{
                          id: e.bookId,
                          slug: e.slug,
                          title: e.title,
                          author: e.author,
                          coverUrl: e.coverUrl,
                        }}
                        currentStatus={e.status}
                        signedIn
                        loginHref="/login"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: streak, goals, shelves */}
          <aside className="stack-6">
            <StreakCard streak={streak} />
            <GoalsCard goals={goals} />
            <ShelvesCard shelves={shelves} />
          </aside>
        </div>
      </Container>
    </PageShell>
  );
}

function StreakCard({ streak: s }: { streak: Streak }) {
  return (
    <section className="card">
      <Eyebrow className="mb-3">Reading streak</Eyebrow>
      <dl className="text-center fx-library-grid-3">
        {[
          { k: "Current", v: s.currentStreak },
          { k: "Longest", v: s.longestStreak },
          { k: "Finished", v: s.totalBooksFinished },
        ].map((x) => (
          <div key={x.k}>
            <dd className="display-2">{x.v}</dd>
            <dt className="fine">{x.k}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GoalsCard({ goals }: { goals: GoalWithProgress[] }) {
  const draft = useGoalDraft();
  const remove = useDeleteGoal();
  const error = draft.error ?? remove.error;

  return (
    <section className="card">
      <Eyebrow className="mb-3">Reading goals</Eyebrow>
      {goals.length === 0 ? (
        <p className="meta">No goals set.</p>
      ) : (
        <ul className="stack-3">
          {goals.map(({ goal, progress }) => (
            <li key={goal.id}>
              <div className="fx-library-row">
                <span>
                  {goal.target} {goal.type} in {goalPeriodLabel(goal)}
                </span>
                <button
                  type="button"
                  onClick={() => remove.fire({ id: goal.id })}
                  className="fx-library-btn"
                >
                  Remove
                </button>
              </div>
              <Meter
                className="mt-1"
                label="Progress"
                value={progress}
                max={goal.target}
                valueText={`${progress} of ${goal.target} ${goal.type} in ${goalPeriodLabel(goal)}`}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 fx-library-row-2">
        <label className="sans small">
          <span className="cap-sr-only">Books</span>
          <input
            type="number"
            min={1}
            value={draft.target}
            onChange={(e) => draft.setTarget(Math.max(1, Number(e.target.value)))}
            className="cap-input fx-library-input"
          />
        </label>
        <GoalPeriodSelect value={draft.period} onChange={draft.setPeriod} />
        <button
          type="button"
          onClick={draft.add}
          disabled={draft.pending}
          className="cap-btn"
          data-size="sm"
        >
          Set
        </button>
      </div>
      {draft.pending ? (
        <p className="mt-2 fx-library-text" role="status">
          Saving...
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 error xsmall" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ShelvesCard({ shelves }: { shelves: Shelf[] }) {
  const [name, setName] = useState("");
  const create = useCreateShelf();
  const remove = useDeleteShelf();
  const error = create.error ?? remove.error;

  async function addShelf() {
    if (!name.trim()) return;
    if (await create.run({ name: name.trim() })) setName("");
  }

  return (
    <section className="card">
      <Eyebrow className="mb-3">Shelves</Eyebrow>
      {shelves.length === 0 ? (
        <p className="meta">No shelves yet.</p>
      ) : (
        <ul className="fx-library-stack">
          {shelves.map((s) => (
            <li key={s.id} className="fx-library-row">
              <Link to={`/shelves/${s.id}`} className="hover-accent">
                {s.name}
              </Link>
              <button
                type="button"
                onClick={() => remove.fire({ id: s.id })}
                className="fx-library-btn"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 fx-library-row-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New shelf"
          className="cap-input fx-library-input-2"
        />
        <button
          type="button"
          onClick={addShelf}
          disabled={create.pending}
          className="cap-btn"
          data-size="sm"
        >
          Add
        </button>
      </div>
      {create.pending ? (
        <p className="mt-2 fx-library-text" role="status">
          Saving...
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 error xsmall" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
