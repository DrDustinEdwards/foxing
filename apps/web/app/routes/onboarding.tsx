import { useOnboard, useSetBookStatus } from "@foxing/client";
import { useState } from "react";
import { Link, redirect, useNavigate } from "react-router";
import { catalogRepo, createDb, profilesRepo } from "@foxing/core";
import { CoverImage } from "~/components/cover-image";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/onboarding";

export function meta() {
  return [{ title: "Welcome to Foxing" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
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
    <div className="fx-onboarding-box">
      <div className="fx-onboarding-stack">
        <Link to="/" className="fx-onboarding-link">
          {/* Fox emoji is allowed in auth chrome (Rule 9). */}
          <span aria-hidden="true">🦊</span>
          <span>Foxing</span>
        </Link>
        <p className="mt-8 fx-onboarding-caps">Step {step} of 2</p>
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
  const onboard = useOnboard();
  const setStatus = useSetBookStatus();
  const [savingId, setSavingId] = useState<string | null>(null);
  const error = onboard.error ?? setStatus.error;
  const pending = onboard.pending;

  function toggleGenre(subject: string) {
    setChosen((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  async function onSubmitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const done = await onboard.run({
      username: String(form.get("username")),
      displayName: displayName || undefined,
      favoriteGenres: chosen.length ? chosen : undefined,
    });
    if (done) setStep(2);
  }

  async function startReading(book: (typeof starters)[number]) {
    setSavingId(book.id);
    const done = await setStatus.run({ bookId: book.id, status: "reading", book });
    setSavingId(null);
    if (done) void navigate(`/books/${book.slug}`);
  }

  if (step === 1) {
    return (
      <Frame step={1}>
        <h1 className="fx-onboarding-title">Set up your profile</h1>
        <p className="mt-3 fx-onboarding-text">
          Your username is how other readers find you. You can change your display name and favorite
          genres later in settings.
        </p>
        <form onSubmit={onSubmitProfile} className="mt-8 fx-onboarding-form">
          <label className="block">
            <span className="block fx-onboarding-label">Username</span>
            <input
              name="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              className="cap-input fx-onboarding-input"
            />
            <span className="block fx-onboarding-label-2">Letters, numbers, and underscores.</span>
          </label>

          <label className="block">
            <span className="block fx-onboarding-label">
              Display name <span className="fx-onboarding-label-3">(optional)</span>
            </span>
            <input
              name="displayName"
              defaultValue={suggested}
              maxLength={80}
              autoComplete="name"
              className="cap-input fx-onboarding-input"
            />
          </label>

          {genres.length ? (
            <fieldset>
              <legend className="mb-2 fx-onboarding-legend">
                Favorite genres <span className="fx-onboarding-label-3">(optional)</span>
              </legend>
              <div className="fx-onboarding-row">
                {genres.map((g) => {
                  const on = chosen.includes(g.subject);
                  return (
                    <button
                      key={g.subject}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleGenre(g.subject)}
                      className="cap-chip"
                    >
                      {g.subject}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="cap-btn justify-center fx-onboarding-btn"
            data-variant="primary"
          >
            {pending ? "Saving..." : "Continue"}
          </button>
        </form>
      </Frame>
    );
  }

  return (
    <Frame step={2}>
      <h1 className="fx-onboarding-title">Start your first book</h1>
      <p className="mt-3 fx-onboarding-text">
        Award winners to begin with. Adding one shelves it as reading and opens its page.
      </p>

      {error ? (
        <p role="alert" className="mt-4 fx-onboarding-text-2">
          {error}
        </p>
      ) : null}

      {starters.length ? (
        <ul className="mt-8 fx-onboarding-grid">
          {starters.map((book) => (
            <li key={book.id} className="fx-onboarding-stack-2">
              <Link to={`/books/${book.slug}`} className="group">
                <CoverImage
                  src={book.coverUrl}
                  alt={`${book.title} by ${book.author}`}
                  fallbackLabel={book.title}
                  sizes="(min-width: 640px) 200px, 45vw"
                />
                <h2 className="mt-3 fx-onboarding-title-2">{book.title}</h2>
              </Link>
              <p className="mt-1 meta">{book.author}</p>
              <button
                type="button"
                onClick={() => startReading(book)}
                disabled={savingId !== null}
                className="cap-btn mt-2 justify-center fx-onboarding-btn"
                data-size="sm"
              >
                {savingId === book.id ? "Adding..." : "Start reading"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 fx-onboarding-text">
          The catalog is warming up.{" "}
          <Link to="/books" className="link">
            Browse the library
          </Link>{" "}
          to pick your first book.
        </p>
      )}

      <div className="mt-10">
        <button type="button" onClick={() => navigate("/home")} className="fx-onboarding-btn-2">
          Skip for now
        </button>
      </div>
    </Frame>
  );
}
