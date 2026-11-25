import { useClubLive, useClubPage } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/club-detail";
import { MembershipControls, ThreadsSection } from "../components/clubs/club-sections";
import { MeetingsSection, PollsSection, ScheduleSection } from "../components/clubs/club-schedule";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const page = await views.clubPage(createDb(env.DB), params.slug, user.id);
  if (!page) throw new Response("Not found", { status: 404 });
  return { page, viewerId: user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.page.club.name ?? "Club";
  return noindexMeta(`${name} | Foxing`);
}

export default function ClubDetail({ loaderData, params }: Route.ComponentProps) {
  const { viewerId } = loaderData;
  const { club, membership, isMember, isModerator, threads, polls, meetings, schedule } =
    useClubPage(params.slug, loaderData.page).data;
  const { presence, connected } = useClubLive(isMember ? club.id : null);

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <div className="items-start fx-club-detail-row">
          <div className="cap-stack" data-gap="3">
            <h1 className="cap-title" data-size="1">
              {club.name}
            </h1>
            {club.description ? <p className="fx-club-detail-text">{club.description}</p> : null}
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
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
          <div className="fx-club-detail-grid">
            <div className="cap-stack" data-gap="7">
              <ThreadsSection clubId={club.id} slug={club.slug ?? ""} threads={threads} />
              <PollsSection
                clubId={club.id}
                polls={polls}
                canModerate={isModerator}
                viewerId={viewerId}
              />
            </div>
            <aside className="cap-stack" data-gap="7">
              <MeetingsSection clubId={club.id} meetings={meetings} />
              <ScheduleSection clubId={club.id} schedule={schedule} canModerate={isModerator} />
            </aside>
          </div>
        ) : (
          <EmptyState title="Join to see discussions." />
        )}
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };

export { ErrorBoundary } from "~/components/route-error";
