// Public profile at /u/:username. Visibility-aware: the loader resolves what the viewer
// may see entirely in core (socialDomain.visibleVisibilitiesFor) and never trusts the
// client. Shows identity, follow control, recent diary, lists, and activity. Anonymous
// visitors can view public profiles; a non-public profile 404s for everyone but its
// owner.
import { thing } from "@drdustinedwards/site-helpers/schema";
import { useProfilePage } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { ButtonLink, Link } from "capsomer/react/link";
import { Rating } from "capsomer/react/rating";
import "capsomer/rating.css";
import { CoverPicture } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";
import { FollowButton } from "~/components/social/follow-button";
import { Avatar, Container, EmptyState, TagPill } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { sessionUserFromRequest } from "~/lib/auth.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { absoluteUrl, buildMeta, noindexMeta } from "~/lib/seo";
import type { Route } from "./+types/u-profile";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const user = await sessionUserFromRequest(request, env);
  const viewerId = user?.id ?? null;
  const page = await views.profilePage(createDb(env.DB), params.username, viewerId);
  if (!page) throw new Response("Not found", { status: 404 });
  return { page, signedIn: !!viewerId };
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  const data = loaderData?.page;
  if (!data) return noindexMeta("Reader | Foxing");
  const { username, displayName, avatarUrl } = data.profile;
  const name = displayName ?? username;
  const bio = data.isPrivate ? null : data.profile.bio;
  return [
    ...buildMeta({
      title: name,
      description: bio ?? `${name} (@${username}) on Foxing: reading diary, lists and highlights.`,
      pathname: location.pathname,
      type: "profile",
      noindex: data.isPrivate,
      pageType: "ProfilePage",
    }),
    ...(data.isPrivate
      ? []
      : [
          jsonLd(
            thing("Person", {
              name,
              alternateName: `@${username}`,
              url: absoluteUrl(`/u/${username}`),
              image: avatarUrl,
              description: bio,
            }),
          ),
        ]),
  ];
}

// The current calendar year, for the "year in reading" recap link. Computed at
// render (module scope would freeze it into the build).
function currentYear(): number {
  return new Date().getUTCFullYear();
}

function activityLabel(type: string, data: Record<string, unknown>): string {
  const title = typeof data.title === "string" ? data.title : "a book";
  switch (type) {
    case "finished_book":
      return `Finished ${title}`;
    case "started_book":
      return `Started reading ${title}`;
    case "reviewed":
      return `Reviewed ${title}`;
    case "rated":
      return `Rated ${title}`;
    case "highlighted":
      return `Highlighted a passage in ${title}`;
    case "joined_club":
      return `Joined a club`;
    case "list_created":
      return `Created a list${typeof data.title === "string" ? `: ${data.title}` : ""}`;
    default:
      return type.replace(/_/g, " ");
  }
}

