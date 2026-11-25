// ClubRoom: the live layer for ONE book club, one Durable Object per club (idFromName(clubId)), so a broadcast can never
// reach another club.
// INVARIANT: fan-out ONLY. It never writes D1: every mutation goes through the HTTP API, which commits to D1 first and
// then calls broadcast() here, so this object holds no truth to drift.
// Uses the Hibernation API: presence is recomputed from ctx.getWebSockets() (attachments survive hibernation).
import { logEvent } from "@dustinedwards/site-runtime/log";
import { DurableObject } from "cloudflare:workers";
import type { ClubLiveHub } from "@foxing/api";
import type { LiveMessage } from "@foxing/core";
import { PING_FRAME, PONG_FRAME } from "@foxing/types";

type Attachment = { userId: string };

type ServerMessage = LiveMessage | { t: "presence"; users: string[] } | { t: "pong" };

export class ClubRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    // The runtime answers the keepalive ping itself so an idle room stays hibernated; webSocketMessage still answers a non-matching ping.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME));
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }
    // The API forwards the user id on the URL: a query param survives new Request(url, req) where headers are awkward.
    const userId = new URL(request.url).searchParams.get("uid");
    if (!userId) return new Response("Missing user.", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId } satisfies Attachment);

    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    try {
      const parsed = JSON.parse(message) as { t?: string };
      if (parsed.t === "ping") this.send(ws, { t: "pong" });
    } catch (error) {
      // The client contract is {t:'ping'} only, so a frame that is not JSON is a client fault: log it, answer nothing.
      logEvent("club_room_bad_frame", { error }, { level: "warn" });
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  /** RPC: fan a committed write out to every socket in this club's room (called after the D1 commit). */
  async broadcast(message: LiveMessage | LiveMessage[]): Promise<void> {
    const messages = Array.isArray(message) ? message : [message];
    for (const ws of this.ctx.getWebSockets()) {
      for (const m of messages) this.send(ws, m);
    }
  }

  async disconnect(userId: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment | null)?.userId !== userId) continue;
      ws.close(1008, "No longer a member");
    }
    this.broadcastPresence();
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // A socket may have died between hibernation and this send; skip it.
    }
  }

  private broadcastPresence(excluding?: WebSocket): void {
    const sockets = this.ctx.getWebSockets().filter((ws) => ws !== excluding);
    const users = [
      ...new Set(
        sockets
          .map((ws) => (ws.deserializeAttachment() as Attachment | null)?.userId)
          .filter(Boolean),
      ),
    ] as string[];
    const payload: ServerMessage = { t: "presence", users };
    for (const ws of sockets) this.send(ws, payload);
  }
}

/** The API's live hub over the ClubRoom namespace; broadcast() runs only after a write commits to D1. */
export function clubRoomHub(ns: DurableObjectNamespace<ClubRoom>): ClubLiveHub {
  return {
    async broadcast(clubId, message) {
      await ns.getByName(clubId).broadcast(message);
    },
    async disconnect(clubId, userId) {
      await ns.getByName(clubId).disconnect(userId);
    },
    async connect(clubId, userId, request) {
      const url = new URL(request.url);
      url.searchParams.set("uid", userId);
      return ns.getByName(clubId).fetch(new Request(url, request));
    },
  };
}
