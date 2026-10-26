// Foxing's own hosts and addresses, named once. Pages build canonical and OG URLs from the
// request origin (lib/seo.ts); these are for the places that need a fixed host.

/** The live site. */
export const SITE_ORIGIN = "https://foxing.app";
/** The workers.dev preview, trusted for auth alongside the live site. */
export const PREVIEW_ORIGIN = "https://foxing.dustin-edwards.workers.dev";
/** The R2 custom domain covers are served from. */
export const COVER_ORIGIN = "https://covers.foxing.app";
/** Edge-cache key namespaces for rendered OG images and the fonts they use (never fetched). */
export const OG_CACHE_ORIGIN = "https://og.foxing.app";
export const FONT_CACHE_ORIGIN = "https://fontcache.foxing.app";

/** The contact addresses the public pages print. */
export const HELLO_EMAIL = "hello@foxing.app";
export const PRIVACY_EMAIL = "privacy@foxing.app";
export const LEGAL_EMAIL = "legal@foxing.app";
/** The vulnerability contact /.well-known/security.txt lists, and the date it is next confirmed by (the family check warns first). */
export const SECURITY_CONTACT = "security@dustinedwards.info";
export const SECURITY_TXT_EXPIRES = "2027-09-28T00:00:00Z";
