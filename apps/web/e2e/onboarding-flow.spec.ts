import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { passkeyRowSql, privateKey, signInThroughLogin } from "./passkey";

// The persistent e2e account (e2e/auth.setup.ts) is already onboarded, so it can
// never exercise onboarding: its loader redirects straight past /onboarding to /me.
// This spec provisions an EPHEMERAL account per run so the two-step flow itself gets
// covered. Account creation and deletion are setup/teardown, not the thing under test:
// the user row and its e2e passkey are written directly in D1 (the same rows
// scripts/seed-e2e-passkeys.mjs writes for the persistent accounts), because a new
// reader's first sign-in is an email link and nothing here can click a real inbox. The
// sign-in and the onboarding flow are driven through VISIBLE UI only, exactly like every
// other authed spec in this repo.
const dbName = process.env.E2E_D1_NAME ?? "foxing";

function runD1(sql: string): string {
  return execSync(
    `npx wrangler d1 execute ${dbName} --remote --command "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8", stdio: "pipe" },
  );
}

async function provisionAccount() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-onboard-${stamp}@foxing.app`;
  runD1(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) " +
      `VALUES ('e2e-onboard-${stamp}', 'E2E Onboard', '${email}', 1, unixepoch()*1000, unixepoch()*1000);`,
  );
  runD1(passkeyRowSql(email, privateKey()));
  // D1's read replica can lag behind the just-committed rows; wait until the passkey shows.
  for (let attempt = 0; attempt < 6; attempt++) {
    const out = runD1(
      `SELECT count(*) AS n FROM passkey p JOIN user u ON u.id = p.user_id WHERE u.email = '${email}';`,
    );
    if (/"n":\s*1/.test(out)) return email;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Ephemeral account never became visible in D1.");
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
  test("signs in, walks the two-step flow through visible UI, and lands on the book with reading set", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const base = baseURL ?? "https://foxing.dustin-edwards.workers.dev";
    const email = await provisionAccount();

    // Sign in through the visible passkey button -- the only supported way into an authed
    // session anywhere in this repo. A fresh account has no profile; /me's loader
    // redirects it to /onboarding.
    await signInThroughLogin(page, email, base);
    await expect(page).toHaveURL(/\/onboarding/);

    // The label's accessible name includes the helper text ("Username Letters,
    // numbers, and underscores."), so match a prefix, not the full string.
    const username = `e2eonb${Date.now().toString(36)}`;
    await page.getByLabel(/^username/i).fill(username);
    // TEMP diagnostics for the CI-only hang on this click; removed once it is understood.
    page.on("console", (m) => console.log(`[console ${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
    console.log(
      "[diag]",
      JSON.stringify(
        await page.evaluate(async () => {
          const btn = [...document.querySelectorAll("button")].find(
            (b) => b.textContent === "Continue",
          );
          const box = () => JSON.stringify(btn?.getBoundingClientRect());
          const raf = await Promise.race([
            new Promise((r) => requestAnimationFrame(() => r("raf ok"))),
            new Promise((r) => setTimeout(() => r("raf stalled"), 2000)),
          ]);
          const b1 = box();
          await new Promise((r) => setTimeout(r, 300));
          return {
            raf,
            b1,
            b2: box(),
            visibility: document.visibilityState,
            animations: document
              .getAnimations()
              .map(
                (a) =>
                  `${(a as CSSAnimation).animationName ?? a.constructor.name} on ${(a.effect as KeyframeEffect)?.target?.nodeName}.${((a.effect as KeyframeEffect)?.target as Element)?.className}`,
              ),
            dialogs: document.querySelectorAll("dialog[open], [popover]").length,
          };
        }),
      ),
    );
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
