// Who is an admin (checklist G5: one list per site, checked in code as well as by Access). The
// list is the ADMIN_EMAILS setting, read by site-runtime's adminEmails (comma-separated, compared
// lower case). Unset, nobody is an admin.
import { adminEmails } from "@dustinedwards/site-runtime/access";

export type AdminSettings = { ADMIN_EMAILS?: string; ADMIN_EMAIL?: string };

/** Whether this account's email is on ADMIN_EMAILS. */
export function isAdminAccount(env: AdminSettings, email: string): boolean {
  return adminEmails(env).includes(email.trim().toLowerCase());
}
