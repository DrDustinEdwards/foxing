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
//   E2E_B_EMAIL / E2E_C_EMAIL             B's and C's emails (also CI secrets)
//   E2E_PASSKEY_PRIVATE_KEY               the e2e passkey (also a CI secret)
//   E2E_SEED_BASE_URL                     the deployed preview URL (or PLAYWRIGHT_BASE_URL)
//   E2E_BOOK_SLUG                         the readable book to use as the club's current read
// Optional:
//   E2E_B_USERNAME / E2E_C_USERNAME       profile usernames (default foxing_e2e_b / _c)
//   E2E_SOCIAL_CLUB_ID                    stable club id (default e2e-social-club)
//   E2E_D1_NAME                           D1 name (default foxing)
//   E2E_D1_LOCAL=true                     operate on the LOCAL D1 instead of --remote
import { d1, seedAccount } from "./e2e-account.mjs";

const A_EMAIL = process.env.E2E_PLUS_EMAIL;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const bookSlug = process.env.E2E_BOOK_SLUG;
const clubId = process.env.E2E_SOCIAL_CLUB_ID ?? "e2e-social-club";

const accounts = [
  {
    key: "B",
    email: process.env.E2E_B_EMAIL,
    username: process.env.E2E_B_USERNAME ?? "foxing_e2e_b",
    name: "Foxing E2E B",
  },
  {
    key: "C",
    email: process.env.E2E_C_EMAIL,
    username: process.env.E2E_C_USERNAME ?? "foxing_e2e_c",
    name: "Foxing E2E C",
  },
];

if (!A_EMAIL || !base || !bookSlug || accounts.some((a) => !a.email)) {
  console.error(
    "Set E2E_PLUS_EMAIL, E2E_B_EMAIL, E2E_C_EMAIL, E2E_PASSKEY_PRIVATE_KEY, E2E_SEED_BASE_URL, and E2E_BOOK_SLUG.",
  );
  process.exit(1);
}

// 1) Create B and C (verified + onboarded), the same way the plus account is seeded.
for (const a of accounts) {
  await seedAccount({ base, email: a.email, name: a.name, username: a.username });
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
