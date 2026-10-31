// Club detail (auth-gated read in-process). The loader's page seeds the shared cache;
// every write goes to /api/v1, patches the cached page and refetches only it. Members
// get the live experience: a presence indicator, and another member's thread or vote
// shows up over the club WebSocket without a reload.
import { useClubLive, useClubPage } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { redirect } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-detail";
import { MembershipControls, ThreadsSection } from "../components/clubs/club-sections";
import { MeetingsSection, PollsSection, ScheduleSection } from "../components/clubs/club-schedule";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/clubs/${params.slug}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const page = await views.clubPage(createDb(env.DB), params.slug, session.user.id);
  if (!page) throw new Response("Not found", { status: 404 });
  return { page, viewerId: session.user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.page.club.name ?? "Club";
  return [{ title: `${name} | Foxing` }, { name: "robots", content: "noindex" }];
}

export default function ClubDetail({ loaderData, params }: Route.ComponentProps) {
  const { viewerId } = loaderData;
  const { club, membership, isMember, isModerator, threads, polls, meetings, schedule } =
    useClubPage(params.slug, loaderData.page).data;
  const { presence, connected } = useClubLive(isMember ? club.id : null);

  return (
    <PageShell>
      <Container>
        <div className="items-start fx-club-detail-row">
          <div>
            <h1 className="display-4">{club.name}</h1>
            {club.description ? (
              <p className="mt-2 fx-club-detail-text">{club.description}</p>
            ) : null}
            <p className="mt-2 meta">
              {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
              {isMember && connected ? (
                <span className="fx-club-detail-label">
                  <span aria-hidden="true" className="fx-club-detail-label-2" />
                  <span aria-live="polite">{presence.length} here now</span>
                </span>
              ) : null}
            </p>
          </div>
          <MembershipControls
            clubId={club.id}
            membership={membership}
            isMember={isMember}
            isCreator={club.creatorId === viewerId}
            joinCode={club.joinCode}
          />
        </div>

        {isMember ? (
          <div className="mt-10 fx-club-detail-grid">
            <div className="fx-club-detail-box">
              <ThreadsSection clubId={club.id} slug={club.slug ?? ""} threads={threads} />
              <PollsSection
                clubId={club.id}
                polls={polls}
                canModerate={isModerator}
                viewerId={viewerId}
              />
            </div>
            <aside className="fx-club-detail-box">
              <MeetingsSection clubId={club.id} meetings={meetings} />
              <ScheduleSection clubId={club.id} schedule={schedule} canModerate={isModerator} />
            </aside>
          </div>
        ) : (
          <div className="mt-10 text-center fx-club-detail-card">
            <p className="meta">Join this club to read its discussions, polls, and meetings.</p>
          </div>
        )}
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
