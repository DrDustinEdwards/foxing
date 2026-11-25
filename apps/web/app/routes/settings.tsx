// Account settings (auth-gated, noindex). Every write shows a visible pending state and a role=alert error.
import { readCapped } from "@dustinedwards/site-runtime/body";
import { securityHistoryWords } from "@dustinedwards/site-runtime/sign-in-words";
import {
  accountSessions,
  passkeyLastUsed,
  passkeyRows,
  revokeSessionById,
  securityHistory,
  signInMethods,
} from "@dustinedwards/site-runtime/sign-in";
import { billing, createDb, views } from "@foxing/core";
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
import { signInHref } from "~/lib/sign-in-path";
import { noindexMeta } from "~/lib/seo";

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
    // Listing sessions needs a sign-in from the last 10 minutes; past that it is null and the section asks for one.
    accountSessions(auth, request),
    securityHistory(env.DB, user.id, 10),
  ]);
  const methods = signInMethods(env, { social: true });
  const linked = new Map(accounts.map((a) => [a.providerId, a.id]));
  const { visibility, notificationPrefs } = views.myProfile(profile);
  return {
    username: profile.username,
    userId: user.id,
    email: user.email,
    isAdmin: Boolean(profile.isAdmin),
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    favoriteGenres: (profile.favoriteGenres ?? []).join(", "),
    tier: isPlus ? ("plus" as const) : ("free" as const),
    canUpgrade: !isPlus && billing.stripeSettings(env) !== null,
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
      userId: user.id,
      email: user.email,
      displayName: profile.displayName ?? "",
      passkeys: passkeyRows(passkeys, lastUsed).map((p) => ({
        id: p.id,
        credentialId: passkeys.find((raw) => raw.id === p.id)?.credentialID ?? "",
        name: p.name,
        provider: p.provider,
        created: p.createdAt ? dateLabel.format(p.createdAt) : null,
        lastUsed: p.lastUsedAt ? dateLabel.format(p.lastUsedAt) : null,
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
    activity: history.map((h) => ({
      what: securityHistoryWords(h),
      when: `${dateTimeLabel.format(h.at)} UTC`,
      device: h.device,
      location: h.location,
    })),
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

// Signs another device out by session id, so no session token reaches the page; a Better Auth write, not /api/v1.
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireProfile(env, request);
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
    throw redirect(signInHref("/settings"));
  }
}

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const dateTimeLabel = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function meta() {
  return noindexMeta("Settings | Foxing");
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  return (
    <PageShell>
      <Container>
        <PageHeader title="Settings" />
        <div className="cap-stack" data-gap="7">
          <ProfileSection initial={loaderData} />
          <UsernameSection initial={loaderData.username} />
          <EmailSection initial={loaderData.email} />
          <BillingSection
            tier={loaderData.tier}
            status={loaderData.subscriptionStatus}
            periodEndLabel={loaderData.periodEndLabel}
            onUpgrade={loaderData.canUpgrade ? () => setPaywallOpen(true) : null}
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
      {loaderData.canUpgrade ? (
        <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
      ) : null}
    </PageShell>
  );
}

export const handle = { hydrate: true };
