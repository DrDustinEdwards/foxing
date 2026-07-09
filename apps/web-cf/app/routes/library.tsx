// The reader's personal library (auth-gated). Reads run in-process via core in
// loadLibraryData (the standing rule: loaders never self-fetch the Worker's own
// /api/v1, that loopback returns HTML, not JSON). Writes (status, shelves, goals) go
// to /api/v1 from the browser client and the page revalidates. Status transitions
// emit events server-side.
import { useState } from "react";
import { Link, redirect, useRevalidator } from "react-router";
import { BookStatusControl, type ShelfStatus } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
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
        <h1 className="font-display text-4xl">Your library</h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {/* Status tabs */}
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reading status">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className="rounded-full border border-border-subtle px-4 py-1.5 font-ui text-sm aria-selected:border-border-interactive aria-selected:bg-selected"
                >
                  {t.label}
                  {counts[t.value] ? (
                    <span className="ml-1.5 text-tertiary">{counts[t.value]}</span>
                  ) : null}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="mt-8 font-ui text-sm text-tertiary">
                No books here yet.{" "}
                <Link to="/books" className="text-brand-text hover:underline">
                  Browse the library
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-6 flex flex-col gap-4">
                {shown.map((e) => (
                  <li
                    key={e.bookId}
                    className="flex gap-4 rounded-card border border-border-subtle bg-surface p-3"
                  >
                    <Link to={`/books/${e.slug}`} className="w-16 shrink-0">
                      <CoverImage
                        src={e.coverUrl}
                        alt={`Cover of ${e.title}`}
                        fallbackLabel={e.title}
                        sizes="64px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/books/${e.slug}`}
                        className="font-display text-lg hover:text-brand-text"
                      >
                        {e.title}
                      </Link>
                      <p className="font-ui text-sm text-secondary">{e.author}</p>
                      {e.status === "reading" && e.progressPct > 0 ? (
                        <p className="mt-1 font-ui text-xs text-tertiary">
                          {e.progressPct.toFixed(0)}% read
                        </p>
                      ) : null}
                      <div className="mt-2">
                        <BookStatusControl
                          bookId={e.bookId}
                          currentStatus={e.status as ShelfStatus}
                          signedIn
                          loginHref="/login"
                          onChanged={refresh}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sidebar: streak, goals, shelves */}
          <aside className="flex flex-col gap-6">
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
    <section className="rounded-card border border-border-subtle bg-surface p-4">
      <Eyebrow className="mb-3">Reading streak</Eyebrow>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: "Current", v: s.currentStreak },
          { k: "Longest", v: s.longestStreak },
          { k: "Finished", v: s.totalBooksFinished },
        ].map((x) => (
          <div key={x.k}>
            <dd className="font-display text-2xl">{x.v}</dd>
            <dt className="font-ui text-xs text-tertiary">{x.k}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GoalsCard({ goals, onChanged }: { goals: GoalRow[]; onChanged: () => void }) {
  const [target, setTarget] = useState(12);
  const [pending, setPending] = useState(false);
  const year = 2026;

  async function addGoal() {
    setPending(true);
    try {
      const res = await fetch("/api/v1/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "books", target, periodType: "year", year }),
      });
      if (res.ok) onChanged();
    } finally {
      setPending(false);
    }
  }
  async function del(id: string) {
    const res = await fetch(`/api/v1/goals/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4">
      <Eyebrow className="mb-3">Reading goals</Eyebrow>
      <ul className="flex flex-col gap-3">
        {goals.map(({ goal, progress }) => (
          <li key={goal.id}>
            <div className="flex items-center justify-between font-ui text-sm">
              <span>
                {goal.target} {goal.type} in {goal.year}
              </span>
              <button
                type="button"
                onClick={() => del(goal.id)}
                className="text-xs text-tertiary hover:underline"
              >
                Remove
              </button>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-sunken"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemax={goal.target}
            >
              <div
                className="h-full rounded-full bg-[color:var(--brand-ui)]"
                style={{ width: `${Math.min(100, (progress / goal.target) * 100)}%` }}
              />
            </div>
            <p className="mt-1 font-ui text-xs text-tertiary">
              {progress} of {goal.target}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <label className="font-ui text-sm">
          <span className="sr-only">Books this year</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={addGoal}
          disabled={pending}
          className="rounded-md border border-border-interactive px-3 py-1 font-ui text-sm hover:bg-hover disabled:opacity-50"
        >
          Set {year} goal
        </button>
      </div>
    </section>
  );
}

function ShelvesCard({ shelves, onChanged }: { shelves: Shelf[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function addShelf() {
    if (!name.trim()) return;
    setPending(true);
    try {
      const res = await fetch("/api/v1/shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setName("");
        onChanged();
      }
    } finally {
      setPending(false);
    }
  }
  async function del(id: string) {
    const res = await fetch(`/api/v1/shelves/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4">
      <Eyebrow className="mb-3">Shelves</Eyebrow>
      <ul className="flex flex-col gap-1.5">
        {shelves.map((s) => (
          <li key={s.id} className="flex items-center justify-between font-ui text-sm">
            <span>{s.name}</span>
            <button
              type="button"
              onClick={() => del(s.id)}
              className="text-xs text-tertiary hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New shelf"
          className="min-w-0 flex-1 rounded-md border border-border-subtle bg-base px-2 py-1 font-ui text-sm"
        />
        <button
          type="button"
          onClick={addShelf}
          disabled={pending}
          className="rounded-md border border-border-interactive px-3 py-1 font-ui text-sm hover:bg-hover disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </section>
  );
}
