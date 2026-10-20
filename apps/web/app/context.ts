// React Router v8 load context. The Worker sets the Cloudflare env/ctx on a
// RouterContextProvider; loaders and actions read it type-safely via context.get().
import type { catalogRepo } from "@foxing/core";
import { createContext } from "react-router";

type JournalPost = catalogRepo.JournalPost;

export type CloudflareContext = { env: Env; ctx: ExecutionContext };

export const cloudflareContext = createContext<CloudflareContext>();

/**
 * A Journal post that is not saved, for the Carrel site API's preview: set only in-process by
 * app/lib/carrel/journal-adapter.server.ts, never from a request, so the journal route renders the
 * draft through its own loader and markup. Null on every ordinary request.
 */
export const journalPreviewContext = createContext<JournalPost | null>(null);

/**
 * This request's Content-Security-Policy nonce (workers/security-headers.ts, cspNonceFor), for the
 * server entry and the root Layout to put on every script they render. Unset outside a page render.
 */
export const cspNonceContext = createContext<string | undefined>(undefined);
