// Reading-list form (create + edit). Writes POST /lists or PATCH /lists/:id through the
// shared client, then navigates. A public list emits a list_created feed event server-side. Failed writes
// surface a visible error.
import { useCreateList, useUpdateList } from "@foxing/client";
import { useState } from "react";
import { useNavigate } from "react-router";

export function ListForm({
  mode,
  listId,
  redirectTo,
  initial,
}: {
  mode: "create" | "edit";
  listId?: string;
  redirectTo: string;
  initial?: { title: string; description: string | null; isPublic: boolean };
}) {
  const navigate = useNavigate();
  const create = useCreateList();
  const update = useUpdateList();
  const { error, pending } = mode === "create" ? create : update;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      isPublic,
    };
    if (mode === "create") {
      const r = await create.run(body);
      if (r) void navigate(`/lists/${r.list.id}`, { replace: true });
    } else if (await update.run({ id: listId ?? "", ...body })) {
      void navigate(redirectTo, { replace: true });
    }
  }

  return (
    <form onSubmit={submit} className="stack-6">
      <label className="stack-2">
        <span className="group-label">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Books that broke my heart"
          className="cap-input py-2"
        />
      </label>

      <label className="stack-2">
        <span className="group-label">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="cap-input py-2"
        />
      </label>

      <label className="row-2 ui">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Make this list public
      </label>

      {error ? (
        <p role="alert" className="py-2 fx-list-form-text">
          {error}
        </p>
      ) : null}

      <div className="row">
        <button
          type="submit"
          disabled={pending || title.trim() === ""}
          className="cap-btn"
          data-variant="primary"
        >
          {pending ? "Saving..." : mode === "create" ? "Create list" : "Save changes"}
        </button>
        <button type="button" onClick={() => navigate(redirectTo)} className="fx-list-form-btn">
          Cancel
        </button>
      </div>
    </form>
  );
}
