// Shared by the goals page and the library's goals card: creating a books goal for the
// current period, and the period picker.
import { useState } from "react";
import { isoWeek } from "~/lib/goals";

type Period = "year" | "month" | "week";

export function useCreateGoal(onChanged: () => void) {
  const [target, setTarget] = useState(12);
  const [period, setPeriod] = useState<Period>("year");
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

  return { target, setTarget, period, setPeriod, pending, error, setError, add };
}

export function GoalPeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <label className="sans small">
      <span className="cap-sr-only">Goal period</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        className="cap-select"
      >
        <option value="year">this year</option>
        <option value="month">this month</option>
        <option value="week">this week</option>
      </select>
    </label>
  );
}
