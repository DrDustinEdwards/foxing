// The signed-in user's own profile at /me, rendered in the app shell. Reads run
// in-process via core; requireProfile sends anonymous visitors to /login and
// signed-in-without-profile users to /onboarding (never renders a null profile).
import { createDb, libraryRepo } from "@foxing/core";
import { ButtonLink, Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Avatar, Chip, Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/me";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Your profile | Foxing");
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const streak = await libraryRepo.getStreak(createDb(env.DB), user.id);
  const joined = profile.createdAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(profile.createdAt)
    : null;
  return {
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      favoriteGenres: profile.favoriteGenres ?? [],
    },
    joined,
    stats: {
      booksFinished: streak?.totalBooksFinished ?? 0,
      dayStreak: streak?.currentStreak ?? 0,
      highlights: streak?.totalHighlights ?? 0,
    },
  };
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { profile, joined, stats } = loaderData;
  const name = profile.displayName ?? profile.username;
  const statTiles = [
    { label: "books finished", value: stats.booksFinished },
    { label: "day streak", value: stats.dayStreak },
    { label: "highlights", value: stats.highlights },
  ];

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <header className="items-start fx-me-stack">
          <Avatar src={profile.avatarUrl} name={name} size="lg" />
          <div className="cap-stack cap-shrink" data-gap="3">
            <div className="cap-stack" data-gap="2">
              <h1 className="fx-me-title">{name}</h1>
              <p className="fx-me-text">@{profile.username}</p>
            </div>
            {joined ? (
              <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
                Reading on Foxing since {joined}
              </p>
            ) : null}
          </div>
        </header>

        <nav className="cap-cluster" data-gap="3" aria-label="Your Foxing shortcuts">
          {[
            { to: `/u/${profile.username}`, label: "Public profile" },
            { to: "/diary/new", label: "Log a book" },
            { to: "/feed", label: "Feed" },
            { to: "/people", label: "People" },
            { to: "/year", label: "Year in reading" },
          ].map((l) => (
            <ButtonLink key={l.to} to={l.to} size="sm">
              {l.label}
            </ButtonLink>
          ))}
        </nav>

        {profile.bio ? <p className="fx-me-text-2">{profile.bio}</p> : null}

        <section className="cap-card cap-stack fx-me-card" data-gap="6">
          <dl className="cap-text fx-me-grid" data-align="center">
            {statTiles.map((tile) => (
              <div key={tile.label} className="cap-stack" data-gap="1">
                <dd className="cap-title" data-size="3">
                  {tile.value}
                </dd>
                <dt className="fx-me-caps">{tile.label}</dt>
              </div>
            ))}
          </dl>
          <div className="fx-me-box">
            <Link to="/library" className="cap-text link" data-size="small" data-face="ui">
              Go to your library
            </Link>
          </div>
        </section>

        {profile.favoriteGenres.length > 0 ? (
          <section className="cap-stack" data-gap="4">
            <Eyebrow>Favorite genres</Eyebrow>
            <div className="cap-cluster" data-gap="3">
              {profile.favoriteGenres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
