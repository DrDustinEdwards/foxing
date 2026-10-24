import { useClubWrite } from "~/hooks/use-club-write";
import { useState } from "react";
import { Link } from "react-router";

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
    <div className="fx-club-sections-box">
      {!isMember ? (
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className="cap-btn"
          data-variant="primary"
        >
          {membership?.status === "requested" ? "Request pending" : "Join club"}
        </button>
      ) : (
        <div className="stack-2">
          {code ? (
            <div className="py-2 fx-club-sections-card">
              <p className="group-label">Invite link</p>
              <p className="sans small">
                <Link to={`/join/${code}`} className="fx-club-sections-link">
                  /join/{code}
                </Link>
              </p>
              <button
                type="button"
                onClick={rotate}
                disabled={pending}
                className="mt-1 fx-club-sections-btn"
              >
                Reset link
              </button>
            </div>
          ) : null}
          {!isCreator ? (
            <button type="button" onClick={leave} disabled={pending} className="cap-btn">
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
