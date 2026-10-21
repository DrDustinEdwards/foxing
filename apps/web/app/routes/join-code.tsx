// Public invite landing page for /join/:code. Shows a club preview (name, member count)
// resolved in-process from the join code, then joins on click. A signed-out visitor is
// sent to sign in first and returned here. Joining is free.
import { redirect, useNavigate } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { useClubWrite } from "~/hooks/use-club-write";
import { clubsRepo, createDb } from "@foxing/core";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/join-code";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/join/${params.code}`);

  const db = createDb(env.DB);
  const club = await clubsRepo.getClubByJoinCode(db, params.code);
  if (!club) throw new Response("Invite not found", { status: 404 });
  const memberCount = await clubsRepo.countActiveMembers(db, club.id);
  const membership = await clubsRepo.getMembership(db, club.id, session.user.id);

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
  const { write, error, pending } = useClubWrite();

  async function join() {
    const r = await write(`/join/${code}`);
    if (r.ok) void navigate(`/clubs/${club.slug}`);
  }

  return (
    <PageShell>
      <Container className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-tertiary">
          You have been invited to
        </p>
        <h1 className="mt-2 font-display text-4xl">{club.name}</h1>
        {club.description ? (
          <p className="mt-3 font-body text-secondary">{club.description}</p>
        ) : null}
        <p className="mt-3 font-ui text-sm text-tertiary">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </p>

        {alreadyMember ? (
          <button
            type="button"
            onClick={() => navigate(`/clubs/${club.slug}`)}
            className="mt-8 rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand dark:text-[color:var(--section-charcoal)]"
          >
            Open club
          </button>
        ) : (
          <button
            type="button"
            onClick={join}
            disabled={pending}
            className="mt-8 rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
          >
            {pending ? "Joining..." : "Join this club"}
          </button>
        )}
        {error ? (
          <p className="mt-3 font-ui text-sm text-danger-text" role="alert">
            {error}
          </p>
        ) : null}
      </Container>
    </PageShell>
  );
}
