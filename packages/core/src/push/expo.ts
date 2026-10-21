// Expo push delivery. Builds Expo messages, sends them in <=100 chunks to the
// Expo push API, and extracts tokens Expo reports as DeviceNotRegistered so the caller
// can prune them. The fetch is injected so the queue consumer passes the Worker's fetch
// and tests pass a stub. Message building + ticket parsing are pure and unit-testable.

import { chunked } from "../db";

/** Expo accepts at most 100 messages per push request. */
const EXPO_BATCH = 100;

export type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound: "default";
};

export type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export function buildExpoMessages(
  tokens: string[],
  content: { title: string; body?: string | null; data?: Record<string, unknown> },
): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: content.title,
    body: content.body ?? undefined,
    data: content.data,
    sound: "default",
  }));
}

/** Tokens whose ticket came back DeviceNotRegistered, aligned by index to the messages
 *  that were sent. Expo returns tickets in request order. */
export function deadTokensFromTickets(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  const dead: string[] = [];
  for (let i = 0; i < tickets.length && i < messages.length; i++) {
    const t = tickets[i];
    if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
      dead.push(messages[i].to);
    }
  }
  return dead;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Send messages to Expo in chunks of 100; returns the flat ticket list in request
 *  order. A failed chunk yields error tickets for its messages so callers still align. */
export async function sendExpoPush(
  messages: ExpoMessage[],
  fetchImpl: typeof fetch,
): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];
  for (const batch of chunked(messages, EXPO_BATCH)) {
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const data = json?.data ?? [];
      // Pad/truncate to the batch length so index alignment holds even on a short reply.
      for (let i = 0; i < batch.length; i++) {
        tickets.push(data[i] ?? { status: "error", message: "no_ticket" });
      }
    } catch (err) {
      for (const _m of batch) {
        tickets.push({
          status: "error",
          message: err instanceof Error ? err.message : "send_failed",
        });
      }
    }
  }
  return tickets;
}
