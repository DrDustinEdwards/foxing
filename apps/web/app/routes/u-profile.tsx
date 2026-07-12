// Public profile at /u/:username. Visibility-aware: the loader resolves what the viewer
// may see entirely in core (socialDomain.visibleVisibilitiesFor) and never trusts the
// client. Shows identity, follow control, recent diary, lists, and activity. Anonymous
// visitors can view public profiles; a non-public profile 404s for everyone but its
// owner.
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";
import { FollowButton } from "~/components/social/follow-button";
import { Avatar, Container, EmptyState, TagPill } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { ldJson } from "~/lib/seo";
import { loadPublicProfile } from "~/lib/social.server";
import type { Route } from "./+types/u-profile";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const viewerId = session?.user?.id ?? null;
  const data = await loadPublicProfile(env, params.username, viewerId);
  if (!data) throw new Response("Not found", { status: 404 });
  return { ...data, signedIn: !!viewerId, origin: new URL(request.url).origin };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  const name = data?.profile.displayName ?? data?.profile.username ?? "Reader";
  const base = [
    { title: `${name} | Foxing` },
    { name: "description", content: `${name} on Foxing.` },
  ];
  if (data && !data.isPrivate) {
    return [
      ...base,
      ldJson({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: {
          "@type": "Person",
          name,
          alternateName: `@${data.profile.username}`,
          url: `${data.origin}/u/${data.profile.username}`,
          ...(data.profile.avatarUrl ? { image: data.profile.avatarUrl } : {}),
          ...(data.profile.bio ? { description: data.profile.bio } : {}),
        },
      }),
    ];
  }
  return base;
}

// The current calendar year, for the "year in reading" recap link. Computed at
// render (module scope would freeze it into the build).
function currentYear(): number {
  return new Date().getUTCFullYear();
}

