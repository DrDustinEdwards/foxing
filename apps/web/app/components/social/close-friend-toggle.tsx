// Close-friends toggle. Adds/removes a user from the viewer's close-friends list via
// PUT/DELETE /close-friends/:userId. This list is the audience for the viewer's
// friends-only diary entries, activity, and shared annotations. It is a free social /
// privacy control (not a Plus feature). Failed writes show a visible error.
import { useCloseFriend } from "@foxing/client";

export function CloseFriendToggle({ userId, isClose }: { userId: string; isClose: boolean }) {
  const { fire, error, pending } = useCloseFriend();

  return (
    <span className="items-end fx-close-friend-toggle-label">
      <button
        type="button"
        onClick={() => fire({ userId, on: !isClose })}
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
