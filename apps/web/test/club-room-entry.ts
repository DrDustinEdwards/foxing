// Test-only Worker entry: the pool runs Durable Objects from the main module, so this
// re-exports the real ClubRoom class for the CLUB_ROOM binding in vitest.config.ts.
export { ClubRoom } from "../workers/club-room";

export default {
  fetch(): Response {
    return new Response("test entry", { status: 404 });
  },
};
