// Client hook for a club's live layer (Phase 5). Opens the membership-checked
// WebSocket at /api/v1/clubs/:id/live, tracks presence, and hands server->client
// messages to callbacks. The ONLY client->server message is {t:'ping'} (keepalive);
// every real write goes through /api/v1, which fans out over this socket after the D1
// commit. So this hook never sends data, it only listens.
import { useEffect, useRef, useState } from "react";

type ServerMessage =
  | { t: "presence"; users: string[] }
  | { t: "post"; post: unknown }
  | { t: "thread"; thread: unknown }
  | { t: "tally"; poll_id: string; tallies: Record<string, number>; closed?: boolean }
  | { t: "notice"; kind: string; [k: string]: unknown }
  | { t: "pong" };

export type ClubLiveHandlers = {
  onPost?: (post: unknown) => void;
  onThread?: (thread: unknown) => void;
  onTally?: (msg: { poll_id: string; tallies: Record<string, number>; closed?: boolean }) => void;
  onNotice?: (msg: { kind: string; [k: string]: unknown }) => void;
};

export function useClubLive(clubId: string | null, handlers: ClubLiveHandlers) {
  const [presence, setPresence] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  // Keep the latest handlers without re-opening the socket on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!clubId || typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/v1/clubs/${clubId}/live`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      const h = handlersRef.current;
      switch (msg.t) {
        case "presence":
          setPresence(msg.users);
          break;
        case "post":
          h.onPost?.(msg.post);
          break;
        case "thread":
          h.onThread?.(msg.thread);
          break;
        case "tally":
          h.onTally?.(msg);
          break;
        case "notice":
          h.onNotice?.(msg);
          break;
      }
    };

    // Keepalive so idle sockets are not reaped; the DO answers with {t:'pong'}.
    const ping = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }));
    }, 30_000);

    return () => {
      window.clearInterval(ping);
      ws.close();
    };
  }, [clubId]);

  return { presence, connected };
}
