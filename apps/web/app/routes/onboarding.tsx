import { useOnboard, useSetBookStatus } from "@foxing/client";
import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Link } from "capsomer/react/link";
import { createDb, profilesRepo, views } from "@foxing/core";
import { CoverImage } from "~/components/cover-image";
import { cloudflareContext } from "~/context";
import { sessionLookup } from "@dustinedwards/site-runtime/sign-in";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/onboarding";
import { signInFrom } from "~/lib/sign-in-path";
import { useHydrated } from "capsomer/react/hooks";

export function meta() {
  return [{ title: "Welcome to Foxing" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession(sessionLookup(request));
  if (!session?.user) throw redirect(signInFrom(request));
  const db = createDb(env.DB);
  const existing = await profilesRepo.getProfileById(db, session.user.id);
  if (existing) throw redirect("/me");
  return { suggested: session.user.name ?? "", ...(await views.onboarding(db)) };
}

/** Minimal onboarding frame: wordmark + centered card. Not the full nav shell, because
 *  the user has no profile yet, so the signed-in nav would show a "Sign in" prompt. */
function Frame({ step, children }: { step: 1 | 2; children: React.ReactNode }) {
  return (
    <div className="fx-onboarding-box">
      <div className="cap-stack fx-onboarding-stack" data-gap="7">
        <Link to="/" className="fx-onboarding-link">
          {/* Fox emoji is allowed in auth chrome (Rule 9). */}
          <span aria-hidden="true">🦊</span>
          <span>Foxing</span>
        </Link>
        <div className="cap-stack" data-gap="4">
          <p className="fx-onboarding-caps">Step {step} of 2</p>
          <main className="cap-stack" data-gap="7">
            {children}
          </main>
        </div>
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
  const hydrated = useHydrated();
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
        <form onSubmit={(e) => void onSubmitProfile(e)} className="cap-stack" data-gap="6">
          <label className="cap-field">
            <span className="fx-onboarding-label">Username</span>
            <input
              name="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              className="cap-input fx-onboarding-input"
            />
            <span className="fx-onboarding-label-2">Letters, numbers, and underscores.</span>
          </label>

          <label className="cap-field">
            <span className="fx-onboarding-label">
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
              <legend className="fx-onboarding-label fx-onboarding-legend">
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
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p role="alert" className="cap-text" data-size="small" data-tone="crit" data-face="ui">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || !hydrated}
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
      <div className="cap-stack">
        <h1 className="fx-onboarding-title">Start your first book</h1>
        {error ? (
          <p role="alert" className="fx-onboarding-text-2">
            {error}
          </p>
        ) : null}
      </div>

      {starters.length ? (
        <ul className="fx-onboarding-grid">
          {starters.map((book) => (
            <li key={book.id} className="cap-stack" data-gap="3">
              <div className="cap-stack" data-gap="2">
                <Link to={`/books/${book.slug}`} className="group cap-stack" data-gap="4">
                  <CoverImage
                    src={book.coverUrl}
                    alt={`${book.title} by ${book.author}`}
                    fallbackLabel={book.title}
                    sizes="(min-width: 40rem) 200px, 45vw"
                  />
                  <h2 className="fx-onboarding-title-2">{book.title}</h2>
                </Link>
                <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
                  {book.author}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void startReading(book)}
                disabled={savingId !== null}
                className="cap-btn"
                data-size="sm"
                data-block
              >
                {savingId === book.id ? "Adding..." : "Start reading"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fx-onboarding-text">
          <Link to="/books" className="link">
            Browse the library
          </Link>{" "}
          to pick your first book.
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => void navigate("/home")}
          className="fx-onboarding-btn-2"
        >
          Skip for now
        </button>
      </div>
    </Frame>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
