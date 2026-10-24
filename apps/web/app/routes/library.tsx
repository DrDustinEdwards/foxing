// The reader's personal library (auth-gated). Reads run in-process via core in
// loadLibraryData (the standing rule: loaders never self-fetch the Worker's own
// /api/v1, that loopback returns HTML, not JSON). Writes (status, shelves, goals) go
// to /api/v1 from the browser client and the page revalidates. Status transitions
// emit events server-side.
import { useState } from "react";
import { Link, redirect, useRevalidator } from "react-router";
import { BookStatusControl, type ShelfStatus } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { GoalPeriodSelect, useCreateGoal } from "~/components/goal-form";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { goalPeriodLabel } from "~/lib/goals";
import type { GoalRow, Shelf, Streak } from "~/lib/library.server";
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
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login?redirect=/library");
  // Signed-in but not onboarded -> /onboarding (never render with a null profile).
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  return loadLibraryData(env, session.user.id);
}

export function meta() {
  return [{ title: "Your library | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { library, shelves, goals, streak } = loaderData;
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
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
                        bookId={e.bookId}
                        currentStatus={e.status as ShelfStatus}
                        signedIn
                        loginHref="/login"
                        onChanged={refresh}
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
            <GoalsCard goals={goals} onChanged={refresh} />
            <ShelvesCard shelves={shelves} onChanged={refresh} />
          </aside>
        </div>
      </Container>
    </PageShell>
  );
}

function StreakCard({ streak }: { streak: Streak | null }) {
  const s = streak ?? { currentStreak: 0, longestStreak: 0, totalBooksFinished: 0 };
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

function GoalsCard({ goals, onChanged }: { goals: GoalRow[]; onChanged: () => void }) {
  const {
    target,
    setTarget,
    period,
    setPeriod,
    pending,
    error,
    setError,
    add: addGoal,
  } = useCreateGoal(onChanged);

  async function del(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/goals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove that goal. Try again.");
        return;
      }
      onChanged();
    } catch {
      setError("Could not remove that goal. Check your connection and try again.");
    }
  }

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
                <button type="button" onClick={() => del(goal.id)} className="fx-library-btn">
                  Remove
                </button>
              </div>
              <div
                className="mt-1 fx-library-box-2"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemax={goal.target}
              >
                <div
                  className="fx-library-box-3"
                  style={{ width: `${Math.min(100, (progress / goal.target) * 100)}%` }}
                />
              </div>
              <p className="mt-1 fine">
                {progress} of {goal.target}
              </p>
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
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            className="cap-input fx-library-input"
          />
        </label>
        <GoalPeriodSelect value={period} onChange={setPeriod} />
        <button
          type="button"
          onClick={addGoal}
          disabled={pending}
          className="cap-btn"
          data-size="sm"
        >
          Set
        </button>
      </div>
      {pending ? (
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

function ShelvesCard({ shelves, onChanged }: { shelves: Shelf[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addShelf() {
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      // Do not swallow: a failed write must be visible, not a silent no-op.
      if (!res.ok) {
        setError("Could not create that shelf. Try again.");
        return;
      }
      setName("");
      onChanged();
    } catch {
      setError("Could not create that shelf. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  async function del(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/shelves/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove that shelf. Try again.");
        return;
      }
      onChanged();
    } catch {
      setError("Could not remove that shelf. Check your connection and try again.");
    }
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
              <button type="button" onClick={() => del(s.id)} className="fx-library-btn">
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
          disabled={pending}
          className="cap-btn"
          data-size="sm"
        >
          Add
        </button>
      </div>
      {pending ? (
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
