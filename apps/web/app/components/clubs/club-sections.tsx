import { useClubWrite } from "~/hooks/use-club-write";
import { useState } from "react";
import { Link } from "react-router";

export function ErrorText({ error }: { error: string | null }) {
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
