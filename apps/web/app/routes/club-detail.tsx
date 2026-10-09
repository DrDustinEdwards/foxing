// Club detail (auth-gated read in-process). Members get the live experience: a presence
// indicator and poll tallies that update in real time over the club WebSocket. Every
// write goes to /api/v1 and the page revalidates; live messages arrive independently so
// another member's post/vote shows up without a manual refresh.
import { useEffect, useState } from "react";
import { Link, redirect, useRevalidator } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { useClubLive } from "~/hooks/use-club-live";
import { useClubWrite } from "~/hooks/use-club-write";
import { getAuth } from "~/lib/auth.server";
import { type PollWithTally, loadClubDetail } from "~/lib/clubs.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/clubs/${params.slug}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const detail = await loadClubDetail(env, params.slug, session.user.id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return { ...detail, viewerId: session.user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.club?.name ?? "Club";
  return [{ title: `${name} | Foxing` }, { name: "robots", content: "noindex" }];
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      className="mt-2 rounded-md border border-danger/50 bg-danger-subtle px-3 py-1.5 font-ui text-xs text-danger-text"
      role="alert"
    >
      {error}
    </p>
  );
}

export default function ClubDetail({ loaderData }: Route.ComponentProps) {
  const { club, membership, isMember, memberCount, threads, polls, meetings, schedule, viewerId } =
    loaderData;
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
  const isModerator = membership?.role === "owner" || membership?.role === "moderator";

  // Live tallies: seed from the loader, then let the socket update them in place.
  const [liveTallies, setLiveTallies] = useState<Record<string, Record<string, number>>>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: club.id is the trigger, not an input. The route component stays mounted when the slug changes, so this drops the previous club's tallies.
  useEffect(() => {
    setLiveTallies({});
  }, [club.id]);

  const { presence, connected } = useClubLive(isMember ? club.id : null, {
    onThread: refresh,
    onNotice: refresh,
    onTally: (msg) => setLiveTallies((prev) => ({ ...prev, [msg.poll_id]: msg.tallies })),
  });

  return (
    <PageShell>
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">{club.name}</h1>
            {club.description ? (
              <p className="mt-2 max-w-2xl font-body text-secondary">{club.description}</p>
            ) : null}
            <p className="mt-2 font-ui text-sm text-tertiary">
              {memberCount} {memberCount === 1 ? "member" : "members"}
              {isMember && connected ? (
                <span className="ml-3 inline-flex items-center gap-1.5 text-brand-text">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-ui" />
                  <span aria-live="polite">{presence.length} here now</span>
                </span>
              ) : null}
            </p>
          </div>
          <MembershipControls
            clubId={club.id}
            slug={club.slug ?? ""}
            membership={membership}
            isMember={isMember}
            isCreator={club.creatorId === viewerId}
            joinCode={isModerator ? (club.joinCode ?? null) : null}
            onChange={refresh}
          />
        </div>

        {isMember ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-10">
              <ThreadsSection
                clubId={club.id}
                slug={club.slug ?? ""}
                threads={threads}
                onChange={refresh}
              />
              <PollsSection
                clubId={club.id}
                polls={polls}
                liveTallies={liveTallies}
                canModerate={isModerator}
                viewerId={viewerId}
                onChange={refresh}
              />
            </div>
            <aside className="space-y-10">
              <MeetingsSection clubId={club.id} meetings={meetings} onChange={refresh} />
              <ScheduleSection
                clubId={club.id}
                schedule={schedule}
                canModerate={isModerator}
                onChange={refresh}
              />
            </aside>
          </div>
        ) : (
          <div className="mt-10 rounded-card border border-dashed border-border-subtle bg-surface p-10 text-center">
            <p className="font-ui text-sm text-tertiary">
              Join this club to read its discussions, polls, and meetings.
            </p>
          </div>
        )}
      </Container>
    </PageShell>
  );
}

function MembershipControls({
  clubId,
  slug,
  membership,
  isMember,
  isCreator,
  joinCode,
  onChange,
}: {
  clubId: string;
  slug: string;
  membership: { status: string } | null;
  isMember: boolean;
  isCreator: boolean;
  joinCode: string | null;
  onChange: () => void;
}) {
  const { write, error, pending } = useClubWrite();
  const [code, setCode] = useState(joinCode);

  async function join() {
    const r = await write(`/clubs/${clubId}/join`);
    if (r.ok) onChange();
  }
  async function leave() {
    const r = await write(`/clubs/${clubId}/members/me`, { method: "DELETE" });
    if (r.ok) onChange();
  }
  async function rotate() {
    const r = await write(`/clubs/${clubId}/invite-code`);
    if (r.ok) setCode((r.data as { joinCode?: string })?.joinCode ?? code);
  }

  return (
    <div className="text-right">
      {!isMember ? (
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className="rounded-cover bg-brand-text px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
        >
          {membership?.status === "requested" ? "Request pending" : "Join club"}
        </button>
      ) : (
        <div className="space-y-2">
          {code ? (
            <div className="rounded-card border border-border-subtle bg-surface px-3 py-2 text-left">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Invite link
              </p>
              <p className="font-ui text-sm">
                <Link to={`/join/${code}`} className="text-brand-text underline">
                  /join/{code}
                </Link>
              </p>
              <button
                type="button"
                onClick={rotate}
                disabled={pending}
                className="mt-1 font-ui text-xs text-tertiary underline hover:text-primary"
              >
                Reset link
              </button>
            </div>
          ) : null}
          {!isCreator ? (
            <button
              type="button"
              onClick={leave}
              disabled={pending}
              className="rounded-cover border border-border-subtle px-4 py-2 font-ui text-sm text-secondary transition-colors hover:bg-hover disabled:opacity-60"
            >
              Leave
            </button>
          ) : null}
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function ThreadsSection({
  clubId,
  slug,
  threads,
  onChange,
}: {
  clubId: string;
  slug: string;
  threads: { id: string; title: string; type: string; createdAt: Date }[];
  onChange: () => void;
}) {
  const { write, error, pending } = useClubWrite();
  const [open, setOpen] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const r = await write(`/clubs/${clubId}/threads`, {
      body: {
        title: String(form.get("title") ?? "").trim(),
        body: String(form.get("body") ?? "").trim() || undefined,
      },
    });
    if (r.ok) {
      setOpen(false);
      onChange();
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Discussions</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-ui text-sm text-brand-text underline"
        >
          {open ? "Cancel" : "New thread"}
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
            placeholder="Thread title"
            aria-label="Thread title"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <textarea
            name="body"
            rows={2}
            placeholder="Start the discussion (optional)"
            aria-label="First message"
            className="w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-cover bg-brand-text px-4 py-1.5 font-ui text-sm text-on-brand disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
          >
            Post thread
          </button>
          <ErrorText error={error} />
        </form>
      ) : null}

      {threads.length === 0 ? (
        <p className="mt-4 font-ui text-sm text-tertiary">No discussions yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                to={`/clubs/${slug}/t/${t.id}`}
                className="block rounded-card border border-border-subtle bg-surface p-4 transition-colors hover:border-border-interactive"
              >
                {t.type === "announcement" ? (
                  <span className="mr-2 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide text-brand-subtle-text">
                    Announcement
                  </span>
                ) : null}
                <span className="font-ui text-primary">{t.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PollsSection({
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

function MeetingsSection({
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

function ScheduleSection({
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
