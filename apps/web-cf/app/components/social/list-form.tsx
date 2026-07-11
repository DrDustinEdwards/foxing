// Reading-list form (create + edit). Writes POST /lists or PATCH /lists/:id, then
// navigates. A public list emits a list_created feed event server-side. Failed writes
// surface a visible error.
import { useState } from "react";
import { useNavigate } from "react-router";
import { useApiWrite } from "~/hooks/use-api-write";

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
  const { write, error, pending } = useApiWrite();
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
    const res =
      mode === "create"
        ? await write("/lists", { method: "POST", body })
        : await write(`/lists/${listId}`, { method: "PATCH", body });
    if (res.ok) {
      const created = (res.data as { list?: { id: string } } | null)?.list;
      navigate(mode === "create" && created ? `/lists/${created.id}` : redirectTo, {
        replace: true,
      });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Books that broke my heart"
          className="rounded-cover border border-border-interactive bg-surface px-3 py-2 font-ui text-primary"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-card border border-border-interactive bg-surface px-3 py-2 font-body text-primary"
        />
      </label>

      <label className="flex items-center gap-2 font-ui text-sm text-secondary">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Make this list public
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/50 bg-danger-subtle px-3 py-2 font-ui text-sm text-danger-text"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || title.trim() === ""}
          className="rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
        >
          {pending ? "Saving..." : mode === "create" ? "Create list" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => navigate(redirectTo)}
          className="font-ui text-sm text-secondary hover:text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
