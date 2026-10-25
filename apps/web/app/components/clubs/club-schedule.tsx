import {
  useAddSchedule,
  useClosePoll,
  useCreateMeeting,
  useCreatePoll,
  useRsvp,
  useVotePoll,
} from "@foxing/client";
import type { ClubMeetingItem, ClubPollItem, ClubScheduleItem } from "@foxing/types";
import { useState } from "react";
import { ErrorText } from "./club-sections";

export function PollsSection({
  clubId,
  polls,
  canModerate,
  viewerId,
}: {
  clubId: string;
  polls: ClubPollItem[];
  canModerate: boolean;
  viewerId: string;
}) {
  const createPoll = useCreatePoll();
  const vote = useVotePoll();
  const close = useClosePoll();
  const pending = createPoll.pending || vote.pending || close.pending;
  const [open, setOpen] = useState(false);
  const [optionCount, setOptionCount] = useState(2);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const options = Array.from({ length: optionCount }, (_, i) => {
      const label = String(form.get(`opt${i}`) ?? "").trim();
      return label ? { id: `o${i}`, label } : null;
    }).filter((o): o is { id: string; label: string } => o !== null);
    const r = await createPoll.run({
      clubId,
      title: String(form.get("title") ?? "").trim(),
      pollType: "single",
      options,
    });
    if (r) setOpen(false);
  }

  return (
    <section>
      <div className="row spread">
        <h2 className="display-2">Polls</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="fx-club-schedule-btn">
          {open ? "Cancel" : "New poll"}
        </button>
      </div>

      {open ? (
        <form onSubmit={create} className="mt-3 fx-club-schedule-card">
          <input
            name="title"
            required
            placeholder="Poll question"
            aria-label="Poll question"
            className="cap-input"
          />
          {Array.from({ length: optionCount }, (_, i) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: options are only appended, never removed or reordered, and the field name opt{i} is positional too.
              key={i}
              name={`opt${i}`}
              required={i < 2}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              className="cap-input"
            />
          ))}
          <div className="row">
            {optionCount < 6 ? (
              <button
                type="button"
                onClick={() => setOptionCount((n) => n + 1)}
                className="fx-club-schedule-btn-2"
              >
                Add option
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="cap-btn"
              data-variant="primary"
              data-size="sm"
            >
              Create poll
            </button>
          </div>
          <ErrorText error={createPoll.error} />
        </form>
      ) : null}

      {polls.length === 0 ? (
        <p className="mt-4 meta">No polls yet.</p>
      ) : (
        <div className="mt-4 fx-club-schedule-box">
          {polls.map((poll) => {
            const total = Object.values(poll.tallies).reduce((a, b) => a + b, 0);
            return (
              <div key={poll.id} className="card">
                <div className="row spread">
                  <p className="strong sans">{poll.title}</p>
                  {poll.isClosed ? (
                    <span className="fx-club-schedule-caps">Closed</span>
                  ) : canModerate || poll.createdBy === viewerId ? (
                    <button
                      type="button"
                      onClick={() => close.fire({ clubId, pollId: poll.id })}
                      disabled={pending}
                      className="fx-club-schedule-btn-3"
                    >
                      Close poll
                    </button>
                  ) : null}
                </div>
                <ul className="mt-3 fx-club-schedule-list">
                  {poll.options.map((opt) => {
                    const count = poll.tallies[opt.id] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const mine = poll.myVote?.includes(opt.id);
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          disabled={poll.isClosed || pending}
                          onClick={() => vote.fire({ clubId, pollId: poll.id, ranks: [opt.id] })}
                          aria-pressed={mine}
                          className="fx-poll-option"
                        >
                          <span
                            aria-hidden="true"
                            className="fx-club-schedule-label"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative fx-club-schedule-label-2">{opt.label}</span>
                          <span className="relative fx-club-schedule-label-3" aria-live="polite">
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
      <ErrorText error={vote.error ?? close.error} />
    </section>
  );
}

export function MeetingsSection({
  clubId,
  meetings,
}: {
  clubId: string;
  meetings: ClubMeetingItem[];
}) {
  const createMeeting = useCreateMeeting();
  const rsvp = useRsvp();
  const [open, setOpen] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateStr = String(form.get("date") ?? "");
    const r = await createMeeting.run({
      clubId,
      title: String(form.get("title") ?? "").trim(),
      meetingDate: dateStr ? new Date(dateStr).getTime() : Date.now(),
    });
    if (r) setOpen(false);
  }

  return (
    <section>
      <div className="row spread">
        <h2 className="display-1">Meetings</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="fx-club-schedule-btn">
          {open ? "Cancel" : "Add"}
        </button>
      </div>
      {open ? (
        <form onSubmit={create} className="mt-3 fx-club-schedule-card-2">
          <input
            name="title"
            required
            placeholder="Meeting title"
            aria-label="Meeting title"
            className="cap-input"
          />
          <input
            name="date"
            type="datetime-local"
            aria-label="Meeting date and time"
            className="cap-input"
          />
          <button
            type="submit"
            disabled={createMeeting.pending}
            className="cap-btn"
            data-variant="primary"
            data-size="sm"
          >
            Schedule
          </button>
          <ErrorText error={createMeeting.error} />
        </form>
      ) : null}
      {meetings.length === 0 ? (
        <p className="mt-3 fx-club-schedule-text-2">No meetings scheduled.</p>
      ) : (
        <ul className="mt-3 fx-club-schedule-list-2">
          {meetings.map((m) => (
            <li key={m.id} className="fx-club-schedule-card-3">
              <p className="fx-club-schedule-text-3">{m.title}</p>
              <p className="fine">{new Date(m.meetingDate).toLocaleString()}</p>
              {!m.isCancelled ? (
                <div className="mt-2 fx-club-schedule-row">
                  {(["going", "maybe", "not_going"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => rsvp.fire({ clubId, meetingId: m.id, status: s })}
                      className="cap-chip"
                    >
                      {s === "not_going" ? "Can't" : s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 fine">Canceled</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={rsvp.error} />
    </section>
  );
}

export function ScheduleSection({
  clubId,
  schedule,
  canModerate,
}: {
  clubId: string;
  schedule: ClubScheduleItem[];
  canModerate: boolean;
}) {
  const { run, error, pending } = useAddSchedule();
  const now = Date.now();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const dateStr = String(form.get("unlock") ?? "");
    const r = await run({
      clubId,
      chapterName: String(form.get("chapter") ?? "").trim(),
      unlockDate: dateStr ? new Date(dateStr).getTime() : Date.now(),
    });
    if (r) formEl.reset();
  }

  return (
    <section>
      <h2 className="display-1">Reading schedule</h2>
      {schedule.length === 0 ? (
        <p className="mt-3 fx-club-schedule-text-2">No schedule set.</p>
      ) : (
        <ul className="mt-3 fx-club-schedule-list">
          {schedule.map((s) => {
            const unlocked = s.unlockDate <= now;
            return (
              <li key={s.id} className="py-2 fx-club-schedule-card-4">
                <span className={unlocked ? "ink" : "dim"}>{s.chapterName}</span>
                <span className="fx-club-schedule-caps">
                  {unlocked ? "Unlocked" : new Date(s.unlockDate).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {canModerate ? (
        <form onSubmit={add} className="mt-3 fx-club-schedule-form">
          <input
            name="chapter"
            required
            placeholder="Chapter or section"
            aria-label="Chapter or section"
            className="cap-input"
          />
          <input
            name="unlock"
            type="datetime-local"
            aria-label="Unlock date"
            className="cap-input"
          />
          <button
            type="submit"
            disabled={pending}
            className="cap-btn"
            data-variant="primary"
            data-size="sm"
          >
            Add
          </button>
          <ErrorText error={error} />
        </form>
      ) : null}
    </section>
  );
}