function Stars({ ratingHalf }: { ratingHalf: number | null }) {
  if (ratingHalf == null) return null;
  return (
    <span
      role="img"
      aria-label={`${ratingHalf / 2} stars`}
      className="font-mono text-sm text-brand-text"
    >
      {"★".repeat(Math.floor(ratingHalf / 2))}
      {ratingHalf % 2 === 1 ? "½" : ""}
    </span>
  );
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

export default function UProfile({ loaderData }: Route.ComponentProps) {
  if (loaderData.isPrivate) {
    return <PrivateProfile profile={loaderData.profile} />;
  }
  const {
    profile,
    isOwner,
    isFollowing,
    viewerIsPlus,
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
    signedIn,
  } = loaderData;
  const name = profile.displayName ?? profile.username;

  return (
    <PageShell>
      <Container className="flex flex-col gap-10">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <Avatar src={profile.avatarUrl} name={name} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl">{name}</h1>
              <p className="mt-1 font-mono text-sm text-tertiary">@{profile.username}</p>
              {profile.bio ? (
                <p className="mt-3 max-w-xl font-body text-secondary">{profile.bio}</p>
              ) : null}
              <dl className="mt-4 flex flex-wrap gap-6">
                <StatTile label="Books read" value={booksRead} />
                <StatTile label="Highlights" value={highlightCount} />
                <StatTile label="Followers" value={followerCount} />
                <StatTile label="Following" value={followingCount} />
              </dl>
              {profile.favoriteGenres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.favoriteGenres.slice(0, 6).map((g) => (
                    <TagPill key={g}>{g}</TagPill>
                  ))}
                </div>
              ) : null}
              <Link
                to={`/u/${profile.username}/recap/${currentYear()}`}
                className="mt-3 inline-block font-ui text-sm text-brand-text hover:underline"
              >
                {currentYear()} in reading
              </Link>
            </div>
          </div>
          {isOwner ? (
            <Link
              to="/me"
              className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm text-primary hover:bg-hover"
            >
              Edit profile
            </Link>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <FollowButton
                userId={profile.id}
                initialFollowing={isFollowing}
                signedIn={signedIn}
              />
              {signedIn ? (
                <CloseFriendToggle
                  userId={profile.id}
                  initialClose={viewerHasAsCloseFriend}
                  isPlus={viewerIsPlus}
                />
              ) : null}
            </div>
          )}
        </header>

        {favorites.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl">Favorite books</h2>
            <ProfileCovers books={favorites} />
          </section>
        ) : null}

        {currentlyReading.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl">Currently reading</h2>
            <ul className="flex flex-wrap gap-4">
              {currentlyReading.map((b) => (
                <li key={b.bookId} className="w-32">
                  <Link to={`/books/${b.slug}`} className="group block">
                    <span className="block overflow-hidden rounded-cover border border-border-subtle bg-sunken">
                      {b.coverUrl ? (
                        <img
                          src={b.coverUrl}
                          alt=""
                          className="aspect-[2/3] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex aspect-[2/3] w-full items-center justify-center px-2 text-center font-ui text-xs text-tertiary">
                          {b.title}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate font-ui text-xs text-primary group-hover:text-brand-text">
                      {b.title}
                    </span>
                    <span className="block truncate font-mono text-[0.65rem] text-tertiary">
                      {Math.round(b.progressPct)}% read
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {finishedBooks.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Library</h2>
              {isOwner ? (
                <Link to="/library" className="font-ui text-sm text-brand-text hover:underline">
                  Manage library
                </Link>
              ) : null}
            </div>
            <ProfileCovers books={finishedBooks} />
          </section>
        ) : null}

        {publicHighlights.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Highlights</h2>
              {isOwner ? (
                <Link to="/highlights" className="font-ui text-sm text-brand-text hover:underline">
                  All highlights
                </Link>
              ) : null}
            </div>
            <ul className="flex flex-col gap-3">
              {publicHighlights.map((h) => (
                <li
                  key={h.id}
                  className="rounded-card border border-border-subtle bg-surface p-4"
                >
                  {h.selectedText ? (
                    <blockquote className="font-body text-secondary">"{h.selectedText}"</blockquote>
                  ) : null}
                  {h.bookTitle ? (
                    <p className="mt-2 font-mono text-xs text-tertiary">
                      {h.bookSlug ? (
                        <Link to={`/books/${h.bookSlug}`} className="hover:text-brand-text">
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
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl">Shelves</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publicShelves.map((s) => (
                <li
                  key={s.id}
                  className="rounded-cover border border-border-subtle bg-surface px-4 py-3"
                >
                  <p className="font-ui text-sm font-medium text-primary">{s.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-tertiary">
                    {s.bookCount} {s.bookCount === 1 ? "book" : "books"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Diary</h2>
              {isOwner ? (
                <Link to="/diary/new" className="font-ui text-sm text-brand-text hover:underline">
                  New entry
                </Link>
              ) : null}
            </div>
            {diary.length === 0 ? (
              <EmptyState title="No entries yet" body="Reviews and ratings will appear here." />
            ) : (
              <ul className="flex flex-col gap-4">
                {diary.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-card border border-border-subtle bg-surface p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display text-lg text-primary">
                        {d.book ? (
                          <Link to={`/books/${d.book.slug}`} className="hover:text-brand-text">
                            {d.book.title}
                          </Link>
                        ) : (
                          "A book"
                        )}
                      </p>
                      <Stars ratingHalf={d.ratingHalf} />
                    </div>
                    {d.review ? (
                      <p className="mt-2 font-body text-secondary">
                        {d.containsSpoilers ? <em>Contains spoilers. </em> : null}
                        {d.review}
                      </p>
                    ) : null}
                    {d.visibility !== "public" ? (
                      <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wide text-tertiary">
                        {d.visibility === "friends" ? "Close friends" : "Private"}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Lists</h2>
                {isOwner ? (
                  <Link to="/lists/new" className="font-ui text-sm text-brand-text hover:underline">
                    New list
                  </Link>
                ) : null}
              </div>
              {lists.length === 0 ? (
                <p className="font-ui text-sm text-tertiary">No lists yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lists.map((l) => (
                    <li key={l.id}>
                      <Link
                        to={`/lists/${l.id}`}
                        className="flex items-center justify-between rounded-cover border border-border-subtle bg-surface px-4 py-3 hover:border-border-interactive"
                      >
                        <span className="font-ui text-sm text-primary">{l.title}</span>
                        {!l.isPublic ? (
                          <span className="font-mono text-[0.6rem] uppercase text-tertiary">
                            Private
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="font-display text-2xl">Activity</h2>
              {activity.length === 0 ? (
                <p className="font-ui text-sm text-tertiary">Nothing recent.</p>
              ) : (
                <ul className="flex flex-col gap-2 font-ui text-sm text-secondary">
                  {activity.map((a) => (
                    <li key={a.id} className="border-b border-border-subtle pb-2">
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
      <dd className="font-display text-2xl leading-none text-primary">{value}</dd>
      <dt className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
        {label}
      </dt>
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
    <ul className="flex flex-wrap gap-4">
      {books.map((b) => (
        <li key={b.bookId} className="w-28">
          <Link to={`/books/${b.slug}`} className="group block">
            <span className="block overflow-hidden rounded-cover border border-border-subtle bg-sunken">
              {b.coverUrl ? (
                <img
                  src={b.coverUrl}
                  alt={`${b.title} by ${b.author}`}
                  className="aspect-[2/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex aspect-[2/3] w-full items-center justify-center px-2 text-center font-ui text-xs text-tertiary">
                  {b.title}
                </span>
              )}
            </span>
            <span className="mt-1.5 block truncate font-ui text-xs text-primary group-hover:text-brand-text">
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
      <Container className="flex flex-col items-center gap-5 py-16 text-center">
        <Avatar src={profile.avatarUrl} name={name} size="lg" />
        <div>
          <h1 className="font-display text-3xl">{name}</h1>
          <p className="mt-1 font-mono text-sm text-tertiary">@{profile.username}</p>
        </div>
        <EmptyState
          title="This profile is private"
          body="This reader keeps their library, reviews, and activity to themselves."
        />
      </Container>
    </PageShell>
  );
}
