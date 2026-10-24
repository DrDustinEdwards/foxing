import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PING_FRAME, PONG_FRAME } from "@foxing/types";
import type { ClubRoom } from "../workers/club-room";

// The ClubRoom must register the keepalive pair with the runtime so an idle room
// hibernates through pings. The runtime matches the request frame byte for byte, so
// the pair has to be the exact frame the browser hook sends.
describe("ClubRoom keepalive", () => {
  it("answers the client's exact ping frame with a runtime pong", async () => {
    const ns = (env as unknown as { CLUB_ROOM: DurableObjectNamespace<ClubRoom> }).CLUB_ROOM;
    const pair = await runInDurableObject(ns.getByName("club-keepalive"), (_room, state) =>
      state.getWebSocketAutoResponse(),
    );

    expect(pair).not.toBeNull();
    expect(pair?.request).toBe(PING_FRAME);
    expect(pair?.response).toBe(PONG_FRAME);
    expect(JSON.parse(PING_FRAME)).toEqual({ t: "ping" });
    expect(JSON.parse(PONG_FRAME)).toEqual({ t: "pong" });
  });
});
