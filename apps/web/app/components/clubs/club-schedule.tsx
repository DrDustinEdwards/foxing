import type { PollWithTally } from "~/lib/clubs.server";
import { useClubWrite } from "~/hooks/use-club-write";
import { useState } from "react";
import { ErrorText } from "./club-sections";

export function PollsSection({
  clubId,
  polls,
  liveTallies,
  canModerate,
  viewerId,
  onChange,
}: {
  clubId: string;
  polls: PollWithTally[];
  liveTallies: Record<string, Record<string, number>>;
  canModerate: boolean;
  viewerId: string;
  onChange: () => void;
}) {
  const { write, error, pending } = useClubWrite();
  const [open, setOpen] = useState(false);
  const [optionCount, setOptionCount] = useState(2);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const options = Array.from({ length: optionCount }, (_, i) => {
      const label = String(form.get(`opt${i}`) ?? "").trim();
      return label ? { id: `o${i}`, label } : null;
    }).filter((o): o is { id: string; label: string } => o !== null);
    const r = await write(`/clubs/${clubId}/polls`, {
      body: { title: String(form.get("title") ?? "").trim(), pollType: "single", options },
    });
    if (r.ok) {
      setOpen(false);
      onChange();
    }
  }

  async function vote(pollId: string, optionId: string) {
    const r = await write(`/polls/${pollId}/vote`, { body: { ranks: [optionId] } });
    if (r.ok) onChange();
  }
  async function close(pollId: string) {
    const r = await write(`/polls/${pollId}/close`);
    if (r.ok) onChange();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Polls</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-ui text-sm text-brand-text underline"
        >
          {open ? "Cancel" : "New poll"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={create}
          className="mt-3 space-y-2 rounded-card border border-border-subtle bg-surface p-4"
        >
          <input
            name="title"
            required
            placeholder="Poll question"
            aria-label="Poll question"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          {Array.from({ length: optionCount }, (_, i) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: options are only appended, never removed or reordered, and the field name opt{i} is positional too.
              key={i}
              name={`opt${i}`}
              required={i < 2}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
            />
          ))}
          <div className="flex items-center gap-3">
            {optionCount < 6 ? (
              <button
                type="button"
                onClick={() => setOptionCount((n) => n + 1)}
                className="font-ui text-xs text-tertiary underline"
              >
                Add option
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-cover bg-brand-text px-4 py-1.5 font-ui text-sm text-on-brand disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
            >
              Create poll
            </button>
          </div>
          <ErrorText error={error} />
        </form>
      ) : null}

      {polls.length === 0 ? (
        <p className="mt-4 font-ui text-sm text-tertiary">No polls yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {polls.map(({ poll, tallies, myVote }) => {
            const live = liveTallies[poll.id] ?? tallies;
            const total = Object.values(live).reduce((a, b) => a + b, 0);
            return (
              <div
                key={poll.id}
                className="rounded-card border border-border-subtle bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-ui font-medium text-primary">{poll.title}</p>
                  {poll.isClosed ? (
                    <span className="font-mono text-[0.625rem] uppercase tracking-wide text-tertiary">
                      Closed
                    </span>
                  ) : canModerate || poll.createdBy === viewerId ? (
                    <button
                      type="button"
                      onClick={() => close(poll.id)}
                      disabled={pending}
                      className="font-ui text-xs text-tertiary underline hover:text-primary"
                    >
                      Close poll
                    </button>
                  ) : null}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {(poll.options ?? []).map((opt) => {
                    const count = live[opt.id] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const mine = myVote?.includes(opt.id);
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          disabled={poll.isClosed || pending}
                          onClick={() => vote(poll.id, opt.id)}
                          aria-pressed={mine}
                          className="group relative flex w-full items-center justify-between overflow-hidden rounded-card border border-border-subtle px-3 py-2 text-left font-ui text-sm aria-pressed:border-border-interactive disabled:cursor-default"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 bg-brand-subtle transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative z-10">{opt.label}</span>
                          <span
                            className="relative z-10 tabular-nums text-tertiary"
                            aria-live="polite"
                          >
                            {count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MeetingsSection({
  clubId,
  meetings,
  onChange,
}: {
  clubId: string;
  meetings: { id: string; title: string; meetingDate: Date; isCancelled: boolean }[];
  onChange: () => void;
}) {
  const { write, error, pending } = useClubWrite();
  const [open, setOpen] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateStr = String(form.get("date") ?? "");
    const r = await write(`/clubs/${clubId}/meetings`, {
      body: {
        title: String(form.get("title") ?? "").trim(),
        meetingDate: dateStr ? new Date(dateStr).getTime() : Date.now(),
      },
    });
    if (r.ok) {
      setOpen(false);
      onChange();
    }
  }
  async function rsvp(meetingId: string, status: string) {
    await write(`/meetings/${meetingId}/rsvp`, { body: { status } });
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Meetings</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-ui text-sm text-brand-text underline"
        >
          {open ? "Cancel" : "Add"}
        </button>
      </div>
      {open ? (
        <form
          onSubmit={create}
          className="mt-3 space-y-2 rounded-card border border-border-subtle bg-surface p-3"
        >
          <input
            name="title"
            required
            placeholder="Meeting title"
            aria-label="Meeting title"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <input
            name="date"
            type="datetime-local"
            aria-label="Meeting date and time"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-cover bg-brand-text px-3 py-1.5 font-ui text-sm text-on-brand disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
          >
            Schedule
          </button>
          <ErrorText error={error} />
        </form>
      ) : null}
      {meetings.length === 0 ? (
        <p className="mt-3 font-ui text-sm text-tertiary">No meetings scheduled.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {meetings.map((m) => (
            <li key={m.id} className="rounded-card border border-border-subtle bg-surface p-3">
              <p className="font-ui text-sm text-primary">{m.title}</p>
              <p className="font-ui text-xs text-tertiary">
                {new Date(m.meetingDate).toLocaleString()}
              </p>
              {!m.isCancelled ? (
                <div className="mt-2 flex gap-2">
                  {(["going", "maybe", "not_going"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => rsvp(m.id, s)}
                      className="rounded-full border border-border-subtle px-2.5 py-0.5 font-ui text-xs text-secondary hover:bg-hover"
                    >
                      {s === "not_going" ? "Can't" : s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 font-ui text-xs text-tertiary">Cancelled</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScheduleSection({
  clubId,
  schedule,
  canModerate,
  onChange,
}: {
  clubId: string;
  schedule: { id: string; chapterName: string; unlockDate: Date }[];
  canModerate: boolean;
  onChange: () => void;
}) {
  const { write, error, pending } = useClubWrite();
  const now = Date.now();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateStr = String(form.get("unlock") ?? "");
    const r = await write(`/clubs/${clubId}/schedule`, {
      body: {
        chapterName: String(form.get("chapter") ?? "").trim(),
        unlockDate: dateStr ? new Date(dateStr).getTime() : Date.now(),
      },
    });
    if (r.ok) {
      (e.target as HTMLFormElement).reset();
      onChange();
    }
  }

  return (
    <section>
      <h2 className="font-display text-xl">Reading schedule</h2>
      {schedule.length === 0 ? (
        <p className="mt-3 font-ui text-sm text-tertiary">No schedule set.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {schedule.map((s) => {
            const unlocked = new Date(s.unlockDate).getTime() <= now;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-card border border-border-subtle bg-surface px-3 py-2 font-ui text-sm"
              >
                <span className={unlocked ? "text-primary" : "text-tertiary"}>{s.chapterName}</span>
                <span className="font-mono text-[0.625rem] uppercase tracking-wide text-tertiary">
                  {unlocked ? "Unlocked" : new Date(s.unlockDate).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {canModerate ? (
        <form
          onSubmit={add}
          className="mt-3 space-y-2 rounded-card border border-dashed border-border-subtle p-3"
        >
          <input
            name="chapter"
            required
            placeholder="Chapter or section"
            aria-label="Chapter or section"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <input
            name="unlock"
            type="datetime-local"
            aria-label="Unlock date"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-cover bg-brand-text px-3 py-1.5 font-ui text-sm text-on-brand disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
          >
            Add
          </button>
          <ErrorText error={error} />
        </form>
      ) : null}
    </section>
  );
}
