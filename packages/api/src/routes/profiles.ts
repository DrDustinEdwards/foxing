// Profiles: the one resource wired end to end in Phase 1 (GET /me, PATCH /me,
// GET /u/:username) plus onboarding, which fires the profile.onboarded emission.
// Handlers stay thin: validate, call a core function, return.
import { Hono } from "hono";
import {
  onboardInput,
  onboardProfile,
  profilesRepo,
  updateMeInput,
  visibilityPrefsInput,
} from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const profileRoutes = new Hono<Env>();

// GET /me - the Phase 1 round-trip gate: web -> api -> core -> D1.
profileRoutes.get("/me", (c) => {
  const session = requireSession(c);
  return c.json({ user: session, profile: c.get("profile") });
});

// POST /me/onboard - creates the profile row and emits profile.onboarded.
profileRoutes.post("/me/onboard", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (c.get("profile")) throw errors.conflict("Already onboarded.");
  const input = await parseJson(c, onboardInput);
  const taken = await profilesRepo.getProfileByUsername(c.get("db"), input.username);
  if (taken) throw errors.conflict("That username is taken.");
  const profile = await onboardProfile(c.get("db"), session.id, input);
  return c.json({ profile }, 201);
});

// PATCH /me - update the current user's profile.
profileRoutes.patch("/me", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your profile.");
  const patch = await parseJson(c, updateMeInput);
  const profile = await profilesRepo.updateProfile(c.get("db"), session.id, patch);
  return c.json({ profile });
});

// PATCH /me/visibility - set the profile/progress/default-annotation visibility prefs.
profileRoutes.patch("/me/visibility", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your settings.");
  const prefs = await parseJson(c, visibilityPrefsInput);
  await profilesRepo.setVisibilityPrefs(c.get("db"), session.id, prefs);
  return c.json({ ok: true });
});

// GET /u/:username - public, visibility-aware projection.
profileRoutes.get("/u/:username", async (c) => {
  const profile = await profilesRepo.getProfileByUsername(c.get("db"), c.req.param("username"));
  if (!profile) throw errors.notFound("Profile not found.");
  return c.json({ profile: profilesRepo.toPublicProfile(profile) });
});
