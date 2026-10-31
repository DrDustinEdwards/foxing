// Test-only Worker entry: the pool runs Durable Objects from the main module, so this
// re-exports the real ClubRoom class for the CLUB_ROOM binding in vitest.config.ts, and
// site-runtime's RateLimiter for RATE_LIMITER (sign-in's code limiter refuses without it).
export { ClubRoom } from "../workers/club-room";
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

export default {
  fetch(): Response {
    return new Response("test entry", { status: 404 });
  },
};
