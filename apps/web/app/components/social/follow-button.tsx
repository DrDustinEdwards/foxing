import { SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";
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
      <Button to={SIGN_IN_PATH} variant="secondary">
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
