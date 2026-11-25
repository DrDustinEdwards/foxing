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
