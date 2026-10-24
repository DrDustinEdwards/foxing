// The signed-in user's own profile at /me, rendered in the app shell. Reads run
// in-process via core; requireProfile sends anonymous visitors to /login and
// signed-in-without-profile users to /onboarding (never renders a null profile).
import { createDb, libraryRepo } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Avatar, Chip, Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/me";

export function meta() {
  return [{ title: "Your profile | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const streak = await libraryRepo.getStreak(createDb(env.DB), user.id);
  const joined = profile.createdAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(profile.createdAt)
    : null;
  return {
    email: user.email,
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
  const { email, profile, joined, stats } = loaderData;
  const name = profile.displayName ?? profile.username;
  const statTiles = [
    { label: "books finished", value: stats.booksFinished },
    { label: "day streak", value: stats.dayStreak },
    { label: "highlights", value: stats.highlights },
  ];

  return (
    <PageShell>
      <Container className="stack-8">
        <header className="items-start fx-me-stack">
          <Avatar src={profile.avatarUrl} name={name} size="lg" />
          <div className="min-0">
            <h1 className="fx-me-title">{name}</h1>
            <p className="mt-1 fx-me-text">@{profile.username}</p>
            {joined ? <p className="mt-2 ui">Reading on Foxing since {joined}</p> : null}
          </div>
        </header>

        <nav className="row-2 wrap" aria-label="Your Foxing shortcuts">
          {[
            { to: `/u/${profile.username}`, label: "Public profile" },
            { to: "/diary/new", label: "Log a book" },
            { to: "/feed", label: "Feed" },
            { to: "/people", label: "People" },
            { to: "/year", label: "Year in reading" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="cap-btn" data-size="sm">
              {l.label}
            </Link>
          ))}
        </nav>

        {profile.bio ? <p className="fx-me-text-2">{profile.bio}</p> : null}

        <section className="fx-me-card">
          <Eyebrow className="mb-4">Your reading</Eyebrow>
          <dl className="text-center fx-me-grid">
            {statTiles.map((tile) => (
              <div key={tile.label}>
                <dd className="display-2">{tile.value}</dd>
                <dt className="fx-me-caps">{tile.label}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-5 fx-me-box">
            <Link to="/library" className="link sans small">
              Go to your library
            </Link>
          </div>
        </section>

        {profile.favoriteGenres.length > 0 ? (
          <section>
            <Eyebrow className="mb-3">Favorite genres</Eyebrow>
            <div className="row-2 wrap">
              {profile.favoriteGenres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
          </section>
        ) : null}

        <p className="meta">Signed in as {email}</p>
      </Container>
    </PageShell>
  );
}
