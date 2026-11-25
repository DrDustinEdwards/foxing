// Profile and onboarding routes; onboarding fires the profile.onboarded emission.
import { Hono } from "hono";
import {
  isUniqueViolation,
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

/** The loser of a username race hits the unique index: that is the same 409 as a name seen taken. */
function usernameRace(err: unknown): never {
  throw isUniqueViolation(err) ? errors.conflict("That username is taken.") : err;
}

profileRoutes.get("/me", (c) => {
  const session = requireSession(c);
  return c.json(views.me(session, c.get("profile")));
});

profileRoutes.get("/me/onboarding", async (c) => {
  requireSession(c);
  return c.json(await views.onboarding(c.get("db")));
});

profileRoutes.post("/me/onboard", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (c.get("profile")) throw errors.conflict("Already onboarded.");
  const input = await parseJson(c, onboardInput);
  const taken = await profilesRepo.getProfileByUsername(c.get("db"), input.username);
  if (taken) throw errors.conflict("That username is taken.");
  const profile = await onboardProfile(c.get("db"), session.id, input).catch(usernameRace);
  return c.json({ profile: views.myProfile(profile) }, 201);
});

profileRoutes.patch("/me", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your profile.");
  const patch = await parseJson(c, updateMeInput);
  const profile = await profilesRepo.updateProfile(c.get("db"), session.id, patch);
  return c.json({ profile: profile && views.myProfile(profile) });
});

// Session-gated so it is not an open enumeration endpoint; the user's own username counts as available.
profileRoutes.get("/me/username-available", async (c) => {
  requireSession(c);
  const parsed = usernameSchema.safeParse(c.req.query("username") ?? "");
  if (!parsed.success) return c.json({ available: false });
  const existing = await profilesRepo.getProfileByUsername(c.get("db"), parsed.data);
  const mine = c.get("profile")?.username;
  return c.json({ available: !existing || existing.username === mine });
});

profileRoutes.patch("/me/username", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your profile.");
  const { username } = await parseJson(c, z.object({ username: usernameSchema }));
  const existing = await profilesRepo.getProfileByUsername(c.get("db"), username);
  if (existing && existing.id !== session.id) throw errors.conflict("That username is taken.");
  const profile = await profilesRepo
    .updateUsername(c.get("db"), session.id, username)
    .catch(usernameRace);
  return c.json({ profile: profile && views.myProfile(profile) });
});

profileRoutes.patch("/me/visibility", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  if (!c.get("profile")) throw errors.notFound("Onboard before editing your settings.");
  const prefs = await parseJson(c, visibilityPrefsInput);
  await profilesRepo.setVisibilityPrefs(c.get("db"), session.id, prefs);
  return c.json({ ok: true });
});

// A non-public profile shows only enough identity to confirm the account exists, to everyone but its owner.
profileRoutes.get("/u/:username", async (c) => {
  const page = await views.profilePage(
    c.get("db"),
    c.req.param("username"),
    c.get("session")?.id ?? null,
  );
  if (!page) throw errors.notFound("Profile not found.");
  return c.json(page);
});
