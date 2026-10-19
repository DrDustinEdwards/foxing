import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// The persistent e2e account (e2e/auth.setup.ts) is already onboarded, so it can
// never exercise onboarding: its loader redirects straight past /onboarding to /me.
// This spec provisions an EPHEMERAL verified account per run so the two-step flow
// itself gets covered. Account creation and deletion are setup/teardown, not the
// thing under test: sign-up goes through the real Better Auth API and the verified
// flag is flipped directly in D1 (the same mechanism scripts/seed-e2e-user.mjs uses
// for the persistent account -- Better Auth requires email verification and nothing
// here can click a real inbox). The onboarding flow itself is driven through VISIBLE
// UI only, exactly like every other authed spec in this repo.
const dbName = process.env.E2E_D1_NAME ?? "foxing";

function runD1(sql: string): string {
  return execSync(
    `npx wrangler d1 execute ${dbName} --remote --command "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8", stdio: "pipe" },
  );
}

// The live site throttles credential POSTs (sign-in, sign-up) to 5 a minute per address
// (AUTH_RL in workers/app.ts), and the setup projects' four sign-ins come from the same
// runner in the same minute. A throttled attempt waits for the window to move on.
const THROTTLE_WAIT = 20_000;

async function provisionVerifiedAccount(baseURL: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-onboard-${stamp}@foxing.app`;
  const password = `Onb0ard-${Math.random().toString(36).slice(2, 10)}!`;
  const origin = new URL(baseURL).origin;

  let signup: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    signup = await fetch(new URL("/api/auth/sign-up/email", baseURL), {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ name: "E2E Onboard", email, password }),
    });
    if (signup.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_WAIT));
  }
  if (!signup?.ok) {
    throw new Error(`Ephemeral sign-up failed: ${signup?.status} ${await signup?.text()}`);
  }

  // D1's read replica can lag behind the just-committed sign-up row (documented in
  // deferred-items.md); retry the verify flip until it is actually visible.
  for (let attempt = 0; attempt < 6; attempt++) {
    runD1(`UPDATE user SET email_verified = 1 WHERE email = '${email}';`);
    const out = runD1(`SELECT email_verified FROM user WHERE email = '${email}';`);
    if (/"email_verified":\s*1/.test(out)) return { email, password };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Ephemeral account never became visible/verified in D1.");
}

async function deleteAccount(baseURL: string, cookieHeader: string) {
  const res = await fetch(new URL("/api/v1/account", baseURL), {
    method: "DELETE",
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) {
    console.error(`Ephemeral account cleanup failed: DELETE /account -> ${res.status}`);
  }
}

test.describe("onboarding (ephemeral account)", () => {
  test("signs up, walks the two-step flow through visible UI, and lands on the book with reading set", async ({
    page,
    baseURL,
  }) => {
    // Room for a throttled sign-up and sign-in to each wait out the window.
    test.setTimeout(180_000);
    const base = baseURL ?? "https://foxing.dustin-edwards.workers.dev";
    const { email, password } = await provisionVerifiedAccount(base);

    // Sign in through the visible form -- the only supported way into an authed
    // session anywhere in this repo. A throttled attempt shows "Sign in failed", so try
    // again from a fresh form once the window has moved on, as a reader would.
    // A fresh account has no profile; /me's loader redirects it to /onboarding.
    await expect(async () => {
      await page.goto("/login");
      // Reveal the collapsed password form, then target its Email (the last of two inputs).
      await page.getByRole("button", { name: /use a password instead/i }).click();
      await page.getByLabel("Email").last().fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await expect(page).toHaveURL(/\/onboarding/);
    }).toPass({ intervals: [THROTTLE_WAIT], timeout: 90_000 });

    // The label's accessible name includes the helper text ("Username Letters,
    // numbers, and underscores."), so match a prefix, not the full string.
    const username = `e2eonb${Date.now().toString(36)}`;
    await page.getByLabel(/^username/i).fill(username);
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Step 2: the starter-book handoff.
    await expect(page.getByRole("heading", { name: /start your first book/i })).toBeVisible();
    const startButtons = page.getByRole("button", { name: /^start reading$/i });
    await expect(startButtons.first()).toBeVisible();
    await startButtons.first().click();

    // Lands on the book page, not a dead /read link (the reader is parked on this
    // branch; onboarding must never hand off to a route that does not exist).
    await expect(page).toHaveURL(/\/books\/[a-z0-9-]+$/);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // The status control is SSR'd from the real D1 row: "Reading" here proves the
    // write actually persisted, not just optimistic client state.
    const status = page.getByRole("combobox", { name: /reading status/i });
    await expect(status).toHaveValue("reading");

    // Cleanup: delete the ephemeral account through the real endpoint (not the thing
    // under test), using the session cookie the browser is already holding.
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await deleteAccount(base, cookieHeader);
  });
});
