// React Router v8 load context. The Worker sets the Cloudflare env/ctx on a
// RouterContextProvider; loaders and actions read it type-safely via context.get().
import { createContext } from "react-router";

export type CloudflareContext = { env: Env; ctx: ExecutionContext };

export const cloudflareContext = createContext<CloudflareContext>();
