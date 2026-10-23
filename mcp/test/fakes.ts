/**
 * A fake foxing Worker behind the FOXING binding, and a fake tool-call log.
 * The fake records every request so a test can assert exactly what was sent.
 */
import type { AuditRow } from "@dustinedwards/site-runtime/audit-log";
import type { Caller } from "../src/auth.ts";
import type { ToolEnv } from "../src/tools.ts";

export const TOKEN = "t".repeat(40);
export const ADMIN_EMAIL = "admin@example.com";
export const FOXING_ADMIN_ID = "admin-user";

export type Sent = { method: string; url: URL; headers: Headers; body: unknown };
type Reply = { status?: number; body?: unknown; throws?: Error; raw?: string };

export interface FakeFoxing {
  calls: Sent[];
  /** Queue the next replies, in order. Unqueued requests answer 200 {}. */
  reply(...replies: Reply[]): void;
  binding: Fetcher;
}

export function fakeFoxing(): FakeFoxing {
  const calls: Sent[] = [];
  const queue: Reply[] = [];
  const binding = {
    async fetch(input: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      calls.push({
        method: init.method ?? "GET",
        url: new URL(input),
        headers,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const next = queue.shift() ?? {};
      if (next.throws) throw next.throws;
      const raw = next.raw ?? JSON.stringify(next.body ?? {});
      return new Response(raw, {
        status: next.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  } as unknown as Fetcher;
  return { calls, reply: (...replies) => queue.push(...replies), binding };
}

export interface FakeLog {
  rows: AuditRow[];
  fail: boolean;
  binding: DurableObjectNamespace;
}

export function fakeLog(): FakeLog {
  const log: FakeLog = { rows: [], fail: false, binding: undefined as unknown as DurableObjectNamespace };
  log.binding = {
    idFromName: (name: string) => name,
    get: () => ({
      async fetch(_url: string, init: RequestInit) {
        if (log.fail) return new Response("down", { status: 500 });
        log.rows.push(JSON.parse(String(init.body)) as AuditRow);
        return new Response(null, { status: 204 });
      },
    }),
  } as unknown as DurableObjectNamespace;
  return log;
}

export function freshEnv(foxing: FakeFoxing, log: FakeLog): ToolEnv {
  return {
    FOXING: foxing.binding,
    SITE_ORIGIN: "https://foxing.app",
    ADMIN_OPERATOR_TOKEN: TOKEN,
    FOXING_ADMIN_ID,
    ADMIN_EMAIL,
    TOOL_CALL_LOG: log.binding,
  };
}

const adminProps = { email: ADMIN_EMAIL };

export const WRITER: Caller = { kind: "admin", props: adminProps, scopes: ["foxing.read", "foxing.write"] };
export const READER: Caller = { kind: "admin", props: adminProps, scopes: ["foxing.read"] };
/** A grant for an email that is not the administrator. */
export const STRANGER: Caller = {
  kind: "admin",
  props: { email: "someone-else@example.com" },
  scopes: ["foxing.read", "foxing.write"],
};
