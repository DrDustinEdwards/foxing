// The signed-in reader's notifications (auth-gated, noindex). Reads run in-process via
// core's notifications view; requireProfile sends anonymous visitors to /login and
// no-profile users to /onboarding. "Mark all read" clears the dots at once and rolls
// back with a visible error if the write fails.
import { useMarkNotificationsRead, useNotifications } from "@foxing/client";
import { createDb, views } from "@foxing/core";
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
  return views.notifications(createDb(env.DB), user.id);
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function Notifications({ loaderData }: Route.ComponentProps) {
  const { notifications, unread } = useNotifications(loaderData).data;
  const markRead = useMarkNotificationsRead();
  const { pending, error } = markRead;
  const markAllRead = () => markRead.fire();

  return (
    <PageShell>
      <Container>
        <div className="mb-10 items-end fx-notifications-row">
          <PageHeader eyebrow="Activity" title="Notifications" className="mb-0" />
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={pending}
              className="cap-btn shrink-0"
            >
              {pending ? "Marking..." : "Mark all read"}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mb-4 fx-notifications-text" role="alert">
            {error}
          </p>
        ) : null}
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            body="Replies, follows, and club activity will show up here."
          />
        ) : (
          <ul className="stack-2">
            {notifications.map((n) => (
              <li key={n.id} className="items-start fx-notifications-card">
                <span aria-hidden="true" className={n.isRead ? "fx-dot" : "fx-dot fx-dot-unread"} />
                <div className="min-0">
                  <p className="sans small strong">{n.title}</p>
                  {n.body ? <p className="fx-notifications-text-2">{n.body}</p> : null}
                  <p className="mt-1 fx-notifications-text-3">
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
