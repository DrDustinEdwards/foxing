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
      navigate(".", { replace: true, preventScrollReset: true });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={
          following
            ? "inline-flex items-center gap-2 rounded-cover border border-border-interactive px-5 py-2.5 font-ui text-sm font-medium text-primary transition hover:bg-hover disabled:opacity-50"
            : "inline-flex items-center gap-2 rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-50 dark:text-[color:var(--section-charcoal)]"
        }
      >
        {following ? "Following" : "Follow"}
      </button>
      {error ? (
        <p role="alert" className="font-ui text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
