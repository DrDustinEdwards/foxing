// Cloudflare Access in front of the admin pages and the admin API (/admin, /api/v1/admin,
// /api/v1/ops): admins sign in through Access, as on every family site, and through
// Foxing's own sign-in as before. Access forwards each request it lets through with a
// signed token (the Cf-Access-Jwt-Assertion header, and the CF_Authorization cookie).
// site-runtime's check verifies its signature, issuer and audience; its email must also be
// the signed-in admin's own, so an Access session never stands in for another account.
//
// Settings (secrets, app/env.d.ts):
//   ACCESS_TEAM_DOMAIN  https://<team>.cloudflareaccess.com
//   ACCESS_AUD          the Access application's Audience (AUD) tag
// Either unset: nobody passes (fails closed).
import { verifyAccessRequest } from "@dustinedwards/site-runtime/access";

export async function adminAccessOk(env: Env, request: Request, email: string): Promise<boolean> {
  // Local development has no Access in front of it: an explicit opt-in in .dev.vars that
  // only applies to a localhost URL, so a stray copy of it in production does nothing.
  if (env.ACCESS_DEV_BYPASS === "1" && new URL(request.url).hostname === "localhost") return true;
  try {
    const verdict = await verifyAccessRequest(request, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      cookie: true,
    });
    if (!verdict.ok) return false;
    const signed = verdict.claims.email;
    return typeof signed === "string" && signed.toLowerCase() === email.toLowerCase();
  } catch {
    // The keys could not be fetched: refused, never let through.
    return false;
  }
}
