// Who is an admin (checklist G5: one list per site, checked in code as well as by Access). The
// list is the ADMIN_EMAILS setting, read by site-runtime's adminEmails (comma-separated, compared
// lower case). Until it is set, profiles.is_admin decides as it did before, so setting it is
// what moves the site over and no deploy locks an admin out; a warning says the setting is missing.
import { adminEmails } from "@dustinedwards/site-runtime/access";
import { logEvent } from "@dustinedwards/site-runtime/log";

export type AdminSettings = { ADMIN_EMAILS?: string; ADMIN_EMAIL?: string };

let warned = false;

/** True when ADMIN_EMAILS is set, so the setting, not profiles.is_admin, decides. */
export function adminListIsSet(env: AdminSettings): boolean {
  return adminEmails(env).length > 0;
}

/** Whether this account is an admin: its email on ADMIN_EMAILS, else (unset) its is_admin flag. */
export function isAdminAccount(env: AdminSettings, email: string, isAdminFlag: boolean): boolean {
  const list = adminEmails(env);
  if (list.length > 0) return list.includes(email.trim().toLowerCase());
  if (!warned) {
    warned = true;
    logEvent("admin_list_unset", { fallback: "profiles.is_admin" }, { level: "warn" });
  }
  return isAdminFlag;
}
