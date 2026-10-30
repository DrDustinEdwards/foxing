import { useCreateThread, useJoinClub, useLeaveClub, useRotateInviteCode } from "@foxing/client";
import type { ClubMembership, ClubThreadItem } from "@foxing/types";
import { useState } from "react";
import { Link } from "capsomer/react/link";

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-2 fx-club-sections-text" role="alert">
      {error}
    </p>
  );
}

export function MembershipControls({
  clubId,
  membership,
  isMember,
  isCreator,
  joinCode,
}: {
  clubId: string;
  membership: ClubMembership | null;
  isMember: boolean;
  isCreator: boolean;
  joinCode: string | null;
}) {
  const join = useJoinClub();
  const leave = useLeaveClub();
  const rotate = useRotateInviteCode();
  const pending = join.pending || leave.pending || rotate.pending;
  const error = join.error ?? leave.error ?? rotate.error;

  return (
    <div className="fx-club-sections-box">
      {!isMember ? (
        <button
          type="button"
          onClick={() => join.fire({ clubId })}
          disabled={pending}
          className="cap-btn"
          data-variant="primary"
        >
          {membership?.status === "requested" ? "Request pending" : "Join club"}
        </button>
      ) : (
        <div className="stack-2">
          {joinCode ? (
            <div className="py-2 fx-club-sections-card">
              <p className="group-label">Invite link</p>
              <p className="sans small">
                <Link to={`/join/${joinCode}`} className="fx-club-sections-link">
                  /join/{joinCode}
                </Link>
              </p>
              <button
                type="button"
                onClick={() => rotate.fire({ clubId })}
                disabled={pending}
                className="mt-1 fx-club-sections-btn"
              >
                Reset link
              </button>
            </div>
          ) : null}
          {!isCreator ? (
            <button
              type="button"
              onClick={() => leave.fire({ clubId })}
              disabled={pending}
              className="cap-btn"
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

export function ThreadsSection({
  clubId,
  slug,
  threads,
}: {
  clubId: string;
  slug: string;
  threads: ClubThreadItem[];
}) {
  const { run, error, pending } = useCreateThread();
  const [open, setOpen] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const r = await run({
      clubId,
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim() || undefined,
    });
    if (r) setOpen(false);
  }

  return (
    <section>
      <div className="row spread">
        <h2 className="display-2">Discussions</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="fx-club-sections-btn-2">
          {open ? "Cancel" : "New thread"}
        </button>
      </div>

      {open ? (
        <form onSubmit={create} className="mt-3 fx-club-sections-card-2">
          <input
            name="title"
            required
            placeholder="Thread title"
            aria-label="Thread title"
            className="cap-input"
          />
          <textarea
            name="body"
            rows={2}
            placeholder="Start the discussion (optional)"
            aria-label="First message"
            className="cap-input"
          />
          <button
            type="submit"
            disabled={pending}
            className="cap-btn"
            data-variant="primary"
            data-size="sm"
          >
            Post thread
          </button>
          <ErrorText error={error} />
        </form>
      ) : null}

      {threads.length === 0 ? (
        <p className="mt-4 meta">No discussions yet.</p>
      ) : (
        <ul className="mt-4 fx-club-sections-list">
          {threads.map((t) => (
            <li key={t.id}>
              <Link to={`/clubs/${slug}/t/${t.id}`} className="block fx-club-sections-card-3">
                {t.type === "announcement" ? (
                  <span className="fx-club-sections-caps">Announcement</span>
                ) : null}
                <span className="ink sans">{t.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
