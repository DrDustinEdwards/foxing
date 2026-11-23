// Signed-in dashboard at /home. Reads run in-process via core (loadLibraryData);
// the shell (nav, secondary bar) comes from the root loader. Anonymous visitors are
// sent to /login and signed-in-without-profile users to /onboarding by requireProfile.
import { useNow } from "capsomer/react/hooks";
import { Link } from "capsomer/react/link";
import { Meter } from "capsomer/react/meter";
import "capsomer/meter.css";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Button, Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import type { LibraryEntry as Entry, Streak } from "@foxing/types";
import { loadLibraryData } from "~/lib/library.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/home";
import { noindexMeta } from "~/lib/seo";

function timeOfDay(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// The hour in the user's saved timezone, or null when unset/invalid so the client
// can fall back to the visitor's local hour. Avoids the UTC greeting bug.
function hourInZone(tz: string | null): number | null {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const n = Number.parseInt(parts, 10);
    return Number.isFinite(n) ? n % 24 : null;
  } catch {
    return null;
  }
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const data = await loadLibraryData(env, user.id);
  const reading = data.library.find((e) => e.status === "reading") ?? null;
  const firstName = (profile.displayName ?? profile.username).split(/\s+/)[0];
  const tzHour = hourInZone(profile.timezone);
  return {
    firstName,
    greeting: timeOfDay(tzHour ?? new Date().getUTCHours()),
    hasTimezone: tzHour !== null,
    reading,
    streak: data.streak,
  };
}

export function meta() {
  return noindexMeta("Home | Foxing");
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { firstName, reading, streak, hasTimezone } = loaderData;
  // Server greeting uses the saved timezone. Without one it is a UTC guess, so correct to the
  // visitor's actual local hour once the page is live (Capsomer's clock is 0 until then).
  const now = useNow(60_000);
  const greeting =
    hasTimezone || now === 0 ? loaderData.greeting : timeOfDay(new Date(now).getHours());

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <h1 className="fx-home-title">
          Good {greeting}, {firstName}.
        </h1>

        <div className="fx-home-grid">
          <ContinueReadingCard reading={reading} />
          <StreakCard streak={streak} />
        </div>
      </Container>
    </PageShell>
  );
}

function ContinueReadingCard({ reading }: { reading: Entry | null }) {
  if (!reading) {
    return (
      <section
        className="cap-text justify-center cap-card cap-stack fx-home-card"
        data-gap="6"
        data-align="center"
      >
        <p className="cap-title" data-size="4">
          Nothing in progress
        </p>
        <div>
          <Button to="/books">Browse the library</Button>
        </div>
      </section>
    );
  }

  const progress = Math.max(0, Math.min(100, Math.round(reading.progressPct)));
  return (
    <section className="cap-card fx-home-card-2">
      <div className="fx-home-box">
        <Link to={`/books/${reading.slug}`}>
          <CoverImage
            src={reading.coverUrl}
            alt={`${reading.title} by ${reading.author}`}
            fallbackLabel={reading.title}
            sizes="132px"
          />
        </Link>
      </div>
      <div className="cap-stack" data-gap="5">
        <div className="cap-stack" data-gap="2">
          <h2 className="fx-home-title-2">
            <Link to={`/books/${reading.slug}`} className="hover-accent">
              {reading.title}
            </Link>
          </h2>
          <p className="fx-home-text-2">{reading.author}</p>
        </div>
        <Meter
          label="Reading progress"
          value={progress}
          max={100}
          display={`${progress}% read`}
          valueText={`${progress}% of ${reading.title} read`}
        />
        <div>
          <Button to={`/books/${reading.slug}`} variant="secondary">
            Open book
          </Button>
        </div>
      </div>
    </section>
  );
}

function StreakCard({ streak: s }: { streak: Streak }) {
  return (
    <aside className="cap-card cap-stack fx-home-card-3" data-gap="6">
      <div className="cap-stack" data-gap="5">
        <h2 className="cap-title" data-size="3">
          Reading streak
        </h2>
        <p className="fx-home-title-3">
          {s.currentStreak}
          <span className="fx-home-label">{s.currentStreak === 1 ? "day" : "days"}</span>
        </p>
      </div>
      <dl className="cap-text fx-home-grid-2" data-align="center">
        <div className="cap-stack fx-flip" data-gap="1">
          <dt className="fx-home-caps">longest</dt>
          <dd className="cap-title" data-size="4">
            {s.longestStreak}
          </dd>
        </div>
        <div className="cap-stack fx-flip" data-gap="1">
          <dt className="fx-home-caps">finished</dt>
          <dd className="cap-title" data-size="4">
            {s.totalBooksFinished}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
