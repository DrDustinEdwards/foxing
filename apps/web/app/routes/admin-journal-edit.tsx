// Admin: Edit journal post. Loads the full row in-process, prefills the form, and PATCHes
// /api/v1/admin/journal/:id on save. Publish/unpublish is a separate write to
// /api/v1/admin/journal/:id/publish; the route revalidates so the badge reflects the state.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-journal-edit";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const post = await adminRepo.getJournalById(createDb(env.DB), params.id);
  if (!post) throw new Response("Not found", { status: 404 });
  return { post };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `Admin · Edit ${loaderData.post.title} | Foxing`
        : "Admin · Edit post | Foxing",
    },
    { name: "robots", content: "noindex" },
  ];
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function AdminJournalEdit({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const revalidator = useRevalidator();
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [excerpt, setExcerpt] = useState(post.excerpt ?? "");
  const [content, setContent] = useState(post.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(post.coverImageUrl ?? "");
  const [coverImageAlt, setCoverImageAlt] = useState(post.coverImageAlt ?? "");
  const [tags, setTags] = useState(post.tags?.join(", ") ?? "");
  const [featured, setFeatured] = useState(post.featured);
  const save = useAdminAction();
  const publishAction = useAdminAction({ onDone: () => revalidator.revalidate() });

  async function onSave() {
    await save.run(
      `/journal/${post.id}`,
      {
        method: "PATCH",
        body: {
          title: title.trim(),
          slug: slug.trim(),
          content,
          excerpt: excerpt.trim() || undefined,
          coverImageUrl: coverImageUrl.trim() || undefined,
          coverImageAlt: coverImageAlt.trim() || undefined,
          tags: parseTags(tags),
          featured,
        },
      },
      "Could not save the post",
    );
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <Link to="/admin/journal" className="fx-admin-journal-edit-link">
          Back to journal
        </Link>
        <h1 className="mt-2 fx-admin-journal-edit-title">
          Edit post
          {post.isPublished ? (
            <span className="fx-admin-journal-edit-caps">Live</span>
          ) : (
            <span className="fx-admin-journal-edit-caps-2">Draft</span>
          )}
        </h1>
      </div>

      <div className="stack-6">
        <AdminCard
          title="Visibility"
          action={
            <AdminButton
              pending={publishAction.pending}
              onClick={() =>
                publishAction.run(
                  `/journal/${post.id}/publish`,
                  { body: { on: !post.isPublished } },
                  "Could not update",
                )
              }
            >
              {post.isPublished ? "Unpublish" : "Publish"}
            </AdminButton>
          }
        >
          <p className="meta">
            {post.isPublished ? "This post is live." : "This post is a draft."}
          </p>
          <AdminError error={publishAction.error} />
        </AdminCard>

        <AdminCard title="Content">
          <div className="stack">
            <label className="block">
              <span className="fx-label">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="fx-label">Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={adminInputClass}
              />
              <span className="mt-1 block fx-admin-journal-edit-label">
                Lowercase letters, numbers, and hyphens only.
              </span>
            </label>
            <label className="block">
              <span className="fx-label">Excerpt (optional)</span>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="fx-label">Content</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className={`${adminInputClass} mono`}
              />
            </label>
            <label className="block">
              <span className="fx-label">Cover image URL (optional)</span>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="fx-label">Cover image alt (optional)</span>
              <input
                value={coverImageAlt}
                onChange={(e) => setCoverImageAlt(e.target.value)}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="fx-label">Tags (comma separated)</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={adminInputClass}
              />
            </label>
            <label className="row-2 ui">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              Featured
            </label>
            <AdminButton variant="primary" pending={save.pending} onClick={onSave}>
              {save.pending ? "Saving..." : "Save"}
            </AdminButton>
            <AdminError error={save.error} />
          </div>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
