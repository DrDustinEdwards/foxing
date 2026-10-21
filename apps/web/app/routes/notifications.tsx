// The signed-in reader's notifications (auth-gated, noindex). Reads run in-process via
// core; requireProfile sends anonymous visitors to /login and no-profile users to
// /onboarding. "Mark all read" POSTs to the API and revalidates, with a visible error.
import { useState } from "react";
import { useRevalidator } from "react-router";
import { createDb, notificationsRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/notifications";

export function meta() {
  return [{ title: "Notifications | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const rows = await notificationsRepo.listForUser(db, user.id, { limit: 50 });
  const notifications = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));
  const unread = notifications.filter((n) => !n.isRead).length;
  return { notifications, unread };
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function Notifications({ loaderData }: Route.ComponentProps) {
  const { notifications, unread } = loaderData;
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markAllRead() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError("Could not mark your notifications as read. Try again.");
        return;
      }
      void revalidator.revalidate();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <div className="mb-10 flex items-end justify-between gap-4">
          <PageHeader eyebrow="Activity" title="Notifications" className="mb-0" />
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={pending}
              className="shrink-0 rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
            >
              {pending ? "Marking..." : "Mark all read"}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mb-4 font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            body="Replies, follows, and club activity will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-4"
              >
                <span
                  aria-hidden="true"
                  className={
                    n.isRead
                      ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong"
                      : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-ui"
                  }
                />
                <div className="min-w-0">
                  <p className="font-ui text-sm font-medium text-primary">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 font-ui text-sm text-secondary">{n.body}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-tertiary">
                    {dateFormat.format(new Date(n.createdAt))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
