// Shelf-status control for a book. The write goes through @foxing/client's
// useSetBookStatus, which patches the library and this book's cached state at once
// and rolls back on failure, so the page never reloads. Anonymous readers get a
// sign-in link instead. Used on /library, the book page and find-next-book.
import { useSetBookStatus } from "@foxing/client";
import type { BookRef, ShelfStatus } from "@foxing/types";
import { useState } from "react";
import { Select } from "capsomer/react/select";
import { ButtonLink } from "capsomer/react/link";

const STATUSES = [
  { value: "want", label: "Want to read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
] as const;

export type { ShelfStatus };

export function BookStatusControl({
  book,
  currentStatus,
  signedIn,
  loginHref,
}: {
  book: BookRef;
  currentStatus: ShelfStatus | null;
  signedIn: boolean;
  loginHref: string;
}) {
  const setStatus = useSetBookStatus();
  // Follows the cache when the page has one; otherwise remembers the last pick.
  const [status, setLocal] = useState<ShelfStatus | null>(currentStatus);
  const [followed, setFollowed] = useState(currentStatus);
  if (currentStatus !== followed) {
    setFollowed(currentStatus);
    setLocal(currentStatus);
  }

  if (!signedIn) {
    return <ButtonLink to={loginHref}>Sign in to track</ButtonLink>;
  }

  async function apply(next: ShelfStatus | null) {
    const before = status;
    setLocal(next);
    const ok = await setStatus.run({ bookId: book.id, status: next, book });
    if (!ok) setLocal(before);
  }

  return (
    <div className="cap-stack fx-book-status-control-box" data-gap="3">
      <label className="cap-field">
        <span className="cap-sr-only">Reading status</span>
        <Select
          native
          value={status ?? ""}
          disabled={setStatus.pending}
          onChange={(e) =>
            void apply(
              e.target.value === "" || e.target.value === "remove"
                ? null
                : (e.target.value as ShelfStatus),
            )
          }
          options={[
            { value: "", label: "Add to library" },
            ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
            ...(status ? [{ value: "remove", label: "Remove from library" }] : []),
          ]}
        />
      </label>
      {setStatus.pending ? (
        <p className="fx-book-status-control-text" role="status">
          Saving...
        </p>
      ) : null}
      {setStatus.error ? (
        <p className="fx-book-status-control-text-2" role="alert">
          {setStatus.error}
        </p>
      ) : null}
    </div>
  );
}
