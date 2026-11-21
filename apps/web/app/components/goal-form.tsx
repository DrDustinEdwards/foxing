// Shared by the goals page and the library's goals card: a books goal for the current
// period, and the period picker. The write goes through @foxing/client, which refetches
// the goals list; no page reload.
import { Select } from "capsomer/react/select";
import { isoWeek, useCreateGoal } from "@foxing/client";
import { useState } from "react";

type Period = "year" | "month" | "week";

export function useGoalDraft() {
  const [target, setTarget] = useState(12);
  const [period, setPeriod] = useState<Period>("year");
  const create = useCreateGoal();

  function add() {
    const now = new Date();
    create.fire({
      type: "books",
      target,
      periodType: period,
      year: now.getFullYear(),
      ...(period === "month" ? { month: now.getMonth() + 1 } : {}),
      ...(period === "week" ? { week: isoWeek(now) } : {}),
    });
  }

  return {
    target,
    setTarget,
    period,
    setPeriod,
    pending: create.pending,
    error: create.error,
    add,
  };
}

export function GoalPeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <label className="cap-text" data-size="small" data-face="ui">
      <span className="cap-sr-only">Goal period</span>
      <Select
        native
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        options={[
          { value: "year", label: "this year" },
          { value: "month", label: "this month" },
          { value: "week", label: "this week" },
        ]}
      />
    </label>
  );
}
