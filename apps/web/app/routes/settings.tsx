// Account settings (auth-gated, noindex): profile fields, plan, visibility, appearance,
// close friends, sign-in (passkeys, Google and Apple), signed-in devices, data export, and
// account deletion. Every write shows a visible pending + role=alert error, never a silent no-op.
import { readCapped } from "@dustinedwards/site-runtime/body";
import {
  accountSessions,
  needsSecondPasskey,
  passkeyLastUsed,
  passkeyRows,
  revokeSessionById,
  securityHistory,
  type SecurityHistoryEntry,
  signInMethods,
} from "@dustinedwards/site-runtime/sign-in";
import { createDb, views } from "@foxing/core";
import { useState } from "react";
import { redirect } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfile } from "~/lib/profile.server";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";
import {
  AdminSection,
  DangerSection,
  DataSection,
  EmailSection,
  ProfileSection,
  SecurityHistorySection,
  SessionsSection,
  SignInSection,
  UsernameSection,
} from "../components/settings/account-sections";
import {
  AppearanceSection,
  BillingSection,
  CloseFriendsSection,
  NotificationsSection,
  VisibilitySection,
} from "../components/settings/preference-sections";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const isPlus = profile.subscriptionTier === "plus";
  const auth = await getAuth(env);
  const [people, passkeys, lastUsed, accounts, sessions, history] = await Promise.all([
    views.people(createDb(env.DB), user.id),
    auth.api.listPasskeys({ headers: request.headers }),
    passkeyLastUsed(env.DB, user.id),
    auth.api.listUserAccounts({ headers: request.headers }),
    // Listing sessions needs a sign-in from the last 10 minutes; past that it is null and the
    // section asks for one. Any other failure fails the page.
    accountSessions(auth, request),
    securityHistory(env.DB, user.id, 10),
  ]);
  const methods = signInMethods(env, { social: true });
  // The joined account's own id, which Disconnect names.
  const linked = new Map(accounts.map((a) => [a.providerId, a.id]));
  // The same resolved visibility and push switches GET /me sends the mobile app.
  const { visibility, notificationPrefs } = views.myProfile(profile);
  return {
    username: profile.username,
    email: user.email,
    isAdmin: Boolean(profile.isAdmin),
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    favoriteGenres: (profile.favoriteGenres ?? []).join(", "),
    tier: isPlus ? ("plus" as const) : ("free" as const),
    subscriptionStatus: profile.subscriptionStatus,
    periodEndLabel: profile.subscriptionPeriodEnd
      ? dateLabel.format(profile.subscriptionPeriodEnd)
      : null,
    visibility: visibility as Required<typeof visibility>,
    people,
    notifications: {
      categories: notificationPrefs.categories ?? {},
      quietHours: notificationPrefs.quietHours ?? null,
    },
    signIn: {
      email: user.email,
      displayName: profile.displayName ?? "",
      // site-runtime's accountPasskeys rows (name, provider, created, last used), kept with each
      // passkey's credential id so a removed one can be signaled to the password manager.
      passkeys: passkeyRows(passkeys, lastUsed).map((p) => ({
        id: p.id,
        credentialId: passkeys.find((raw) => raw.id === p.id)?.credentialID ?? "",
        name: p.name,
        provider: p.provider,
        created: p.createdAt ? dateLabel.format(p.createdAt) : null,
        lastUsed: p.lastUsedAt ? dateLabel.format(p.lastUsedAt) : null,
      })),
      secondPasskey: needsSecondPasskey(passkeys),
      providers: [
        ...(methods.google
          ? [{ id: "google" as const, label: "Google", accountId: linked.get("google") ?? null }]
          : []),
        ...(methods.apple
          ? [{ id: "apple" as const, label: "Apple", accountId: linked.get("apple") ?? null }]
          : []),
      ],
    },
    activity: history.map((h) => ({
      what: activityLabel(h),
      when: `${dateTimeLabel.format(h.at)} UTC`,
      device: h.device,
      location: h.location,
    })),
    // This device first, then the most recently active.
    sessions: sessions
      ? sessions.map((row) => ({
          id: row.id,
          device: row.device ?? "Unknown device",
          location: row.location,
          current: row.current,
          signedIn: dateLabel.format(row.signedInAt),
          lastActive: dateLabel.format(row.lastActiveAt),
        }))
      : null,
  };
}

// Signs another device out by its session id, so no session token reaches the page (site-runtime
// ./sign-in). A Better Auth write, like the sign-in link's confirm page, not a /api/v1 one.
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireProfile(env, request);
  // The form is one session id, read to a ceiling (site-runtime ./body), never the platform's uncapped formData().
  const form = await readCapped(request, 4 * 1024);
  if (form === null)
    throw new Response("Payload Too Large", {
      status: 413,
      headers: { "Cache-Control": "no-store" },
    });
  const id = new URLSearchParams(form).get("session") ?? "";
  try {
    return { revoked: await revokeSessionById(await getAuth(env), request, id) };
  } catch (err) {
    if ((err as { body?: { code?: string } }).body?.code !== "SESSION_NOT_FRESH") throw err;
    throw redirect("/login?next=%2Fsettings");
  }
}

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const dateTimeLabel = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const WAY_IN: Record<string, string> = {
  link: "an email link",
  code: "an email code",
  passkey: "a passkey",
  google: "Google",
  apple: "Apple",
};

/** One line of the security history, in plain words. */
function activityLabel({ kind, via }: SecurityHistoryEntry): string {
  const way = via ? (WAY_IN[via] ?? via) : null;
  switch (kind) {
    case "sign-in":
      return way ? `Signed in with ${way}` : "Signed in";
    case "passkey-added":
      return "Passkey added";
    case "passkey-removed":
      return "Passkey removed";
    case "sign-in-linked":
      return way ? `${way} connected` : "Sign-in method connected";
    case "sign-in-unlinked":
      return way ? `${way} disconnected` : "Sign-in method disconnected";
    case "email-changed":
      return "Email changed";
    case "recovery":
      return "Signed in by email with no passkey left; other devices signed out";
  }
}

export function meta() {
  return [{ title: "Settings | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Account" title="Settings" />
        <div className="stack-8">
          <ProfileSection initial={loaderData} />
          <UsernameSection initial={loaderData.username} />
          <EmailSection initial={loaderData.email} />
          <BillingSection
            tier={loaderData.tier}
            status={loaderData.subscriptionStatus}
            periodEndLabel={loaderData.periodEndLabel}
            onUpgrade={() => setPaywallOpen(true)}
          />
          <VisibilitySection initial={loaderData.visibility} />
          <NotificationsSection initial={loaderData.notifications} />
          <AppearanceSection />
          <CloseFriendsSection people={loaderData.people} />
          <SignInSection initial={loaderData.signIn} />
          <SessionsSection sessions={loaderData.sessions} />
          <SecurityHistorySection activity={loaderData.activity} />
          <DataSection fresh={loaderData.sessions !== null} />
          {loaderData.isAdmin ? <AdminSection /> : null}
          {/* No session list means no sign-in in the last 10 minutes. */}
          <DangerSection fresh={loaderData.sessions !== null} />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
