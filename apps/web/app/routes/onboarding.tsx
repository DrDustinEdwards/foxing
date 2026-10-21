import { useState } from "react";
import { Link, redirect, useNavigate } from "react-router";
import { catalogRepo, createDb, profilesRepo } from "@foxing/core";
import { CoverImage } from "~/components/cover-image";
import { cn } from "~/lib/cn";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/onboarding";

export function meta() {
  return [{ title: "Welcome to Foxing" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");
  const db = createDb(env.DB);
  const existing = await profilesRepo.getProfileById(db, session.user.id);
  if (existing) throw redirect("/me");
  const [starters, genres] = await Promise.all([
    catalogRepo.listStarterBooks(db, 6),
    catalogRepo.getGenreFacets(db, 12),
  ]);
  return { suggested: session.user.name ?? "", starters, genres };
}

/** Minimal onboarding frame: wordmark + centred card. Not the full nav shell, because
 *  the user has no profile yet, so the signed-in nav would show a "Sign in" prompt. */
function Frame({ step, children }: { step: 1 | 2; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-10">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          {/* Fox emoji is allowed in auth chrome (Rule 9). */}
          <span aria-hidden="true">🦊</span>
          <span>Foxing</span>
        </Link>
        <p className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-tertiary">
          Step {step} of 2
        </p>
        <main className="mt-3">{children}</main>
      </div>
    </div>
  );
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { suggested, starters, genres } = loaderData;
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function toggleGenre(subject: string) {
    setChosen((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  async function onSubmitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    try {
      const res = await fetch("/api/v1/me/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username")),
          displayName: displayName || undefined,
          favoriteGenres: chosen.length ? chosen : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not finish onboarding.");
        return;
      }
      setStep(2);
    } catch {
      setError("Could not finish onboarding. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function startReading(bookId: string, slug: string) {
    setSavingId(bookId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/library/${bookId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "reading" }),
      });
      if (!res.ok) {
        setError("Could not add that book. Try again.");
        return;
      }
      void navigate(`/books/${slug}`);
    } catch {
      setError("Could not add that book. Check your connection and try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (step === 1) {
    return (
      <Frame step={1}>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Set up your profile</h1>
        <p className="mt-3 text-secondary">
          Your username is how other readers find you. You can change your display name and favorite
          genres later in settings.
        </p>
        <form onSubmit={onSubmitProfile} className="mt-8 space-y-6">
          <label className="block">
            <span className="mb-1.5 block font-ui text-sm font-medium text-primary">Username</span>
            <input
              name="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              className="w-full rounded-md border border-border-interactive bg-surface px-3 py-2.5 font-ui text-base text-primary outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--border-focus)]"
            />
            <span className="mt-1.5 block font-ui text-xs text-tertiary">
              Letters, numbers, and underscores.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-ui text-sm font-medium text-primary">
              Display name <span className="font-normal text-tertiary">(optional)</span>
            </span>
            <input
              name="displayName"
              defaultValue={suggested}
              maxLength={80}
              autoComplete="name"
              className="w-full rounded-md border border-border-interactive bg-surface px-3 py-2.5 font-ui text-base text-primary outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--border-focus)]"
            />
          </label>

          {genres.length ? (
            <fieldset>
              <legend className="mb-2 font-ui text-sm font-medium text-primary">
                Favorite genres <span className="font-normal text-tertiary">(optional)</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => {
                  const on = chosen.includes(g.subject);
                  return (
                    <button
                      key={g.subject}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleGenre(g.subject)}
                      className={cn(
                        "inline-flex rounded-full px-3 py-1.5 font-ui text-sm transition-colors",
                        on
                          ? "bg-brand-text text-on-brand dark:text-[color:var(--section-charcoal)]"
                          : "border border-border-subtle text-secondary hover:bg-hover",
                      )}
                    >
                      {g.subject}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p role="alert" className="font-ui text-sm text-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-50 dark:text-[color:var(--section-charcoal)]"
          >
            {pending ? "Saving..." : "Continue"}
          </button>
        </form>
      </Frame>
    );
  }

  return (
    <Frame step={2}>
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">Start your first book</h1>
      <p className="mt-3 text-secondary">
        Award winners to begin with. Adding one shelves it as reading and opens its page.
      </p>

      {error ? (
        <p role="alert" className="mt-4 font-ui text-sm text-error">
          {error}
        </p>
      ) : null}

      {starters.length ? (
        <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {starters.map((book) => (
            <li key={book.id} className="flex flex-col">
              <Link to={`/books/${book.slug}`} className="group">
                <CoverImage
                  src={book.coverUrl}
                  alt={`${book.title} by ${book.author}`}
                  fallbackLabel={book.title}
                  sizes="(min-width: 640px) 200px, 45vw"
                />
                <h2 className="mt-3 font-display text-base leading-snug text-primary transition-colors group-hover:text-brand-text">
                  {book.title}
                </h2>
              </Link>
              <p className="mt-1 font-ui text-sm text-tertiary">{book.author}</p>
              <button
                type="button"
                onClick={() => startReading(book.id, book.slug)}
                disabled={savingId !== null}
                className="mt-2 inline-flex items-center justify-center rounded-cover border border-border-interactive px-3 py-1.5 font-ui text-sm text-primary transition hover:bg-hover disabled:opacity-50"
              >
                {savingId === book.id ? "Adding..." : "Start reading"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-secondary">
          The catalog is warming up.{" "}
          <Link to="/books" className="text-brand-text hover:underline">
            Browse the library
          </Link>{" "}
          to pick your first book.
        </p>
      )}

      <div className="mt-10">
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="font-ui text-sm text-secondary hover:text-primary"
        >
          Skip for now
        </button>
      </div>
    </Frame>
  );
}
