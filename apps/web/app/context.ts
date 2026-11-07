// React Router v8 load context. The Worker sets the Cloudflare env/ctx on a
// RouterContextProvider; loaders and actions read it type-safely via context.get().
import type { catalogRepo } from "@foxing/core";
import { createContext } from "react-router";

import { cloudflareContext, cspNonceContext } from "@dustinedwards/site-runtime/context";
import type { CloudflareContext } from "@dustinedwards/site-runtime/context";

// The request context and the render nonce are site-runtime's (./context), re-exported so routes keep one import.
export { cloudflareContext, cspNonceContext };
export type { CloudflareContext };

/**
 * The post a Carrel preview draws (app/lib/carrel/journal-adapter.server.ts): the journal route
 * shows it in place of the stored, published one, so a preview is the real page, its header,
 * footer and byline included, for a post that is not live or not saved. Null on every other render.
 */
export type JournalPreview = catalogRepo.JournalPost & { coverFocus: string | null };

export const journalPreviewContext = createContext<JournalPreview | null>(null);
