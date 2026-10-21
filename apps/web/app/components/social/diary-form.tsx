// Diary entry form (create + edit). Writes POST /diary or PATCH /diary/:id from the
// browser, then navigates to the user's profile. rating is entered in half-stars
// (1-10) via a 0.5..5 selector. Visibility drives feed emission server-side (private
// emits no event). Failed writes surface a visible error.
import { useState } from "react";
import { useNavigate } from "react-router";
import { useApiWrite } from "~/hooks/use-api-write";

type Visibility = "private" | "friends" | "public";

export function DiaryForm({
  mode,
  entryId,
  bookId,
  bookTitle,
  redirectTo,
  initial,
}: {
  mode: "create" | "edit";
  entryId?: string;
  bookId: string;
  bookTitle: string;
  redirectTo: string;
  initial?: {
    ratingHalf: number | null;
    review: string | null;
    containsSpoilers: boolean;
    visibility: Visibility;
  };
}) {
  const navigate = useNavigate();
  const { write, error, pending } = useApiWrite();
  const [ratingHalf, setRatingHalf] = useState<number | null>(initial?.ratingHalf ?? null);
  const [review, setReview] = useState(initial?.review ?? "");
  const [spoilers, setSpoilers] = useState(initial?.containsSpoilers ?? false);
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "public");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...(mode === "create" ? { bookId } : {}),
      ratingHalf,
      review: review.trim() === "" ? null : review.trim(),
      containsSpoilers: spoilers,
      visibility,
    };
    const res =
      mode === "create"
        ? await write("/diary", { method: "POST", body })
        : await write(`/diary/${entryId}`, { method: "PATCH", body });
    if (res.ok) void navigate(redirectTo, { replace: true });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="font-ui text-sm text-secondary">
        Logging <span className="font-medium text-primary">{bookTitle}</span>
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Rating
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ratingHalf ?? ""}
            onChange={(e) => setRatingHalf(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-cover border border-border-interactive bg-surface px-3 py-2 font-ui text-sm text-primary"
          >
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
              <option key={h} value={h}>
                {(h / 2).toFixed(1)} stars
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Review
        </span>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={7}
          placeholder="What did you make of it?"
          className="rounded-card border border-border-interactive bg-surface px-3 py-2 font-body text-primary"
        />
      </label>

      <label className="flex items-center gap-2 font-ui text-sm text-secondary">
        <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
        This review contains spoilers
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Who can see this
        </span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
          className="rounded-cover border border-border-interactive bg-surface px-3 py-2 font-ui text-sm text-primary"
        >
          <option value="public">Public - anyone, shown in followers' feeds</option>
          <option value="friends">Close friends only</option>
          <option value="private">Private - only you</option>
        </select>
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
          disabled={pending}
          className="rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
        >
          {pending ? "Saving..." : mode === "create" ? "Save entry" : "Save changes"}
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
