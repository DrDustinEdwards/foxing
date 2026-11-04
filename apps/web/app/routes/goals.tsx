// The signed-in reader's reading goals index (auth-gated, noindex). The loader reads
// core's goals view in-process (the same view GET /goals answers with); after that the
// list lives in the @foxing/client cache and every edit patches it in place. Books-type
// goals show progress against finishes in their period. Active goals (their period
// covers today) are separated from past ones.
import {
  goalPacing,
  goalPeriodLabel,
  isoWeek,
  periodElapsedFraction,
  useDeleteGoal,
  useGoals,
  useStreak,
  useUpdateGoal,
} from "@foxing/client";
import { createDb, libraryRepo, views } from "@foxing/core";
import type { Goal, GoalWithProgress } from "@foxing/types";
import { Meter } from "capsomer/react/meter";
import type { ReactNode } from "react";
import { useState } from "react";
import { GoalPeriodSelect, useGoalDraft } from "~/components/goal-form";
import { ReadingActivity } from "~/components/reading/reading-activity";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/goals";

export function meta() {
  return [{ title: "Reading goals | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);

  // Reading activity: books finished in each of the last 53 Sunday-first weeks. Finish dates are
  // the only real per-day reading signal in D1 (reading_sessions are unpopulated on web).
  const db = createDb(env.DB);
  const goals = await views.goals(db, user.id);
  const now = new Date();
  const dayMs = 86_400_000;
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const WEEKS = 53;
  const lastSunday = todayUTC - new Date(todayUTC).getUTCDay() * dayMs;
  const firstSunday = lastSunday - (WEEKS - 1) * 7 * dayMs;

  const [streak, finished] = await Promise.all([
    views.streak(db, user.id),
    libraryRepo.listFinishedInRangeForStats(db, user.id, firstSunday, todayUTC + dayMs),
  ]);

  const weeks = Array.from({ length: WEEKS }, (_, w) => ({
    start: firstSunday + w * 7 * dayMs,
    books: 0,
  }));
  for (const b of finished) {
    if (!b.finishedAt) continue;
    const w = Math.floor((b.finishedAt.getTime() - firstSunday) / (7 * dayMs));
    if (w >= 0 && w < WEEKS) weeks[w].books += 1;
  }

  return { goals, weeks, streak };
}

/** A goal is active when its period covers the current date; otherwise it is past. */
function isActive(goal: Goal, now: Date): boolean {
  const year = now.getUTCFullYear();
  if (goal.year !== year) return false;
  if (goal.periodType === "month") return goal.month === now.getUTCMonth() + 1;
  if (goal.periodType === "week") return goal.week === isoWeek(now);
  return true;
}

export default function Goals({ loaderData }: Route.ComponentProps) {
  const { weeks } = loaderData;
  const goals = useGoals(loaderData.goals).data;
  const streak = useStreak(loaderData.streak).data;
  const now = new Date();
  const active = goals.filter((g) => isActive(g.goal, now));
  const past = goals.filter((g) => !isActive(g.goal, now));

  return (
    <PageShell>
      <Container className="fx-goals-wrap">
        <PageHeader eyebrow="Reading" title="Reading goals" className="mb-0" />

        <CreateGoal />

        <section className="stack">
          <h2 className="display-2">Active</h2>
          {active.length === 0 ? (
            <EmptyState title="No active goals." body="Set a target above to start tracking." />
          ) : (
            <ul className="stack-3">
              {active.map((g) => (
                <GoalItem key={g.goal.id} row={g} active now={now} />
              ))}
            </ul>
          )}
        </section>

        {past.length > 0 ? (
          <section className="stack">
            <h2 className="display-2">Past</h2>
            <ul className="stack-3">
              {past.map((g) => (
                <GoalItem key={g.goal.id} row={g} active={false} now={now} />
              ))}
            </ul>
          </section>
        ) : null}

        <ReadingActivity weeks={weeks} streak={streak} />
      </Container>
    </PageShell>
  );
}

// A small status pill: success (reached / on track) or neutral (behind). Inline SVG check,
// no icon library. Uses the semantic success tokens so it reads in light and dark.
function GoalBadge({ tone, children }: { tone: "success" | "neutral"; children: ReactNode }) {
  return (
    <span className={tone === "success" ? "badge badge-ok" : "badge badge-quiet"}>{children}</span>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function GoalItem({ row, active, now }: { row: GoalWithProgress; active: boolean; now: Date }) {
  const { goal, progress } = row;
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.target);
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const pending = update.pending;
  const error = update.error ?? remove.error;
  const complete = goal.target > 0 && progress >= goal.target;
  const pacing =
    active && !complete
      ? goalPacing(progress, goal.target, periodElapsedFraction(goal.periodType, now))
      : null;

  async function save() {
    if (await update.run({ id: goal.id, target })) setEditing(false);
  }

  function removeGoal() {
    remove.fire({ id: goal.id });
  }

  return (
    <li className={complete ? "fx-goal fx-goal-done" : "fx-goal"}>
      <div className="fx-goals-row">
        <span className="fx-goals-label">
          <span>
            {goal.target} {goal.type} in {goalPeriodLabel(goal)}
          </span>
          {complete ? (
            <GoalBadge tone="success">
              <CheckIcon /> Goal reached
            </GoalBadge>
          ) : pacing?.onTrack ? (
            <GoalBadge tone="success">On track</GoalBadge>
          ) : pacing ? (
            <GoalBadge tone="neutral">Behind by {pacing.behind}</GoalBadge>
          ) : null}
        </span>
        <div className="shrink-0 row">
          <button type="button" onClick={() => setEditing((v) => !v)} className="fx-goals-btn">
            {editing ? "Cancel" : "Edit"}
          </button>
          <button type="button" onClick={removeGoal} className="fx-goals-btn-2">
            Remove
          </button>
        </div>
      </div>

      <Meter
        className="mt-2"
        label="Progress"
        value={progress}
        max={goal.target}
        tone={complete ? "ok" : undefined}
        valueText={`${progress} of ${goal.target} ${goal.type} in ${goalPeriodLabel(goal)}`}
      />

      {editing ? (
        <div className="mt-3 row-2">
          <label className="sans small">
            <span className="cap-sr-only">New target</span>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
              className="cap-input fx-goals-input"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="cap-btn"
            data-size="sm"
          >
            Save
          </button>
          {pending ? (
            <span className="fine" role="status">
              Saving...
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 error xsmall" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function CreateGoal() {
  const { target, setTarget, period, setPeriod, pending, error, add } = useGoalDraft();

  return (
    <section className="card">
      <p className="mb-3 fx-goals-text">Set a new goal</p>
      <div className="row-2 wrap">
        <label className="sans small">
          <span className="cap-sr-only">Number of books</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            className="cap-input fx-goals-input"
          />
        </label>
        <span className="ui">books</span>
        <GoalPeriodSelect value={period} onChange={setPeriod} />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="cap-btn"
          data-variant="primary"
          data-size="sm"
        >
          Set goal
        </button>
      </div>
      {pending ? (
        <p className="mt-2 fx-goals-text-2" role="status">
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
