// Public invite landing page for /join/:code. Shows a club preview (name, member count)
// resolved in-process from the join code, then joins on click. A signed-out visitor is
// sent to sign in first and returned here. Joining is free.
import { useJoinByCode } from "@foxing/client";
import { redirect, useNavigate } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { clubsRepo, createDb } from "@foxing/core";
import { sessionUserFromRequest } from "~/lib/auth.server";
import type { Route } from "./+types/join-code";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const user = await sessionUserFromRequest(request, env);
  if (!user) throw redirect(`/login?next=/join/${params.code}`);

  const db = createDb(env.DB);
  const club = await clubsRepo.getClubByJoinCode(db, params.code);
  if (!club) throw new Response("Invite not found", { status: 404 });
  const memberCount = await clubsRepo.countActiveMembers(db, club.id);
  const membership = await clubsRepo.getMembership(db, club.id, user.id);

  return {
    code: params.code,
    club: { slug: club.slug, name: club.name, description: club.description },
    memberCount,
    alreadyMember: membership?.status === "active",
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Join ${loaderData?.club?.name ?? "a club"} | Foxing` },
    { name: "robots", content: "noindex" },
  ];
}

export default function JoinCode({ loaderData }: Route.ComponentProps) {
  const { code, club, memberCount, alreadyMember } = loaderData;
  const navigate = useNavigate();
  const { run, error, pending } = useJoinByCode();

  async function join() {
    if (await run({ code })) void navigate(`/clubs/${club.slug}`);
  }

  return (
    <PageShell>
      <Container className="cap-text" data-align="center">
        <p className="fx-join-code-caps">You have been invited to</p>
        <h1 className="mt-2 fx-join-code-title">{club.name}</h1>
        {club.description ? <p className="mt-3 fx-join-code-text">{club.description}</p> : null}
        <p className="mt-3 fx-join-code-text-2">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </p>

        {alreadyMember ? (
          <button
            type="button"
            onClick={() => void navigate(`/clubs/${club.slug}`)}
            className="cap-btn mt-8"
            data-variant="primary"
          >
            Open club
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void join()}
            disabled={pending}
            className="cap-btn mt-8"
            data-variant="primary"
          >
            {pending ? "Joining..." : "Join this club"}
          </button>
        )}
        {error ? (
          <p className="mt-3 fx-join-code-text-3" role="alert">
            {error}
          </p>
        ) : null}
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
