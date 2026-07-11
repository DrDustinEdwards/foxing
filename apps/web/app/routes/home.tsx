// Signed-in dashboard at /home. Reads run in-process via core (loadLibraryData);
// the shell (nav, secondary bar) comes from the root loader. Anonymous visitors are
// sent to /login and signed-in-without-profile users to /onboarding by requireProfile.
import { Link } from "react-router";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Button, Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import type { Entry, Streak } from "~/lib/library.server";
import { loadLibraryData } from "~/lib/library.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/home";

function timeOfDay(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const data = await loadLibraryData(env, user.id);
  const reading = data.library.find((e) => e.status === "reading") ?? null;
  const firstName = (profile.displayName ?? profile.username).split(/\s+/)[0];
  return {
    firstName,
    greeting: timeOfDay(new Date().getUTCHours()),
    reading,
    streak: data.streak,
  };
}

export function meta() {
  return [{ title: "Home | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { firstName, greeting, reading, streak } = loaderData;

  return (
    <PageShell>
      <Container className="flex flex-col gap-8">
        <h1 className="font-display text-3xl sm:text-4xl">
          Good {greeting}, {firstName}.
        </h1>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
      <section className="flex flex-col justify-center rounded-hero border border-dashed border-border-subtle bg-surface p-8 text-center">
        <Eyebrow className="mb-2">Continue reading</Eyebrow>
        <p className="font-display text-xl text-primary">Nothing in progress</p>
        <p className="mx-auto mt-2 max-w-sm text-secondary">
          Start a book and it shows up here with your progress.
        </p>
        <div className="mt-5">
          <Button to="/books">Browse the library</Button>
        </div>
      </section>
    );
  }

  const progress = Math.max(0, Math.min(100, Math.round(reading.progressPct)));
  return (
    <section className="grid gap-6 rounded-hero border border-border-subtle bg-surface p-6 shadow-card-sm sm:grid-cols-[minmax(0,132px)_minmax(0,1fr)] sm:items-center sm:p-8">
      <div className="mx-auto w-full max-w-[132px]">
        <Link to={`/books/${reading.slug}`}>
          <CoverImage
            src={reading.coverUrl}
            alt={`${reading.title} by ${reading.author}`}
            fallbackLabel={reading.title}
            sizes="132px"
          />
        </Link>
      </div>
      <div>
        <Eyebrow>Continue reading</Eyebrow>
        <h2 className="mt-2 font-display text-2xl leading-tight">
          <Link to={`/books/${reading.slug}`} className="hover:text-brand-text">
            {reading.title}
          </Link>
        </h2>
        <p className="mt-1 font-ui text-secondary">{reading.author}</p>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div
            className="h-full rounded-full bg-[color:var(--brand-ui)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-xs text-tertiary">{progress}% read</p>
        <div className="mt-5">
          <Button to={`/books/${reading.slug}`} variant="secondary">
            Open book
          </Button>
        </div>
      </div>
    </section>
  );
}

function StreakCard({ streak }: { streak: Streak | null }) {
  const s = streak ?? { currentStreak: 0, longestStreak: 0, totalBooksFinished: 0 };
  const subtext =
    s.currentStreak === 0
      ? "Open a book to start a streak."
      : "Read today to keep it going.";

  return (
    <aside className="flex flex-col rounded-hero border border-border-subtle bg-surface p-6 shadow-card-sm">
      <Eyebrow className="mb-3">Reading streak</Eyebrow>
      <p className="font-display text-3xl leading-none">
        {s.currentStreak}
        <span className="ml-1.5 font-ui text-base text-secondary">
          {s.currentStreak === 1 ? "day" : "days"}
        </span>
      </p>
      <p className="mt-2 font-ui text-sm text-secondary">{subtext}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4 text-center">
        <div>
          <dd className="font-display text-xl text-primary">{s.longestStreak}</dd>
          <dt className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
            longest
          </dt>
        </div>
        <div>
          <dd className="font-display text-xl text-primary">{s.totalBooksFinished}</dd>
          <dt className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
            finished
          </dt>
        </div>
      </dl>
    </aside>
  );
}
