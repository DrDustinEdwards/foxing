// Account hooks: the reader's own profile and settings, onboarding, billing and
// account deletion. Every write refetches "me" and the reader's public profile.
import type * as W from "@foxing/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { qs } from "./http";
import { keys } from "./keys";
import { useApi } from "./provider";
import { patch, useSeededQuery, useWrite } from "./query";

export function useMe<S extends W.Me | undefined = undefined>(seed?: S, enabled = true) {
  const api = useApi();
  return useSeededQuery({ queryKey: keys.me, queryFn: () => api.get<W.Me>("/me"), enabled }, seed);
}

function patchMe(update: (p: W.MyProfile) => W.MyProfile) {
  return patch<W.Me>(keys.me, (me) => (me.profile ? { ...me, profile: update(me.profile) } : me));
}

export interface ProfileFields {
  displayName?: string | null;
  bio?: string | null;
  favoriteGenres?: string[];
  avatarUrl?: string | null;
  backdropUrl?: string | null;
  timezone?: string | null;
}

export function useUpdateMe() {
  const api = useApi();
  return useWrite<ProfileFields>({
    write: (fields) => api.patch("/me", { ...fields }),
    optimistic: (fields) => [patchMe((p) => ({ ...p, ...fields }))],
    invalidates: () => [keys.me, keys.profiles],
  });
}

export function useOnboard() {
  const api = useApi();
  return useWrite<{
    username: string;
    displayName?: string;
    timezone?: string;
    favoriteGenres?: string[];
  }>({
    write: (input) => api.post("/me/onboard", input),
    invalidates: () => [keys.me],
  });
}

/** Debounced availability of a username the reader is typing; null until it settles. */
export function useUsernameAvailable(name: string, enabled: boolean, delayMs = 400) {
  const api = useApi();
  const [term, setTerm] = useState(name);
  useEffect(() => {
    const t = setTimeout(() => setTerm(name), delayMs);
    return () => clearTimeout(t);
  }, [name, delayMs]);
  const settled = enabled && term === name;
  const { data } = useQuery({
    queryKey: keys.usernameAvailable(term),
    queryFn: ({ signal }) =>
      api.get<{ available: boolean }>(`/me/username-available${qs({ username: term })}`, signal),
    enabled: settled,
  });
  return settled && data ? data.available : null;
}

export function useChangeUsername() {
  const api = useApi();
  return useWrite<{ username: string }>({
    write: (input) => api.patch("/me/username", input),
    optimistic: ({ username }) => [patchMe((p) => ({ ...p, username }))],
    invalidates: () => [keys.me, keys.profiles],
  });
}

export function useSetVisibility() {
  const api = useApi();
  return useWrite<Required<W.MyProfile["visibility"]>>({
    write: (prefs) => api.patch("/me/visibility", prefs),
    optimistic: (visibility) => [patchMe((p) => ({ ...p, visibility }))],
    invalidates: () => [keys.me, keys.profiles],
  });
}

export function useSetNotificationPrefs() {
  const api = useApi();
  return useWrite<{
    categories: Record<string, boolean>;
    quietHours: { start: string; end: string } | null;
  }>({
    write: (prefs) => api.patch("/me/notification-prefs", prefs),
    optimistic: ({ categories, quietHours }) => [
      patchMe((p) => ({
        ...p,
        notificationPrefs: { categories, ...(quietHours ? { quietHours } : {}) },
      })),
    ],
    invalidates: () => [keys.me],
  });
}

// --- Billing ----------------------------------------------------------------

/** Both answer with a Stripe URL to send the reader to. */
export function useCheckout() {
  const api = useApi();
  return useWrite<{ plan: "monthly" | "annual" }, { url: string }>({
    write: (input) => api.post("/billing/checkout", input),
  });
}

export function useBillingPortal() {
  const api = useApi();
  return useWrite<void, { url: string }>({ write: () => api.post("/billing/portal") });
}

// --- Account ----------------------------------------------------------------

export function useAccountClubs() {
  const api = useApi();
  return useQuery({
    queryKey: keys.accountClubs,
    queryFn: () => api.get<{ clubs: W.ClubHandover[] }>("/account/clubs").then((r) => r.clubs),
  });
}

/** successors maps each club the reader created to the member taking it over, or null
 *  to delete it. The caller signs out and leaves once this resolves. */
export function useDeleteAccount() {
  const api = useApi();
  return useWrite<{ successors: Record<string, string | null> }>({
    write: (input) => api.delete("/account", input),
  });
}
