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

const EMPTY_COPY: Record<ShelfStatus, string> = {
  reading: "Nothing in progress.",
  want: "Your shelf is empty.",
  finished: "No books finished yet.",
  paused: "No paused books.",
  abandoned: "No abandoned books.",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ISO week number (weeks start Monday; week 1 holds the year's first Thursday),
// matching core periodRange so the client and the progress query agree.
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

function goalPeriodLabel(goal: GoalRow["goal"]): string {
  if (goal.periodType === "month" && goal.month) return `${MONTHS[goal.month - 1]} ${goal.year}`;
  if (goal.periodType === "week" && goal.week) return `week ${goal.week}, ${goal.year}`;
  return `${goal.year}`;
}

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
              <div className="mt-10 rounded-card border border-dashed border-border-subtle bg-surface p-10 text-center">
                <p className="font-ui text-sm text-tertiary">{EMPTY_COPY[tab]}</p>
                <Link
                  to="/books"
                  className="mt-2 inline-block font-ui text-sm text-brand-text hover:underline"
                >
                  Find a book
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {shown.map((e) => (
                  <div
                    key={e.bookId}
                    className="flex flex-col rounded-card border border-border-subtle bg-surface p-2.5"
                  >
                    <Link to={`/books/${e.slug}`} className="relative block">
                      <CoverImage
                        src={e.coverUrl}
                        alt={`Cover of ${e.title}`}
                        fallbackLabel={e.title}
                        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
                      />
                      {e.status === "paused" || e.status === "abandoned" ? (
                        <span className="absolute right-2 top-2 rounded-full border border-border-subtle bg-surface/90 px-2 py-0.5 font-ui text-xs text-secondary">
                          {e.status === "paused" ? "Paused" : "Set aside"}
                        </span>
                      ) : null}
                      {e.status === "reading" && e.progressPct > 0 ? (
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-sunken">
                          <span
                            className="block h-full bg-[color:var(--brand-ui)]"
                            style={{ width: `${Math.min(100, e.progressPct)}%` }}
                          />
                        </span>
                      ) : null}
                    </Link>
                    <div className="mt-3 px-0.5">
                      <Link
                        to={`/books/${e.slug}`}
                        className="font-display text-base leading-snug text-primary hover:text-brand-text"
                      >
                        {e.title}
                      </Link>
                      <p className="mt-1 font-ui text-sm text-tertiary">{e.author}</p>
                    </div>
                    <div className="mt-2 px-0.5">
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
  const [period, setPeriod] = useState<"year" | "month" | "week">("year");
  const [pending, setPending] = useState(false);

  async function addGoal() {
    setPending(true);
    try {
      const now = new Date();
      const body: {
        type: string;
        target: number;
        periodType: string;
        year: number;
        month?: number;
        week?: number;
      } = { type: "books", target, periodType: period, year: now.getFullYear() };
      if (period === "month") body.month = now.getMonth() + 1;
      if (period === "week") body.week = isoWeek(now);
      const res = await fetch("/api/v1/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      {goals.length === 0 ? (
        <p className="font-ui text-sm text-tertiary">No goals set.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map(({ goal, progress }) => (
            <li key={goal.id}>
              <div className="flex items-center justify-between font-ui text-sm">
                <span>
                  {goal.target} {goal.type} in {goalPeriodLabel(goal)}
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
      )}
      <div className="mt-3 flex items-center gap-2">
        <label className="font-ui text-sm">
          <span className="sr-only">Books</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            className="w-14 rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
          />
        </label>
        <label className="font-ui text-sm">
          <span className="sr-only">Goal period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "year" | "month" | "week")}
            className="rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
          >
            <option value="year">this year</option>
            <option value="month">this month</option>
            <option value="week">this week</option>
          </select>
        </label>
        <button
          type="button"
          onClick={addGoal}
          disabled={pending}
          className="rounded-md border border-border-interactive px-3 py-1 font-ui text-sm hover:bg-hover disabled:opacity-50"
        >
          Set
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
      {shelves.length === 0 ? (
        <p className="font-ui text-sm text-tertiary">No shelves yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shelves.map((s) => (
            <li key={s.id} className="flex items-center justify-between font-ui text-sm">
              <Link to={`/shelves/${s.id}`} className="hover:text-brand-text">
                {s.name}
              </Link>
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
      )}
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
