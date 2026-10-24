// Admin: New journal post. Writes to /api/v1/admin/journal from the browser and, on
// success, navigates to the editor for the new post. The API validates slug against
// ^[a-z0-9-]+$; tags are entered comma-separated and split into a string array.
import { useState } from "react";
import { useNavigate } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-journal-new";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  return {};
}

export function meta() {
  return [{ title: "Admin · New post | Foxing" }, { name: "robots", content: "noindex" }];
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function AdminJournalNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [tags, setTags] = useState("");
  const [featured, setFeatured] = useState(false);
  const [publish, setPublish] = useState(false);
  const { pending, error, run } = useAdminAction();

  async function create() {
    const result = await run(
      "/journal",
      {
        body: {
          title: title.trim(),
          slug: slug.trim(),
          content,
          excerpt: excerpt.trim() || undefined,
          coverImageUrl: coverImageUrl.trim() || undefined,
          coverImageAlt: coverImageAlt.trim() || undefined,
          tags: parseTags(tags),
          featured,
          isPublished: publish,
        },
      },
      "Could not create the post",
    );
    const id = (result?.body as { id?: string } | null)?.id;
    if (id) void navigate(`/admin/journal/${id}`);
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">New post</h1>
      </div>

      <AdminCard>
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
            <span className="mt-1 block fx-admin-journal-new-label">
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
          <label className="row-2 ui">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Publish immediately
          </label>
          <AdminButton variant="primary" pending={pending} onClick={create}>
            {pending ? "Creating..." : "Create post"}
          </AdminButton>
          <AdminError error={error} />
        </div>
      </AdminCard>
    </AdminShell>
  );
}
