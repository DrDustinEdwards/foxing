// Club detail (auth-gated read in-process). Members get the live experience: a presence
// indicator and poll tallies that update in real time over the club WebSocket. Every
// write goes to /api/v1 and the page revalidates; live messages arrive independently so
// another member's post/vote shows up without a manual refresh.
import { useEffect, useState } from "react";
import { redirect, useRevalidator } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { useClubLive } from "~/hooks/use-club-live";
import { getAuth } from "~/lib/auth.server";
import { loadClubDetail } from "~/lib/clubs.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-detail";
import { MembershipControls, ThreadsSection } from "../components/clubs/club-sections";
import { MeetingsSection, PollsSection, ScheduleSection } from "../components/clubs/club-schedule";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/clubs/${params.slug}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const detail = await loadClubDetail(env, params.slug, session.user.id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return { ...detail, viewerId: session.user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.club?.name ?? "Club";
  return [{ title: `${name} | Foxing` }, { name: "robots", content: "noindex" }];
}

export default function ClubDetail({ loaderData }: Route.ComponentProps) {
  const { club, membership, isMember, memberCount, threads, polls, meetings, schedule, viewerId } =
    loaderData;
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
  const isModerator = membership?.role === "owner" || membership?.role === "moderator";

  // Live tallies: seed from the loader, then let the socket update them in place.
  const [liveTallies, setLiveTallies] = useState<Record<string, Record<string, number>>>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: club.id is the trigger, not an input. The route component stays mounted when the slug changes, so this drops the previous club's tallies.
  useEffect(() => {
    setLiveTallies({});
  }, [club.id]);

  const { presence, connected } = useClubLive(isMember ? club.id : null, {
    onThread: refresh,
    onNotice: refresh,
    onTally: (msg) => setLiveTallies((prev) => ({ ...prev, [msg.poll_id]: msg.tallies })),
  });

  return (
    <PageShell>
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">{club.name}</h1>
            {club.description ? (
              <p className="mt-2 max-w-2xl font-body text-secondary">{club.description}</p>
            ) : null}
            <p className="mt-2 font-ui text-sm text-tertiary">
              {memberCount} {memberCount === 1 ? "member" : "members"}
              {isMember && connected ? (
                <span className="ml-3 inline-flex items-center gap-1.5 text-brand-text">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-ui" />
                  <span aria-live="polite">{presence.length} here now</span>
                </span>
              ) : null}
            </p>
          </div>
          <MembershipControls
            clubId={club.id}
            slug={club.slug ?? ""}
            membership={membership}
            isMember={isMember}
            isCreator={club.creatorId === viewerId}
            joinCode={isModerator ? (club.joinCode ?? null) : null}
            onChange={refresh}
          />
        </div>

        {isMember ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-10">
              <ThreadsSection
                clubId={club.id}
                slug={club.slug ?? ""}
                threads={threads}
                onChange={refresh}
              />
              <PollsSection
                clubId={club.id}
                polls={polls}
                liveTallies={liveTallies}
                canModerate={isModerator}
                viewerId={viewerId}
                onChange={refresh}
              />
            </div>
            <aside className="space-y-10">
              <MeetingsSection clubId={club.id} meetings={meetings} onChange={refresh} />
              <ScheduleSection
                clubId={club.id}
                schedule={schedule}
                canModerate={isModerator}
                onChange={refresh}
              />
            </aside>
          </div>
        ) : (
          <div className="mt-10 rounded-card border border-dashed border-border-subtle bg-surface p-10 text-center">
            <p className="font-ui text-sm text-tertiary">
              Join this club to read its discussions, polls, and meetings.
            </p>
          </div>
        )}
      </Container>
    </PageShell>
  );
}
