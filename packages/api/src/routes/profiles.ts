// Profiles: the one resource wired end to end in Phase 1 (GET /me, PATCH /me,
// GET /u/:username) plus onboarding, which fires the profile.onboarded emission.
// Handlers stay thin: validate, call a core function, return.
import { Hono } from "hono";
import {
  onboardInput,
  onboardProfile,
  profilesRepo,
  updateMeInput,
  username as usernameSchema,
  visibilityPrefsInput,
  views,
} from "@foxing/core";
import { z } from "zod";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const profileRoutes = new Hono<Env>();

// GET /me - the reader's account; profile is null until onboarding.
profileRoutes.get("/me", (c) => {
  const session = requireSession(c);
  return c.json(views.me(session, c.get("profile")));
});

// GET /me/onboarding - the starter books and genres the first-run flow offers.
profileRoutes.get("/me/onboarding", async (c) => {
  requireSession(c);
  return c.json(await views.onboarding(c.get("db")));
});

// POST /me/onboard - creates the profile row and emits profile.onboarded.
profileRoutes.post("/me/onboard", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (c.get("profile")) throw errors.conflict("Already onboarded.");
  const input = await parseJson(c, onboardInput);
  const taken = await profilesRepo.getProfileByUsername(c.get("db"), input.username);
  if (taken) throw errors.conflict("That username is taken.");
  const profile = await onboardProfile(c.get("db"), session.id, input);
  return c.json({ profile: views.myProfile(profile) }, 201);
});

// PATCH /me - update the current user's profile.
profileRoutes.patch("/me", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your profile.");
  const patch = await parseJson(c, updateMeInput);
  const profile = await profilesRepo.updateProfile(c.get("db"), session.id, patch);
  return c.json({ profile: profile && views.myProfile(profile) });
});

// GET /me/username-available?username=foo - live availability check for the username
// picker. Session-gated so it is not an open enumeration endpoint. The user's own
// current username counts as available.
profileRoutes.get("/me/username-available", async (c) => {
  requireSession(c);
  const parsed = usernameSchema.safeParse(c.req.query("username") ?? "");
  if (!parsed.success) return c.json({ available: false });
  const existing = await profilesRepo.getProfileByUsername(c.get("db"), parsed.data);
  const mine = c.get("profile")?.username;
  return c.json({ available: !existing || existing.username === mine });
});

// PATCH /me/username - change the current user's username (unique, format-checked).
profileRoutes.patch("/me/username", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your profile.");
  const { username } = await parseJson(c, z.object({ username: usernameSchema }));
  const existing = await profilesRepo.getProfileByUsername(c.get("db"), username);
  if (existing && existing.id !== session.id) throw errors.conflict("That username is taken.");
  const profile = await profilesRepo.updateUsername(c.get("db"), session.id, username);
  return c.json({ profile: profile && views.myProfile(profile) });
});

// PATCH /me/visibility - set the profile/progress/default-annotation visibility prefs.
profileRoutes.patch("/me/visibility", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your settings.");
  const prefs = await parseJson(c, visibilityPrefsInput);
  await profilesRepo.setVisibilityPrefs(c.get("db"), session.id, prefs);
  return c.json({ ok: true });
});

// GET /u/:username - the profile page, visibility-aware. A non-public profile shows
// only enough identity to confirm the account exists, to everyone but its owner: the
// same view the web page renders (Grok audit 2026-10-21, FX-2).
profileRoutes.get("/u/:username", async (c) => {
  const page = await views.profilePage(
    c.get("db"),
    c.req.param("username"),
    c.get("session")?.id ?? null,
  );
  if (!page) throw errors.notFound("Profile not found.");
  return c.json(page);
});
