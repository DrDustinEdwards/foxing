// One-time seed for the THREE-ACCOUNT social-reading gate. Prepares the fixture STATE
// only (accounts + a club + memberships + the club's current read); the spec itself
// drives every interaction under test through visible reader controls. This mirrors the
// e2e rule: seeding membership is fixture setup, not the flow under test.
//
// It sets up:
//   A = the existing Plus e2e account (E2E_PLUS_EMAIL): club OWNER (creating a club is
//       Plus), active member.
//   B = a free account (E2E_B_EMAIL): active member of the club.
//   C = a free account (E2E_C_EMAIL): NOT a member (the "never sees it" account).
//   Club: current read = the readable book at E2E_BOOK_SLUG, so A/B/C open /read/<slug>.
//
// Required env:
//   E2E_PLUS_EMAIL                        A's email (already seeded by seed-e2e-plus-user)
//   E2E_B_EMAIL / E2E_B_PASSWORD          B's credentials (also CI secrets)
//   E2E_C_EMAIL / E2E_C_PASSWORD          C's credentials (also CI secrets)
//   E2E_SEED_BASE_URL                     the deployed preview URL (or PLAYWRIGHT_BASE_URL)
//   E2E_BOOK_SLUG                         the readable book to use as the club's current read
// Optional:
//   E2E_B_USERNAME / E2E_C_USERNAME       profile usernames (default foxing_e2e_b / _c)
//   E2E_SOCIAL_CLUB_ID                    stable club id (default e2e-social-club)
//   E2E_D1_NAME                           D1 name (default foxing)
//   E2E_D1_LOCAL=true                     operate on the LOCAL D1 instead of --remote
import { execSync } from "node:child_process";

const A_EMAIL = process.env.E2E_PLUS_EMAIL;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const bookSlug = process.env.E2E_BOOK_SLUG;
const clubId = process.env.E2E_SOCIAL_CLUB_ID ?? "e2e-social-club";
const dbName = process.env.E2E_D1_NAME ?? "foxing";
const scope = process.env.E2E_D1_LOCAL === "true" ? "--local" : "--remote";

const accounts = [
  {
    key: "B",
    email: process.env.E2E_B_EMAIL,
    password: process.env.E2E_B_PASSWORD,
    username: process.env.E2E_B_USERNAME ?? "foxing_e2e_b",
    name: "Foxing E2E B",
  },
  {
    key: "C",
    email: process.env.E2E_C_EMAIL,
    password: process.env.E2E_C_PASSWORD,
    username: process.env.E2E_C_USERNAME ?? "foxing_e2e_c",
    name: "Foxing E2E C",
  },
];

if (!A_EMAIL || !base || !bookSlug || accounts.some((a) => !a.email || !a.password)) {
  console.error(
    "Set E2E_PLUS_EMAIL, E2E_B_EMAIL/PASSWORD, E2E_C_EMAIL/PASSWORD, E2E_SEED_BASE_URL, and E2E_BOOK_SLUG.",
  );
  process.exit(1);
}

const origin = new URL(base).origin;

function d1(sql) {
  execSync(`npx wrangler d1 execute ${dbName} ${scope} --command "${sql.replace(/"/g, '\\"')}"`, {
    stdio: "inherit",
    shell: true,
  });
}

// 1) Create B and C (verified + onboarded), the same way the plus account is seeded.
for (const a of accounts) {
  const signup = await fetch(new URL("/api/auth/sign-up/email", base), {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ name: a.name, email: a.email, password: a.password }),
  });
  if (!signup.ok && signup.status !== 422) {
    console.warn(`[${a.key}] sign-up returned ${signup.status}; the account may already exist.`);
  }
  d1(`UPDATE user SET email_verified = 1 WHERE email = '${a.email}';`);

  const signin = await fetch(new URL("/api/auth/sign-in/email", base), {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: a.email, password: a.password }),
  });
  const setCookies =
    typeof signin.headers.getSetCookie === "function"
      ? signin.headers.getSetCookie()
      : [signin.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies.map((c) => String(c).split(";")[0]).join("; ");
  if (signin.ok && cookie) {
    const onboard = await fetch(new URL("/api/v1/me/onboard", base), {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin },
      body: JSON.stringify({ username: a.username }),
    });
    if (!onboard.ok && onboard.status !== 409) {
      console.warn(
        `[${a.key}] onboard returned ${onboard.status}; complete once in the UI if needed.`,
      );
    }
  } else {
    console.warn(`[${a.key}] sign-in returned ${signin.status}; verify + onboard manually.`);
  }
}

// 2) Create the club (owned by A), pointed at the readable book as its CURRENT read, with
//    A + B as ACTIVE members and C intentionally absent. Idempotent (fixed club id).
d1(
  `INSERT OR IGNORE INTO clubs (id, name, slug, creator_id, current_book_id, club_type, visibility, member_approval, is_verified, created_at, updated_at) ` +
    `SELECT '${clubId}', 'E2E Social Club', '${clubId}', u.id, b.id, 'reader', 'private', 0, 0, unixepoch()*1000, unixepoch()*1000 ` +
    `FROM user u, books b WHERE u.email = '${A_EMAIL}' AND b.slug = '${bookSlug}';`,
);
// Keep the current read correct even if the club row already existed.
d1(
  `UPDATE clubs SET current_book_id = (SELECT id FROM books WHERE slug = '${bookSlug}') WHERE id = '${clubId}';`,
);
d1(
  `INSERT OR IGNORE INTO club_books (id, club_id, book_id, is_current, started_at) ` +
    `SELECT '${clubId}-current', '${clubId}', b.id, 1, unixepoch()*1000 FROM books b WHERE b.slug = '${bookSlug}';`,
);

// A = owner (active), B = member (active). C is never inserted.
d1(
  `INSERT OR REPLACE INTO club_members (club_id, user_id, status, role, joined_at) ` +
    `SELECT '${clubId}', id, 'active', 'owner', unixepoch()*1000 FROM user WHERE email = '${A_EMAIL}';`,
);
d1(
  `INSERT OR REPLACE INTO club_members (club_id, user_id, status, role, joined_at) ` +
    `SELECT '${clubId}', id, 'active', 'member', unixepoch()*1000 FROM user WHERE email = '${accounts[0].email}';`,
);

console.log(
  `E2E social gate ready: club '${clubId}' current-reading '${bookSlug}'. A=owner, B=member, C=non-member.`,
);
