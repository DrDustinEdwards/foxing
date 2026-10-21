// Account settings (auth-gated, noindex): profile fields, plan, visibility, appearance,
// close friends, password, data export, and account deletion. Every write shows a visible
// pending + role=alert error, never a silent no-op.
import { pushDomain } from "@foxing/core";
import { useState } from "react";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import { loadCloseFriends } from "~/lib/social.server";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";
import {
  AdminSection,
  DangerSection,
  DataSection,
  EmailSection,
  PasswordSection,
  ProfileSection,
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
  const closeFriends = await loadCloseFriends(env, user.id);
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
          <PasswordSection />
          <DataSection />
          {loaderData.isAdmin ? <AdminSection /> : null}
          <DangerSection />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}
