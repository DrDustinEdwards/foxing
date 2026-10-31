// Account settings (auth-gated, noindex): profile fields, plan, visibility, appearance,
// close friends, sign-in (passkeys, Google and Apple), signed-in devices, data export, and
// account deletion. Every write shows a visible pending + role=alert error, never a silent no-op.
import {
  accountSessions,
  passkeyLabel,
  revokeSessionById,
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
  const [people, passkeys, accounts, sessions] = await Promise.all([
    views.people(createDb(env.DB), user.id),
    auth.api.listPasskeys({ headers: request.headers }),
    auth.api.listUserAccounts({ headers: request.headers }),
    // Listing sessions needs a sign-in from the last 10 minutes; past that it is null and the
    // section asks for one. Any other failure fails the page.
    accountSessions(auth, request),
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
      // Named by the reader, else by the password manager or device that holds it.
      passkeys: passkeys.map((p) => ({
        id: p.id,
        credentialId: p.credentialID,
        name: passkeyLabel(p),
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      })),
      providers: [
        ...(methods.google
          ? [{ id: "google" as const, label: "Google", accountId: linked.get("google") ?? null }]
          : []),
        ...(methods.apple
          ? [{ id: "apple" as const, label: "Apple", accountId: linked.get("apple") ?? null }]
          : []),
      ],
    },
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
  const id = String((await request.formData()).get("session") ?? "");
  try {
    return { revoked: await revokeSessionById(await getAuth(env), request, id) };
  } catch (err) {
    if ((err as { body?: { code?: string } }).body?.code !== "SESSION_NOT_FRESH") throw err;
    throw redirect("/login?next=%2Fsettings");
  }
}

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

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
          <DataSection />
          {loaderData.isAdmin ? <AdminSection /> : null}
          <DangerSection />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
