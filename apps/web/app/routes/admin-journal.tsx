// Admin: Journal. List every post (draft and live) with a publish/unpublish toggle and
// a link to create or edit. Reads in-process via adminRepo; the publish toggle writes to
// /api/v1/admin/journal/:id/publish with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";
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
      <div className="mb-6 items-end fx-admin-journal-row">
        <div>
          <p className="group-label">Admin</p>
          <h1 className="display-3">Journal</h1>
        </div>
        <Link to="/admin/journal/new" className="cap-btn" data-variant="primary">
          New post
        </Link>
      </div>

      <AdminCard title="Posts">
        {posts.length === 0 ? (
          <p className="meta">No posts yet. Create one above.</p>
        ) : (
          <ul className="divided">
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
      <div className="row spread">
        <div className="min-0">
          <p className="sans small strong">
            {post.title}
            {post.isPublished ? (
              <span className="badge ml-2">Live</span>
            ) : (
              <span className="badge badge-quiet ml-2">Draft</span>
            )}
            {post.featured ? <span className="ml-2 fx-admin-journal-caps">Featured</span> : null}
          </p>
          <p className="truncate meta">
            /{post.slug} · {stamp ? fmtDate.format(stamp) : "No date"}
          </p>
        </div>
        <div className="row-2 shrink-0">
          <AdminButton
            pending={pending}
            onClick={() =>
              run(
                `/journal/${post.id}/publish`,
                { body: { on: !post.isPublished } },
                "Could not update",
              )
            }
          >
            {post.isPublished ? "Unpublish" : "Publish"}
          </AdminButton>
          <Link to={`/admin/journal/${post.id}`} className="cap-btn">
            Edit
          </Link>
        </div>
      </div>
      <AdminError error={error} />
    </li>
  );
}
