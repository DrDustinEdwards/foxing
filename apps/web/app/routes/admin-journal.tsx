// Admin: Journal. List every post (draft and live) with a publish/unpublish toggle and
// a link to create or edit. Reads in-process via adminRepo; the publish toggle writes to
// /api/v1/admin/journal/:id/publish with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { Link, useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, useAdminAction } from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-journal";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const posts = await adminRepo.listJournalAdmin(createDb(env.DB));
  return { posts };
}

export function meta() {
  return [{ title: "Admin · Journal | Foxing" }, { name: "robots", content: "noindex" }];
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default function AdminJournal({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
          <h1 className="font-display text-3xl text-primary">Journal</h1>
        </div>
        <Link
          to="/admin/journal/new"
          className="rounded-md bg-brand-ui px-4 py-2 font-ui text-sm text-on-brand transition hover:opacity-90"
        >
          New post
        </Link>
      </div>

      <AdminCard title="Posts">
        {posts.length === 0 ? (
          <p className="font-ui text-sm text-tertiary">No posts yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {posts.map((p) => (
              <JournalRow key={p.id} post={p} onDone={reload} />
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminShell>
  );
}

function JournalRow({
  post,
  onDone,
}: {
  post: Route.ComponentProps["loaderData"]["posts"][number];
  onDone: () => void;
}) {
  const { pending, error, run } = useAdminAction({ onDone });
  const stamp = post.publishedAt ?? post.updatedAt;

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-primary">
            {post.title}
            {post.isPublished ? (
              <span className="ml-2 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-brand-subtle-text">
                Live
              </span>
            ) : (
              <span className="ml-2 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-tertiary">
                Draft
              </span>
            )}
            {post.featured ? (
              <span className="ml-2 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-secondary">
                Featured
              </span>
            ) : null}
          </p>
          <p className="truncate font-ui text-sm text-tertiary">
            /{post.slug} · {stamp ? fmtDate.format(stamp) : "No date"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AdminButton
            pending={pending}
            onClick={() =>
              run(`/journal/${post.id}/publish`, { body: { on: !post.isPublished } }, "Could not update")
            }
          >
            {post.isPublished ? "Unpublish" : "Publish"}
          </AdminButton>
          <Link
            to={`/admin/journal/${post.id}`}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm transition hover:bg-hover"
          >
            Edit
          </Link>
        </div>
      </div>
      <AdminError error={error} />
    </li>
  );
}
