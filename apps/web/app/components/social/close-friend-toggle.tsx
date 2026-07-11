// Close-friends toggle (Plus). Adds/removes a user from the viewer's close-friends list
// via PUT/DELETE /close-friends/:userId. This list is the audience for the viewer's
// friends-only diary entries and activity. Free users see the Plus gate (a 403
// plus_required from the API also surfaces its message). Failed writes show a visible
// error.
import { useState } from "react";
import { useApiWrite } from "~/hooks/use-api-write";

export function CloseFriendToggle({
  userId,
  initialClose,
  isPlus,
}: {
  userId: string;
  initialClose: boolean;
  isPlus: boolean;
}) {
  const { write, error, pending } = useApiWrite();
  const [isClose, setIsClose] = useState(initialClose);

  async function toggle() {
    const next = !isClose;
    const res = await write(`/close-friends/${userId}`, { method: next ? "PUT" : "DELETE" });
    if (res.ok) setIsClose(next);
  }

  if (!isPlus && !isClose) {
    return (
      <span className="font-mono text-[0.6rem] uppercase tracking-wide text-tertiary">
        Close friends is Plus
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isClose}
        className={
          isClose
            ? "rounded-full bg-brand-subtle px-3 py-1 font-ui text-xs text-brand-subtle-text transition hover:bg-selected disabled:opacity-50"
            : "rounded-full border border-border-subtle px-3 py-1 font-ui text-xs text-secondary transition hover:border-border-interactive disabled:opacity-50"
        }
      >
        {isClose ? "Close friend" : "Add close friend"}
      </button>
      {error ? (
        <span role="alert" className="font-ui text-[0.65rem] text-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
