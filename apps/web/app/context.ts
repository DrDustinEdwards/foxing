// React Router v8 load context. The Worker sets the Cloudflare env/ctx on a
// RouterContextProvider; loaders and actions read it type-safely via context.get().
import { createContext } from "react-router";

export type CloudflareContext = { env: Env; ctx: ExecutionContext };

export const cloudflareContext = createContext<CloudflareContext>();

/**
 * This request's Content-Security-Policy nonce (workers/security-headers.ts, cspNonceFor), for the
 * server entry and the root Layout to put on every script they render. Unset outside a page render.
 */
export const cspNonceContext = createContext<string | undefined>(undefined);
