/**
 * The consent step and the upstream sign-in through Cloudflare Access, as
 * @dustinedwards/site-runtime/mcp-login runs it for every admin MCP server.
 * This file is Foxing Admin's configuration of it: its name, its scopes, its
 * consent paragraphs and who is let in (the single ADMIN_EMAIL).
 *
 * Access rather than Foxing's own Better Auth: this server's sign-in stays
 * independent of foxing.app's sessions. The Foxing account the API acts as is
 * FOXING_ADMIN_ID, and the API re-checks that account's is_admin on every call.
 */

import { isAdminUser, loginHandler, type LoginEnv as SharedLoginEnv } from "@dustinedwards/site-runtime/mcp-login";
import { SCOPE_READ, SCOPE_WRITE } from "./auth";
import { SERVER_INFO } from "./mcp-handler";

export interface LoginEnv extends SharedLoginEnv {
  ADMIN_EMAIL?: string;
}

export const defaultHandler = loginHandler<LoginEnv>({
  name: "Foxing Admin",
  scopes: { read: SCOPE_READ, write: SCOPE_WRITE },
  about: `<p>Foxing Admin runs foxing.app: the platform snapshot, readers, the catalog and
staff picks, Book of the Month, celebrity picks and the admin audit log. It cannot
write Journal posts; Carrel owns writing.</p>
<p>It will always be able to read. Changes need the box below.</p>`,
  admit: isAdminUser,
  // Every sign-in, admitted or refused, is a row in the tool-call log.
  audit: { name: SERVER_INFO.name, version: SERVER_INFO.version },
});
