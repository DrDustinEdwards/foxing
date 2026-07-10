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
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
        profile.createdAt,
      )
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
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar src={profile.avatarUrl} name={name} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl">{name}</h1>
            <p className="mt-1 font-mono text-sm text-tertiary">@{profile.username}</p>
            {joined ? (
              <p className="mt-2 font-ui text-sm text-secondary">Reading on Foxing since {joined}</p>
            ) : null}
          </div>
        </header>

        {profile.bio ? (
          <p className="max-w-2xl font-body text-lg text-secondary">{profile.bio}</p>
        ) : null}

        <section className="rounded-hero border border-border-subtle bg-surface p-6">
          <Eyebrow className="mb-4">Your reading</Eyebrow>
          <dl className="grid grid-cols-3 gap-4 text-center">
            {statTiles.map((tile) => (
              <div key={tile.label}>
                <dd className="font-display text-2xl text-primary">{tile.value}</dd>
                <dt className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
                  {tile.label}
                </dt>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-border-subtle pt-4">
            <Link to="/library" className="font-ui text-sm text-brand-text hover:underline">
              Go to your library
            </Link>
          </div>
        </section>

        {profile.favoriteGenres.length > 0 ? (
          <section>
            <Eyebrow className="mb-3">Favorite genres</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {profile.favoriteGenres.map((g) => (
                <Chip key={g}>{g}</Chip>
              ))}
            </div>
          </section>
        ) : null}

        <p className="font-ui text-sm text-tertiary">Signed in as {email}</p>
      </Container>
    </PageShell>
  );
}
