// Who is an admin (checklist G5: one list per site, checked in code as well as by Access). The
// roster is ADMIN_EMAIL (the main admin) and CO_OWNER_EMAILS (comma-separated co-owners), read by
// site-runtime's isAdminEmail, compared lower case. Unset ADMIN_EMAIL: nobody is an admin.
import { isAdminEmail } from "@dustinedwards/site-runtime/access";

export type AdminSettings = { ADMIN_EMAIL?: string; CO_OWNER_EMAILS?: string };

/** Whether this account's email is the main admin or a co-owner. */
export function isAdminAccount(env: AdminSettings, email: string): boolean {
  return isAdminEmail(env, email);
}
