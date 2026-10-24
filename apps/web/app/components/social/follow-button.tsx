// Follow / unfollow control. Writes PUT/DELETE /follows/:userId through the shared
// client, which patches the profile and people screens in place. Anonymous visitors get a sign-in link instead. A failed
// write shows a visible error (never silent).
import { useFollow } from "@foxing/client";
import { Button } from "~/components/ui";

export function FollowButton({
  userId,
  following,
  signedIn,
}: {
  userId: string;
  following: boolean;
  signedIn: boolean;
}) {
  const { fire, error, pending } = useFollow();

  if (!signedIn) {
    return (
      <Button to="/login" variant="secondary">
        Sign in to follow
      </Button>
    );
  }

  return (
    <div className="items-start fx-follow-button-stack">
      <button
        type="button"
        onClick={() => fire({ userId, on: !following })}
        disabled={pending}
        className="cap-btn"
        data-variant={following ? undefined : "primary"}
      >
        {following ? "Following" : "Follow"}
      </button>
      {error ? (
        <p role="alert" className="fx-follow-button-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
