// Diary entry form (create + edit). Writes POST /diary or PATCH /diary/:id through the
// shared client, which refetches the diary, profile and feed, then navigates. rating is entered in half-stars
// (1-10) via a 0.5..5 selector. Visibility drives feed emission server-side (private
// emits no event). Failed writes surface a visible error.
import { useCreateDiaryEntry, useUpdateDiaryEntry } from "@foxing/client";
import type { Visibility } from "@foxing/types";
import { RatingInput } from "capsomer/react/rating";
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
    <form onSubmit={(e) => void submit(e)} className="cap-stack" data-gap="6">
      <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
        Logging{" "}
        <span className="cap-text" data-tone="ink" data-weight="strong">
          {bookTitle}
        </span>
      </p>

      <RatingInput
        name="ratingHalf"
        label="Rating"
        value={(ratingHalf ?? 0) / 2}
        onChange={(v) => setRatingHalf(v === 0 ? null : Math.round(v * 2))}
      />

      <label className="cap-stack" data-gap="3">
        <span className="group-label">Review</span>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={7}
          placeholder="What did you make of it?"
          className="cap-input py-2"
        />
      </label>

      <label
        className="cap-text cap-cluster"
        data-size="small"
        data-tone="muted"
        data-face="ui"
        data-gap="3"
      >
        <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
        This review contains spoilers
      </label>

      <label className="cap-stack" data-gap="3">
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

      <div className="cap-cluster" data-gap="4">
        <button type="submit" disabled={pending} className="cap-btn" data-variant="primary">
          {pending ? "Saving..." : mode === "create" ? "Save entry" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => void navigate(redirectTo)}
          className="fx-diary-form-btn"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
