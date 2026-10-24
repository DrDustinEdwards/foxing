// Admin: Content. Create site announcements (banner, home, or journal placement) and
// manage the existing set: activate/deactivate and delete. Reads announcements in-process;
// writes to /api/v1/admin/announcements with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-content";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const announcements = await adminRepo.listAnnouncements(createDb(env.DB));
  return { announcements };
}

export function meta() {
  return [{ title: "Admin · Content | Foxing" }, { name: "robots", content: "noindex" }];
}

const PLACEMENTS = ["banner", "home", "journal"] as const;

const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function AdminContent({ loaderData }: Route.ComponentProps) {
  const { announcements } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Content</h1>
      </div>

      <div className="stack-6">
        <CreateAnnouncement onDone={reload} />
        <AdminCard title="Announcements">
          {announcements.length === 0 ? (
            <p className="meta">No announcements yet. Create one above.</p>
          ) : (
            <ul className="divided">
              {announcements.map((a) => (
                <AnnouncementRow key={a.id} row={a} onDone={reload} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function CreateAnnouncement({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]>("banner");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isActive, setIsActive] = useState(false);
  const { pending, error, setError, run } = useAdminAction({ onDone });

  async function create() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give the announcement a title.");
      return;
    }
    const result = await run(
      "/announcements",
      {
        body: {
          title: cleanTitle,
          body: body.trim() || undefined,
          placement,
          linkUrl: linkUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined,
          isActive,
        },
      },
      "Could not create the announcement",
    );
    if (result) {
      setTitle("");
      setBody("");
      setPlacement("banner");
      setLinkUrl("");
      setLinkLabel("");
      setIsActive(false);
    }
  }

  return (
    <AdminCard title="New announcement">
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
          <span className="fx-label">Body (optional)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="fx-label">Placement</span>
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as (typeof PLACEMENTS)[number])}
            className={adminInputClass}
          >
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="fx-admin-content-grid">
          <label className="block">
            <span className="fx-label">Link URL (optional)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className={adminInputClass}
            />
          </label>
          <label className="block">
            <span className="fx-label">Link label (optional)</span>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              className={adminInputClass}
            />
          </label>
        </div>
        <label className="row-2 ui">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active immediately
        </label>
        <AdminButton variant="primary" pending={pending} onClick={create}>
          {pending ? "Creating..." : "Create announcement"}
        </AdminButton>
        <AdminError error={error} />
      </div>
    </AdminCard>
  );
}

function AnnouncementRow({
  row,
  onDone,
}: {
  row: Route.ComponentProps["loaderData"]["announcements"][number];
  onDone: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { pending, error, run } = useAdminAction({ onDone });

  return (
    <li className="py-3">
      <div className="row spread">
        <div className="min-0">
          <p className="sans small strong">
            {row.title}
            {row.isActive ? (
              <span className="badge ml-2">Active</span>
            ) : (
              <span className="badge badge-quiet ml-2">Inactive</span>
            )}
          </p>
          <p className="truncate fx-admin-content-text">
            {row.placement} · {fmt.format(row.createdAt)}
          </p>
        </div>
        <div className="row-2 shrink-0">
          <AdminButton
            pending={pending}
            onClick={() =>
              run(
                `/announcements/${row.id}`,
                { method: "PATCH", body: { isActive: !row.isActive } },
                "Could not update",
              )
            }
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </AdminButton>
          {confirmingDelete ? (
            <AdminButton
              variant="danger"
              pending={pending}
              onClick={() =>
                run(`/announcements/${row.id}`, { method: "DELETE" }, "Could not delete")
              }
            >
              Confirm delete
            </AdminButton>
          ) : (
            <AdminButton variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </AdminButton>
          )}
        </div>
      </div>
      <AdminError error={error} />
    </li>
  );
}
