import { generateKeyPairSync } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addPasskey } from "./passkey";

test.describe("auth flows", () => {
  test("login offers a passkey, Google and an email link, and no password", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in with a passkey/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /email me a sign-in link/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test("the old password pages lead to sign-in", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/login/);
  });

  // The live site has Turnstile on, so a link request without a passed check is refused
  // before any mail goes out, which is what this browser, like any bot, gets.
  test("a sign-in link request without the bot check sends nothing", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody-magic@example.com");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByRole("alert")).toHaveText(/complete the check/i);
    await expect(page.getByText(/check your email/i)).toHaveCount(0);
  });

  // REGRESSION (2026-07-09): a sign-in returned a raw 500 (a transient D1 read fault in the
  // sign-in SELECTs, now retried in @foxing/core createDb). A failed sign-in must render a
  // handled error, never a 500 / "Something went wrong" screen. A passkey Foxing has never
  // seen is the failed sign-in a reader can actually cause.
  test("an unknown passkey renders a handled error, not a 500", async ({ page, baseURL }) => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    await addPasskey(page, "nobody-passkey@example.com", baseURL ?? "", privateKey);
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in with a passkey/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  // REGRESSION (2026-07-09): /me returned a raw 500. Two separate defects, both fixed:
  // (1) the loader self-fetched the Worker's own /api/v1/me and called res.json() on
  //     the response; that loopback returns a 404 HTML page unconditionally (proven
  //     for both profile and no-profile users), so the parse threw. Reads now go
  //     through core in-process, no self-fetch.
  // (2) the only signed-in user had no profile row. Profile-gated loaders now
  //     redirect: anonymous -> /login, signed-in-without-profile -> /onboarding.
  // The authed no-profile -> /onboarding path is covered deterministically in
  // test/profile-gate.test.ts (e2e cannot forge a verified session here).
  test("anonymous /me redirects to login, never 500", async ({ page }) => {
    const res = await page.goto("/me");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
