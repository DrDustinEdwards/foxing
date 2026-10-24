// Shared by the e2e seed scripts: makes one persistent e2e account ready to sign in and
// use. The user row and its e2e passkey go straight into D1 (Foxing has no passwords, and
// a new reader's first sign-in is an email link no script can click), then the script
// signs in with the passkey and onboards the account so authed pages do not bounce to
// /onboarding. Idempotent: an existing account keeps its row and gets its passkey again.
import { execSync } from "node:child_process";
import { passkeyRowSql, privateKey, signInWithPasskey } from "../e2e/passkey.ts";

const dbName = process.env.E2E_D1_NAME ?? "foxing";
const scope = process.env.E2E_D1_LOCAL === "true" ? "--local" : "--remote";

export function d1(sql) {
  execSync(`npx wrangler d1 execute ${dbName} ${scope} --command "${sql.replace(/"/g, '\\"')}"`, {
    stdio: "inherit",
    shell: true,
  });
}

// Keep addresses simple (no '): they go into SQL as written.
export async function seedAccount({ base, email, name, username }) {
  d1(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) " +
      `VALUES ('${crypto.randomUUID()}', '${name}', '${email}', 1, unixepoch()*1000, unixepoch()*1000);`,
  );
  d1(`UPDATE user SET email_verified = 1 WHERE email = '${email}';`);
  d1(passkeyRowSql(email, privateKey()));

  const cookie = await signInWithPasskey(base, email);
  const onboard = await fetch(new URL("/api/v1/me/onboard", base), {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: new URL(base).origin },
    body: JSON.stringify({ username }),
  });
  if (!onboard.ok && onboard.status !== 409) {
    console.warn(`Onboard returned ${onboard.status} for ${email}. Complete it once in the UI.`);
  }
}
