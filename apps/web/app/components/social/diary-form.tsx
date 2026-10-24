// Diary entry form (create + edit). Writes POST /diary or PATCH /diary/:id through the
// shared client, which refetches the diary, profile and feed, then navigates. rating is entered in half-stars
// (1-10) via a 0.5..5 selector. Visibility drives feed emission server-side (private
// emits no event). Failed writes surface a visible error.
import { useCreateDiaryEntry, useUpdateDiaryEntry } from "@foxing/client";
import type { Visibility } from "@foxing/types";
import { useState } from "react";
import { useNavigate } from "react-router";

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
  const create = useCreateDiaryEntry();
  const update = useUpdateDiaryEntry();
  const { error, pending } = mode === "create" ? create : update;
  const [ratingHalf, setRatingHalf] = useState<number | null>(initial?.ratingHalf ?? null);
  const [review, setReview] = useState(initial?.review ?? "");
  const [spoilers, setSpoilers] = useState(initial?.containsSpoilers ?? false);
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "public");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ratingHalf,
      review: review.trim() === "" ? null : review.trim(),
      containsSpoilers: spoilers,
      visibility,
    };
    const ok =
      mode === "create"
        ? await create.run({ bookId, ...body })
        : await update.run({ id: entryId ?? "", ...body });
    if (ok) void navigate(redirectTo, { replace: true });
  }

  return (
    <form onSubmit={submit} className="stack-6">
      <p className="ui">
        Logging <span className="strong">{bookTitle}</span>
      </p>

      <fieldset className="stack-2">
        <legend className="group-label">Rating</legend>
        <div className="row-2 wrap">
          <select
            value={ratingHalf ?? ""}
            onChange={(e) => setRatingHalf(e.target.value === "" ? null : Number(e.target.value))}
            className="cap-select py-2"
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

      <label className="stack-2">
        <span className="group-label">Review</span>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={7}
          placeholder="What did you make of it?"
          className="cap-input py-2"
        />
      </label>

      <label className="row-2 ui">
        <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
        This review contains spoilers
      </label>

      <label className="stack-2">
        <span className="group-label">Who can see this</span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
          className="cap-select py-2"
        >
          <option value="public">Public - anyone, shown in followers' feeds</option>
          <option value="friends">Close friends only</option>
          <option value="private">Private - only you</option>
        </select>
      </label>

      {error ? (
        <p role="alert" className="py-2 fx-diary-form-text">
          {error}
        </p>
      ) : null}

      <div className="row">
        <button type="submit" disabled={pending} className="cap-btn" data-variant="primary">
          {pending ? "Saving..." : mode === "create" ? "Save entry" : "Save changes"}
        </button>
        <button type="button" onClick={() => navigate(redirectTo)} className="fx-diary-form-btn">
          Cancel
        </button>
      </div>
    </form>
  );
}
