// Local dev seed. Inserts a few fake books into the LOCAL D1, and (optionally)
// creates one demo user through the real signup flow when SEED_BASE_URL points at
// a running dev server (e.g. http://127.0.0.1:5173). The demo user is force-verified
// in D1 so it can sign in locally without the email step.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit", shell: true });

run("npx wrangler d1 execute foxing --local --file ./scripts/seed.sql");
console.log("Seeded books into local D1.");

const base = process.env.SEED_BASE_URL;
if (!base) {
  console.log("Set SEED_BASE_URL to a running dev server to also seed a demo user.");
  process.exit(0);
}

const email = "demo@foxing.app";
const password = "foxing-demo-123";
const res = await fetch(new URL("/api/auth/sign-up/email", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Demo Reader", email, password }),
});
if (!res.ok && res.status !== 422) {
  console.warn(`Demo signup returned ${res.status}; the user may already exist.`);
}

run(
  `npx wrangler d1 execute foxing --local --command "UPDATE user SET email_verified = 1 WHERE email = '${email}';"`,
);
console.log(`Demo user ready: ${email} / ${password} (verify via UI onboarding for a username).`);