export default function UProfile({ loaderData, params }: Route.ComponentProps) {
  const { signedIn } = loaderData;
  const page = useProfilePage(params.username, loaderData.page).data;
  if (page.isPrivate) {
    return <PrivateProfile profile={page.profile} />;
  }
  const {
    profile,
    isOwner,
    isFollowing,
    viewerHasAsCloseFriend,
    followerCount,
    followingCount,
    booksRead,
    highlightCount,
    favorites,
    publicShelves,
    finishedBooks,
    publicHighlights,
    diary,
    lists,
    activity,
    currentlyReading,
  } = page;
  const name = profile.displayName ?? profile.username;

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="8">
        <header className="items-start fx-u-profile-stack">
          <div className="items-start fx-u-profile-row">
            <Avatar src={profile.avatarUrl} name={name} size="lg" />
            <div className="cap-shrink">
              <h1 className="fx-u-profile-title">{name}</h1>
              <p className="mt-1 fx-u-profile-text">@{profile.username}</p>
              {profile.bio ? <p className="mt-3 fx-u-profile-text-2">{profile.bio}</p> : null}
              <dl className="mt-4 fx-u-profile-stats">
                <StatTile label="Books read" value={booksRead} />
                <StatTile label="Highlights" value={highlightCount} />
                <StatTile label="Followers" value={followerCount} />
                <StatTile label="Following" value={followingCount} />
              </dl>
              {profile.favoriteGenres.length > 0 ? (
                <div className="mt-3 fx-u-profile-row-2">
                  {profile.favoriteGenres.slice(0, 6).map((g) => (
                    <TagPill key={g}>{g}</TagPill>
                  ))}
                </div>
              ) : null}
              <Link
                to={isOwner ? "/year" : `/u/${profile.username}/recap/${currentYear()}`}
                className="mt-3 fx-u-profile-link"
              >
                {currentYear()} in reading
              </Link>
            </div>
          </div>
          {isOwner ? (
            <ButtonLink to="/me">Edit profile</ButtonLink>
          ) : (
            <div className="items-end fx-u-profile-stack-2">
              <FollowButton userId={profile.id} following={isFollowing} signedIn={signedIn} />
              {signedIn ? (
                <CloseFriendToggle userId={profile.id} isClose={viewerHasAsCloseFriend} />
              ) : null}
            </div>
          )}
        </header>

        {favorites.length > 0 ? (
          <section className="cap-stack">
            <h2 className="cap-title" data-size="3">
              Favorite books
            </h2>
            <ProfileCovers books={favorites} />
          </section>
        ) : null}

        {currentlyReading.length > 0 ? (
          <section className="cap-stack">
            <h2 className="cap-title" data-size="3">
              Currently reading
            </h2>
            <ul className="fx-u-profile-row-3">
              {currentlyReading.map((b) => (
                <li key={b.bookId} className="fx-u-profile-item">
                  <Link to={`/books/${b.slug}`} className="block">
                    <span className="block fx-u-profile-label-2">
                      {b.coverUrl ? (
                        <CoverPicture
                          src={b.coverUrl}
                          alt=""
                          sizes="128px"
                          className="fx-u-profile-img"
                        />
                      ) : (
                        <span
                          className="cap-text justify-center fx-u-profile-label-3"
                          data-align="center"
                        >
                          {b.title}
                        </span>
                      )}
                    </span>
                    <span className="cap-clamp block fx-u-profile-label-4" data-lines="1">
                      {b.title}
                    </span>
                    <span className="cap-clamp block fx-u-profile-label-5" data-lines="1">
                      {Math.round(b.progressPct)}% read
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {finishedBooks.length > 0 ? (
          <section className="cap-stack">
            <div className="cap-spread" data-gap="4" data-align="center">
              <h2 className="cap-title" data-size="3">
                Library
              </h2>
              {isOwner ? (
                <Link to="/library" className="cap-text link" data-size="small" data-face="ui">
                  Manage library
                </Link>
              ) : null}
            </div>
            <ProfileCovers books={finishedBooks} />
          </section>
        ) : null}

        {publicHighlights.length > 0 ? (
          <section className="cap-stack">
            <div className="cap-spread" data-gap="4" data-align="center">
              <h2 className="cap-title" data-size="3">
                Highlights
              </h2>
              {isOwner ? (
                <Link to="/highlights" className="cap-text link" data-size="small" data-face="ui">
                  All highlights
                </Link>
              ) : null}
            </div>
            <ul className="cap-stack" data-gap="4">
              {publicHighlights.map((h) => (
                <li key={h.id} className="cap-card">
                  {h.selectedText ? (
                    <blockquote className="fx-u-profile-quote">"{h.selectedText}"</blockquote>
                  ) : null}
                  {h.bookTitle ? (
                    <p className="fx-u-profile-text-3">
                      {h.bookSlug ? (
                        <Link to={`/books/${h.bookSlug}`} className="hover-accent">
                          {h.bookTitle}
                        </Link>
                      ) : (
                        h.bookTitle
                      )}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {publicShelves.length > 0 ? (
          <section className="cap-stack">
            <h2 className="cap-title" data-size="3">
              Shelves
            </h2>
            <ul className="fx-u-profile-grid">
              {publicShelves.map((s) => (
                <li key={s.id} className="py-3 cap-card fx-u-profile-card">
                  <p
                    className="cap-text"
                    data-size="small"
                    data-tone="ink"
                    data-weight="strong"
                    data-face="ui"
                  >
                    {s.name}
                  </p>
                  <p className="fx-u-profile-text-4">
                    {s.bookCount} {s.bookCount === 1 ? "book" : "books"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="fx-u-profile-grid-2">
          <div className="cap-stack" data-gap="6">
            <div className="cap-spread" data-gap="4" data-align="center">
              <h2 className="cap-title" data-size="3">
                Diary
              </h2>
              {isOwner ? (
                <Link to="/diary/new" className="cap-text link" data-size="small" data-face="ui">
                  New entry
                </Link>
              ) : null}
            </div>
            {diary.length === 0 ? (
              <EmptyState title="No entries yet" body="Reviews and ratings will appear here." />
            ) : (
              <ul className="cap-stack">
                {diary.map((d) => (
                  <li key={d.id} className="cap-card">
                    <div className="fx-u-profile-row-4">
                      <p className="cap-title" data-size="5">
                        {d.book ? (
                          <Link to={`/books/${d.book.slug}`} className="hover-accent">
                            {d.book.title}
                          </Link>
                        ) : (
                          "A book"
                        )}
                      </p>
                      {d.ratingHalf == null ? null : <Rating value={d.ratingHalf / 2} size="sm" />}
                    </div>
                    {d.review ? (
                      <p className="fx-u-profile-quote">
                        {d.containsSpoilers ? <em>Contains spoilers. </em> : null}
                        {d.review}
                      </p>
                    ) : null}
                    {d.visibility !== "public" ? (
                      <p className="fx-u-profile-caps">
                        {d.visibility === "friends" ? "Close friends" : "Private"}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="cap-stack" data-gap="7">
            <div className="cap-stack">
              <div className="cap-spread" data-gap="4" data-align="center">
                <h2 className="cap-title" data-size="3">
                  Lists
                </h2>
                {isOwner ? (
                  <Link to="/lists/new" className="cap-text link" data-size="small" data-face="ui">
                    New list
                  </Link>
                ) : null}
              </div>
              {lists.length === 0 ? (
                <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
                  No lists yet.
                </p>
              ) : (
                <ul className="cap-stack" data-gap="3">
                  {lists.map((l) => (
                    <li key={l.id}>
                      <Link to={`/lists/${l.id}`} className="fx-profile-row">
                        <span className="fx-u-profile-label-6">{l.title}</span>
                        {!l.isPublic ? <span className="fx-u-profile-caps-2">Private</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cap-stack">
              <h2 className="cap-title" data-size="3">
                Activity
              </h2>
              {activity.length === 0 ? (
                <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
                  Nothing recent.
                </p>
              ) : (
                <ul className="fx-u-profile-stack-3">
                  {activity.map((a) => (
                    <li key={a.id} className="fx-u-profile-item-2">
                      {activityLabel(a.type, a.data)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </Container>
    </PageShell>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="fx-u-profile-title-2">{value}</dd>
      <dt className="mt-1 fx-u-profile-caps-3">{label}</dt>
    </div>
  );
}

type CoverBook = {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
};

function ProfileCovers({ books }: { books: CoverBook[] }) {
  return (
    <ul className="fx-u-profile-row-3">
      {books.map((b) => (
        <li key={b.bookId} className="fx-u-profile-item-3">
          <Link to={`/books/${b.slug}`} className="block">
            <span className="block fx-u-profile-label-2">
              {b.coverUrl ? (
                <CoverPicture
                  src={b.coverUrl}
                  alt={`${b.title} by ${b.author}`}
                  sizes="112px"
                  className="fx-u-profile-img"
                />
              ) : (
                <span className="cap-text justify-center fx-u-profile-label-3" data-align="center">
                  {b.title}
                </span>
              )}
            </span>
            <span className="cap-clamp block fx-u-profile-label-4" data-lines="1">
              {b.title}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Branded notice for a private profile: confirms the account exists without leaking
// any of its content. Replaces the hard 404 the rebuild had.
function PrivateProfile({
  profile,
}: {
  profile: { username: string; displayName: string | null; avatarUrl: string | null };
}) {
  const name = profile.displayName ?? profile.username;
  return (
    <PageShell>
      <Container className="cap-text fx-u-profile-wrap" data-align="center">
        <Avatar src={profile.avatarUrl} name={name} size="lg" />
        <div>
          <h1 className="cap-title" data-size="2">
            {name}
          </h1>
          <p className="mt-1 fx-u-profile-text">@{profile.username}</p>
        </div>
        <EmptyState
          title="This profile is private"
          body="This reader keeps their library, reviews, and activity to themselves."
        />
      </Container>
    </PageShell>
  );
}
