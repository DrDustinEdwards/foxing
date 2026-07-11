// ClubRoom -- the live layer for ONE book club (Phase 5, per spec-cf-api). One Durable
// Object instance per club (addressed by idFromName(clubId)), so cross-club isolation
// is structural: a ClubRoom only ever holds one club's sockets, and a broadcast can
// never reach another club. The Phase 5 task originally proposed a single shared hub
// partitioned by club_id; Fable overrode that in favour of the spec's per-club object,
// which removes the partitioning bug surface and the single-contention point.
//
// INVARIANT: the DO is fan-out ONLY. It NEVER writes D1. Every mutation goes through
// the HTTP API, which commits to D1 first and THEN calls broadcast() here. D1 is the
// sole source of truth; this object cannot cause data drift because it holds no truth.
//
// Uses the Hibernation API: sockets survive the object being evicted between messages,
// and presence is recomputed from ctx.getWebSockets() (attachments survive hibernation).
//
// TRADEOFF + MIGRATION PATH: one object per club is the standard, horizontally scaling
// shape. If a single club ever outgrows one object's single-threaded fan-out, the fix
// is local and the write->commit->notify contract is unchanged: shard that club's
// sockets across N child objects (idFromName(`${clubId}:${shard}`)) and have the API
// notify each shard. Nothing about D1-as-truth changes.
import { DurableObject } from "cloudflare:workers";
import type { LiveMessage } from "@foxing/core";

type Attachment = { userId: string };

type ServerMessage =
  | LiveMessage
  | { t: "presence"; users: string[] }
  | { t: "pong" };

export class ClubRoom extends DurableObject {
  /** Upgrade a membership-checked request (the API already verified it) to a socket. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }
    // The API forwards the membership-checked user id on the URL (headers are awkward
    // to add to a forwarded upgrade request; a query param survives new Request(url, req)).
    const userId = new URL(request.url).searchParams.get("uid");
    if (!userId) return new Response("Missing user.", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // Accept with a hibernatable socket; stash the user id so presence survives eviction.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId } satisfies Attachment);

    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Clients may only send {t:'ping'} (keepalive). All real writes go via the HTTP API. */
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    try {
      const parsed = JSON.parse(message) as { t?: string };
      if (parsed.t === "ping") this.send(ws, { t: "pong" });
    } catch {
      // Ignore malformed frames; the client contract is {t:'ping'} only.
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    // The socket is closing; recompute presence from the survivors.
    this.broadcastPresence(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  /** RPC: fan a committed write out to every socket in THIS club's room. Called by the
   *  API's hub AFTER the write committed to D1. */
  async broadcast(message: LiveMessage | LiveMessage[]): Promise<void> {
    const messages = Array.isArray(message) ? message : [message];
    for (const ws of this.ctx.getWebSockets()) {
      for (const m of messages) this.send(ws, m);
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // A socket may have died between hibernation and this send; skip it.
    }
  }

  /** Distinct connected user ids, optionally excluding a socket that is disconnecting. */
  private broadcastPresence(excluding?: WebSocket): void {
    const sockets = this.ctx.getWebSockets().filter((ws) => ws !== excluding);
    const users = [
      ...new Set(
        sockets.map((ws) => (ws.deserializeAttachment() as Attachment | null)?.userId).filter(Boolean),
      ),
    ] as string[];
    const payload: ServerMessage = { t: "presence", users };
    for (const ws of sockets) this.send(ws, payload);
  }
}
