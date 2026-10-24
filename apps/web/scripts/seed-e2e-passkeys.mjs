// Gives the persistent e2e accounts their passkey. Run once (and again to rotate the key)
// from apps/web, signed in to wrangler and gh. It makes a new P-256 key unless
// E2E_PASSKEY_PRIVATE_KEY is already set, stores it as the repo's E2E_PASSKEY_PRIVATE_KEY
// Actions secret through gh (it is never printed), and writes each account's public key
// to D1. Needs migration 0006 (the passkey table) in that D1.
//
// Optional env:
//   E2E_EMAIL, E2E_PLUS_EMAIL, E2E_B_EMAIL, E2E_C_EMAIL   the accounts (defaults below)
//   E2E_D1_NAME / E2E_D1_LOCAL=true                       as in scripts/e2e-account.mjs
import { execSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { passkeyRowSql, privateKey } from "../e2e/passkey.ts";
import { d1 } from "./e2e-account.mjs";

const emails = [
  process.env.E2E_EMAIL ?? "e2e@foxing.app",
  process.env.E2E_PLUS_EMAIL ?? "e2e-plus@foxing.app",
  process.env.E2E_B_EMAIL ?? "e2e-b@foxing.app",
  process.env.E2E_C_EMAIL ?? "e2e-c@foxing.app",
];

if (!process.env.E2E_PASSKEY_PRIVATE_KEY) {
  const { privateKey: key } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.E2E_PASSKEY_PRIVATE_KEY = key
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
}
execSync("gh secret set E2E_PASSKEY_PRIVATE_KEY --repo DrDustinEdwards/foxing", {
  input: process.env.E2E_PASSKEY_PRIVATE_KEY,
  stdio: ["pipe", "inherit", "inherit"],
});

const key = privateKey();
for (const email of emails) d1(passkeyRowSql(email, key));
console.log(`E2E passkeys ready for ${emails.join(", ")}.`);
