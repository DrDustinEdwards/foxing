// React Router v8 load context. The Worker sets the Cloudflare env/ctx on a
// RouterContextProvider; loaders and actions read it type-safely via context.get().
import type { catalogRepo } from "@foxing/core";
import { createContext } from "react-router";

export type CloudflareContext = { env: Env; ctx: ExecutionContext };

export const cloudflareContext = createContext<CloudflareContext>();

/**
 * This request's Content-Security-Policy nonce (workers/security-headers.ts, cspNonceFor), for the
 * server entry and the root Layout to put on every script they render. Unset outside a page render.
 */
export const cspNonceContext = createContext<string | undefined>(undefined);

/**
 * The post a Carrel preview draws (app/lib/carrel/journal-adapter.server.ts): the journal route
 * shows it in place of the stored, published one, so a preview is the real page, its header,
 * footer and byline included, for a post that is not live or not saved. Null on every other render.
 */
export type JournalPreview = catalogRepo.JournalPost & { coverFocus: string | null };

export const journalPreviewContext = createContext<JournalPreview | null>(null);
