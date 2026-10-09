// The keepalive frames of a club's live socket, shared by the browser hook
// (hooks/use-club-live.ts) and the ClubRoom Durable Object (workers/club-room.ts).
// The DO registers this exact pair with setWebSocketAutoResponse, so the runtime
// answers a ping without waking the object. The match is on the exact string, so
// both sides import these constants rather than building the JSON themselves.
export const PING_FRAME = JSON.stringify({ t: "ping" });
export const PONG_FRAME = JSON.stringify({ t: "pong" });
