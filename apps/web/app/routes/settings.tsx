// Account settings (auth-gated, noindex): Foxing's own profile, username, plan, visibility,
// notifications, appearance, close friends, data export and admin link, and between them the
// network's account parts (capsomer/react/sign-in-settings): the email address, passkeys, Google
// and Apple, signed-in devices, recent security activity and deleting the account.
//
// The account parts' posts (change email, sign out a device, delete) come to this route's action,
// site-runtime's accountFormAction, so they work without script and pass its checks (a recent
// sign-in, a disposable or unconfirmed address, the ticked box). Like the sign-in link's confirm
// page, these are Better Auth operations driven from the route, not /api/v1 Hono writes (rule 5);
// Foxing's own writes on this page stay /api/v1.
import { readForm } from "@dustinedwards/site-runtime/body";
import {
  accountSessions,
  passkeyLastUsed,
  passkeyRows,
  securityHistory,
  sessionIsFresh,
  signInMethods,
} from "@dustinedwards/site-runtime/sign-in";
import { accountFormAction } from "@dustinedwards/site-runtime/sign-in-form";
import {
  type ClubSuccessors,
  DomainError,
  clubsToHandOver,
  createDb,
  eraseAccountData,
  views,
} from "@foxing/core";
import {
  DeleteAccount,
  DeviceSettings,
  EmailSettings,
  PasskeySettings,
  ProviderSettings,
  SecurityHistory,
} from "capsomer/react/sign-in-settings";
import { useState } from "react";
import { Form, data, redirect, useNavigation, useRevalidator } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { getAuth } from "~/lib/auth.server";
import { requireProfile } from "~/lib/profile.server";
import { signInHref } from "~/lib/sign-in-path";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";
import {
  AdminSection,
  ClubHandoverFields,
  DataSection,
  ProfileSection,
  UsernameSection,
  successorField,
} from "../components/settings/account-sections";
import {
  AppearanceSection,
  BillingSection,
  CloseFriendsSection,
  NotificationsSection,
  VisibilitySection,
} from "../components/settings/preference-sections";

/** The fresh sign-in this page asks for: /login, flagged, coming back here. */
const SIGN_IN_AGAIN = signInHref("/settings", { reauth: true });

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile, session } = await requireProfile(env, request);
  const isPlus = profile.subscriptionTier === "plus";
  const auth = await getAuth(env);
  const db = createDb(env.DB);
  const [people, passkeys, lastUsed, accounts, devices, history, clubs] = await Promise.all([
    views.people(db, user.id),
    auth.api.listPasskeys({ headers: request.headers }),
    passkeyLastUsed(env.DB, user.id),
    auth.api.listUserAccounts({ headers: request.headers }),
    // Listing devices needs a sign-in from the last 10 minutes; past that it is null and the
    // part asks for one. Any other failure fails the page.
    accountSessions(auth, request),
    securityHistory(env.DB, user.id, 10),
    // The clubs the reader created, each handed to a member they pick if they delete the account.
    clubsToHandOver(db, user.id),
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
    // The account parts' rows, as site-runtime reads them.
    account: {
      // The address and name the password manager shows beside the passkeys (the Signal API).
      signalAs: { name: user.email, displayName: profile.displayName || undefined },
      passkeys: passkeyRows(passkeys, lastUsed),
      providers: (["google", "apple"] as const)
        .filter((id) => methods[id])
        .map((id) => ({ id, accountId: linked.get(id) ?? null })),
      devices,
      history,
      fresh: sessionIsFresh(session),
      clubs,
    },
  };
}

/** The account page's posts: an email address, a session id, or the box and the club picks. */
const FORM_LIMIT = 16 * 1024;

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  await requireProfile(env, request);
  const db = createDb(env.DB);
  const result = await accountFormAction(
    await getAuth(env),
    request,
    await readForm(request, FORM_LIMIT),
    {
      deletedLanding: "/",
      // Foxing's part of a deletion, before Better Auth's: each club the reader created goes to
      // the member they picked (or is deleted with the account), then every row of theirs, in
      // one D1 batch, so a refused pick leaves nothing half-done (core eraseAccountData).
      beforeDelete: async (user, form) => {
        const successors: ClubSuccessors = {};
        for (const club of await clubsToHandOver(db, user.id)) {
          const picked = form.get(successorField(club.clubId));
          if (club.candidates.length === 0 || typeof picked !== "string") continue;
          successors[club.clubId] = picked === "" ? null : picked;
        }
        try {
          await eraseAccountData(db, user.id, successors);
          return null;
        } catch (err) {
          if (err instanceof DomainError) return err.message;
          throw err;
        }
      },
    },
  );
  // Every post on this page is one of the account parts'.
  if (result === null) throw new Response("Bad Request", { status: 400 });
  if ("location" in result) throw redirect(result.location, { headers: result.headers });
  return data(result.state, { status: result.status });
}

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export function meta() {
  return [{ title: "Settings | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { account } = loaderData;
  const state = actionData ?? null;
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const posting = navigation.formMethod === "POST" ? navigation.formData : undefined;
  const intent = posting?.get("intent");
  const shared = { signInAgainHref: SIGN_IN_AGAIN, revalidate: () => revalidator.revalidate() };
  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Account" title="Settings" />
        <div className="stack-8">
          <ProfileSection initial={loaderData} />
          <UsernameSection initial={loaderData.username} />
          <EmailSettings
            email={loaderData.email}
            state={state}
            pending={intent === "change-email"}
            signInAgainHref={SIGN_IN_AGAIN}
            Form={Form}
          />
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
          <PasskeySettings
            {...shared}
            client={authClient}
            passkeys={account.passkeys}
            signalAs={account.signalAs}
          />
          <ProviderSettings
            {...shared}
            client={authClient}
            providers={account.providers}
            callbackURL="/settings"
          />
          <DeviceSettings
            {...shared}
            client={authClient}
            devices={account.devices}
            state={state}
            pendingSession={
              intent === "sign-out-device" ? String(posting?.get("session") ?? "") : null
            }
            Form={Form}
          />
          <SecurityHistory history={account.history} />
          <DataSection fresh={account.fresh} signInAgainHref={SIGN_IN_AGAIN} />
          {loaderData.isAdmin ? <AdminSection /> : null}
          <DeleteAccount
            fresh={account.fresh}
            consequence="This removes your account and all of your data for good: your profile, library, reading history, highlights, notes and goals."
            fields={<ClubHandoverFields clubs={account.clubs} />}
            state={state}
            pending={intent === "delete-account"}
            signInAgainHref={SIGN_IN_AGAIN}
            Form={Form}
          />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
