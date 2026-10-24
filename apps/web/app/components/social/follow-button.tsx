// Follow / unfollow control. Writes PUT/DELETE /follows/:userId from the browser and
// revalidates the profile. Anonymous visitors get a sign-in link instead. A failed
// write shows a visible error (never silent).
import { useNavigate } from "react-router";
import { useState } from "react";
import { useApiWrite } from "~/hooks/use-api-write";
import { Button } from "~/components/ui";

export function FollowButton({
  userId,
  initialFollowing,
  signedIn,
}: {
  userId: string;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const navigate = useNavigate();
  const { write, error, pending } = useApiWrite();
  const [following, setFollowing] = useState(initialFollowing);

  if (!signedIn) {
    return (
      <Button to="/login" variant="secondary">
        Sign in to follow
      </Button>
    );
  }

  async function toggle() {
    const next = !following;
    const res = await write(`/follows/${userId}`, { method: next ? "PUT" : "DELETE" });
    if (res.ok) {
      setFollowing(next);
      void navigate(".", { replace: true, preventScrollReset: true });
    }
  }

  return (
    <div className="items-start fx-follow-button-stack">
      <button
        type="button"
        onClick={toggle}
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
