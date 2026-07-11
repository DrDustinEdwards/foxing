// Account settings (auth-gated, noindex). Scope is deliberately four things and
// nothing else: profile fields, password change, data export, and account deletion.
// Visibility / appearance / close-friends settings arrive with their own slices.
// Every write shows a visible pending + role=alert error, never a silent no-op.
import { useState } from "react";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { requireProfile } from "~/lib/profile.server";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { profile } = await requireProfile(env, request);
  return {
    username: profile.username,
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    favoriteGenres: (profile.favoriteGenres ?? []).join(", "),
    tier: profile.subscriptionTier === "plus" ? ("plus" as const) : ("free" as const),
    subscriptionStatus: profile.subscriptionStatus,
    periodEndLabel: profile.subscriptionPeriodEnd
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(profile.subscriptionPeriodEnd)
      : null,
  };
}

export function meta() {
  return [{ title: "Settings | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <PageHeader eyebrow="Account" title="Settings" />
        <div className="space-y-8">
          <ProfileSection initial={loaderData} />
          <BillingSection
            tier={loaderData.tier}
            status={loaderData.subscriptionStatus}
            periodEndLabel={loaderData.periodEndLabel}
            onUpgrade={() => setPaywallOpen(true)}
          />
          <PasswordSection />
          <DataSection />
          <DangerSection />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

function BillingSection({
  tier,
  status,
  periodEndLabel,
  onUpgrade,
}: {
  tier: "free" | "plus";
  status: string | null;
  periodEndLabel: string | null;
  onUpgrade: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPlus = tier === "plus";

  async function manage() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (res.ok && body?.url) {
        window.location.assign(body.url);
        return;
      }
      setError(body?.error?.message ?? `Could not open billing (${res.status}).`);
    } catch {
      setError("Could not reach billing. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Plan">
      {isPlus ? (
        <div className="space-y-3">
          <p className="font-ui text-sm text-secondary">
            You are on <span className="font-medium text-primary">Foxing Plus</span>
            {status ? ` (${status})` : ""}.
            {periodEndLabel ? ` Renews ${periodEndLabel}.` : ""}
          </p>
          <button
            type="button"
            onClick={manage}
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Opening..." : "Manage billing"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-ui text-sm text-secondary">
            You are on the <span className="font-medium text-primary">Free</span> plan. Plus adds
            the AI reading companion, unlimited clubs, and more.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-md bg-brand-ui px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:opacity-90"
          >
            Upgrade to Plus
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-6">
      <h2 className="font-display text-xl text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputClass =
  "w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary";

function ProfileSection({ initial }: { initial: { displayName: string; bio: string; favoriteGenres: string } }) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [genres, setGenres] = useState(initial.favoriteGenres);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          favoriteGenres: genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setError("Could not save your profile. Try again.");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Could not save your profile. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Profile">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">
            Favorite genres (comma separated)
          </span>
          <input
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save profile"}
          </button>
          {status === "saved" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Saved.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"changed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Could not change your password.");
        return;
      }
      setStatus("changed");
      setCurrent("");
      setNext("");
    } catch {
      setError("Could not change your password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Password">
      <form onSubmit={change} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Current password</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">New password</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Changing..." : "Change password"}
          </button>
          {status === "changed" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Password changed.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function DataSection() {
  return (
    <Card title="Your data">
      <p className="font-ui text-sm text-secondary">
        Download a JSON archive of everything tied to your account: your profile, library,
        reading history, highlights, notes, and goals.
      </p>
      <a
        href="/api/v1/account/export"
        className="mt-4 inline-flex rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
      >
        Download your data
      </a>
    </Card>
  );
}

const CONFIRM_PHRASE = "delete my account";

function DangerSection() {
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete your account. Try again.");
        setPending(false);
        return;
      }
      // The account and its data are gone; end the session and return to the marketing
      // page with a full navigation so the root loader re-runs anonymous.
      await authClient.signOut();
      window.location.assign("/");
    } catch {
      setError("Could not delete your account. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <section className="rounded-card border border-error/40 bg-surface p-6">
      <h2 className="font-display text-xl text-error">Delete account</h2>
      <p className="mt-4 font-ui text-sm text-secondary">
        This permanently removes your account and all of your data. It cannot be undone. Type
        <span className="font-medium text-primary"> {CONFIRM_PHRASE} </span>
        to confirm.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        placeholder={CONFIRM_PHRASE}
        className={`${inputClass} mt-4`}
      />
      <div className="mt-4">
        <button
          type="button"
          onClick={remove}
          disabled={pending || confirm.trim().toLowerCase() !== CONFIRM_PHRASE}
          className="rounded-md border border-error px-4 py-2 font-ui text-sm text-error hover:bg-error/10 disabled:opacity-40"
        >
          {pending ? "Deleting..." : "Delete my account"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
