// Account settings (auth-gated, noindex): profile fields, plan, visibility, appearance,
// close friends, sign-in (passkeys, Google and Apple), data export, and account deletion. Every write shows a visible
// pending + role=alert error, never a silent no-op.
import { getAuthenticatorName } from "@better-auth/passkey";
import { signInMethods } from "@dustinedwards/site-runtime/sign-in";
import { pushDomain } from "@foxing/core";
import { useState } from "react";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfile } from "~/lib/profile.server";
import { loadCloseFriends } from "~/lib/social.server";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";
import {
  AdminSection,
  DangerSection,
  DataSection,
  EmailSection,
  ProfileSection,
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
  const vis = profile.visibility ?? {};
  const auth = await getAuth(env);
  const [closeFriends, passkeys, accounts] = await Promise.all([
    loadCloseFriends(env, user.id),
    auth.api.listPasskeys({ headers: request.headers }),
    auth.api.listUserAccounts({ headers: request.headers }),
  ]);
  const methods = signInMethods(env, { social: true });
  // The joined account's own id, which Disconnect names.
  const linked = new Map(accounts.map((a) => [a.providerId, a.id]));
  // Effective notification prefs: each category's stored override, or its quiet default.
  const notifPrefs = profile.notificationPrefs ?? null;
  const notifications = {
    categories: Object.fromEntries(
      pushDomain.PUSH_CATEGORIES.map((cat) => [cat, pushDomain.categoryEnabled(cat, notifPrefs)]),
    ) as Record<(typeof pushDomain.PUSH_CATEGORIES)[number], boolean>,
    quietHours: notifPrefs?.quietHours ?? null,
  };
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
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
          profile.subscriptionPeriodEnd,
        )
      : null,
    visibility: {
      profile: vis.profile === "private" ? ("private" as const) : ("public" as const),
      progress: vis.progress === "private" ? ("private" as const) : ("public" as const),
      defaultAnnotation:
        vis.defaultAnnotation === "friends"
          ? ("friends" as const)
          : vis.defaultAnnotation === "public"
            ? ("public" as const)
            : ("private" as const),
    },
    closeFriends: closeFriends.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName ?? p.username,
      avatarUrl: p.avatarUrl,
    })),
    notifications,
    signIn: {
      // Named by the reader, else by the password manager or device that holds it.
      passkeys: passkeys.map((p) => ({
        id: p.id,
        name: p.name || getAuthenticatorName(p.aaguid) || "Passkey",
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
  };
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
          <CloseFriendsSection friends={loaderData.closeFriends} />
          <SignInSection initial={loaderData.signIn} />
          <DataSection />
          {loaderData.isAdmin ? <AdminSection /> : null}
          <DangerSection />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}
