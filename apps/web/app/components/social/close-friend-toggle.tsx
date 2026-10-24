// Close-friends toggle. Adds/removes a user from the viewer's close-friends list via
// PUT/DELETE /close-friends/:userId. This list is the audience for the viewer's
// friends-only diary entries, activity, and shared annotations. It is a free social /
// privacy control (not a Plus feature). Failed writes show a visible error.
import { useState } from "react";
import { useApiWrite } from "~/hooks/use-api-write";

export function CloseFriendToggle({
  userId,
  initialClose,
}: {
  userId: string;
  initialClose: boolean;
}) {
  const { write, error, pending } = useApiWrite();
  const [isClose, setIsClose] = useState(initialClose);

  async function toggle() {
    const next = !isClose;
    const res = await write(`/close-friends/${userId}`, { method: next ? "PUT" : "DELETE" });
    if (res.ok) setIsClose(next);
  }

  return (
    <span className="items-end fx-close-friend-toggle-label">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isClose}
        className="cap-chip"
      >
        {isClose ? "Close friend" : "Add close friend"}
      </button>
      {error ? (
        <span role="alert" className="fx-close-friend-toggle-label-2">
          {error}
        </span>
      ) : null}
    </span>
  );
}
