// The signed-in reader's reading goals index (auth-gated, noindex). Reads run in-process
// via loadGoals (mirrors GET /goals); writes go to /api/v1/goals from the browser and the
// page revalidates. Books-type goals show progress against finishes in their period.
// Active goals (their period covers today) are separated from past ones.
import { useState } from "react";
import { useRevalidator } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { goalPeriodLabel, isoWeek } from "~/lib/goals";
import type { GoalRow } from "~/lib/library.server";
import { loadGoals } from "~/lib/library.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/goals";

export function meta() {
  return [{ title: "Reading goals | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const goals = await loadGoals(env, user.id);
  return { goals };
}

/** A goal is active when its period covers the current date; otherwise it is past. */
function isActive(goal: GoalRow["goal"], now: Date): boolean {
  const year = now.getUTCFullYear();
  if (goal.year !== year) return false;
  if (goal.periodType === "month") return goal.month === now.getUTCMonth() + 1;
  if (goal.periodType === "week") return goal.week === isoWeek(now);
  return true;
}

export default function Goals({ loaderData }: Route.ComponentProps) {
  const { goals } = loaderData;
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
  const now = new Date();
  const active = goals.filter((g) => isActive(g.goal, now));
  const past = goals.filter((g) => !isActive(g.goal, now));

  return (
    <PageShell>
      <Container className="max-w-2xl flex flex-col gap-8">
        <PageHeader eyebrow="Reading" title="Reading goals" className="mb-0" />

        <CreateGoal onChanged={refresh} />

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl text-primary">Active</h2>
          {active.length === 0 ? (
            <EmptyState title="No active goals." body="Set a target above to start tracking." />
          ) : (
            <ul className="flex flex-col gap-3">
              {active.map((g) => (
                <GoalItem key={g.goal.id} row={g} onChanged={refresh} />
              ))}
            </ul>
          )}
        </section>

        {past.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl text-primary">Past</h2>
            <ul className="flex flex-col gap-3">
              {past.map((g) => (
                <GoalItem key={g.goal.id} row={g} onChanged={refresh} />
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </PageShell>
  );
}

function GoalItem({ row, onChanged }: { row: GoalRow; onChanged: () => void }) {
  const { goal, progress } = row;
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.target);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.min(100, goal.target > 0 ? (progress / goal.target) * 100 : 0);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      // Do not swallow: a failed write must be visible, not a silent no-op.
      if (!res.ok) {
        setError("Could not update that goal. Try again.");
        return;
      }
      setEditing(false);
      onChanged();
    } catch {
      setError("Could not update that goal. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setError(null);
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, { method: "DELETE" });
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
    <li className="rounded-card border border-border-subtle bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-ui text-sm text-primary">
          {goal.target} {goal.type} in {goalPeriodLabel(goal)}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="font-ui text-xs text-tertiary hover:text-brand-text hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={remove}
            className="font-ui text-xs text-tertiary hover:text-error hover:underline"
          >
            Remove
          </button>
        </div>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-label={`${goal.target} ${goal.type} in ${goalPeriodLabel(goal)}`}
      >
        <div
          className="h-full rounded-full bg-[color:var(--brand-ui)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-ui text-xs text-tertiary">
        {progress} of {goal.target}
      </p>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <label className="font-ui text-sm">
            <span className="sr-only">New target</span>
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
            onClick={save}
            disabled={pending}
            className="rounded-md border border-border-interactive px-3 py-1 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            Save
          </button>
          {pending ? (
            <span className="font-ui text-xs text-tertiary" role="status">
              Saving...
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 font-ui text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function CreateGoal({ onChanged }: { onChanged: () => void }) {
  const [target, setTarget] = useState(12);
  const [period, setPeriod] = useState<"year" | "month" | "week">("year");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setPending(true);
    setError(null);
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
      // Do not swallow: a failed write must be visible, not a silent no-op.
      if (!res.ok) {
        setError("Could not save your goal. Try again.");
        return;
      }
      onChanged();
    } catch {
      setError("Could not save your goal. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-4">
      <p className="mb-3 font-ui text-sm font-medium text-primary">Set a new goal</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="font-ui text-sm">
          <span className="sr-only">Number of books</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded-md border border-border-subtle bg-base px-2 py-1 text-sm"
          />
        </label>
        <span className="font-ui text-sm text-secondary">books</span>
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
          onClick={add}
          disabled={pending}
          className="rounded-md bg-brand-ui px-4 py-1.5 font-ui text-sm font-medium text-on-brand transition hover:opacity-90 disabled:opacity-50"
        >
          Set goal
        </button>
      </div>
      {pending ? (
        <p className="mt-2 font-ui text-xs text-tertiary" role="status">
          Saving...
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 font-ui text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
