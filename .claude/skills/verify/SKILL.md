---
name: verify
description: Use before committing or opening a pull request that changes what the Foxing web app shows or does (apps/web, and the packages it serves from: packages/core, packages/api). Boots apps/web in Vite on workerd with a local D1, signs in through the visible form with a locally seeded e2e account, drives the changed flow end to end in Chromium with Playwright, runs the existing spec that covers it, and reports the evidence. Never for apps/mobile.
---

# Verify a Foxing web change

Do it before every commit that touches `apps/web/` (or `packages/core`,
`packages/api` as the web app uses them), and before the pull request.

There is no mock server. The app runs for real in workerd with a local, throwaway D1
(`apps/web/.wrangler/`, gitignored), so the data is a few fake books and one fake
account, nothing real.

## 1. One-time setup for this checkout

From the repo root, on the repo's Node 26 (`.nvmrc`; in a cloud session the SessionStart hook
installs it; put it on PATH). `npm ci` must run
without `--ignore-scripts`: the git dependencies build themselves on install.

```sh
export SCRATCH=<scratchpad>/foxing && mkdir -p $SCRATCH/out
npm ci
cd apps/web
cp wrangler.jsonc.example wrangler.jsonc    # gitignored, never committed
printf 'BETTER_AUTH_SECRET=local-dev-secret-0123456789abcdef0123456789\nBETTER_AUTH_URL=http://localhost:5173\n' > .dev.vars   # gitignored
npx wrangler types
npx wrangler d1 migrations apply foxing --local
npm run seed                                # fake books into the local D1 (scripts/seed.sql)
```

`BETTER_AUTH_URL` must be the origin you browse (the placeholder in the example
config makes every page a 500). If port 5173 is busy (check with
`curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/`; another thread may
hold it), pick a free one and use it in `BETTER_AUTH_URL`, `--port` and every URL below.

## 2. Boot the app

From `apps/web/`, in the background:

```sh
npx vite dev --port 5173 --strictPort > $SCRATCH/vite.log 2>&1 &
echo $! > $SCRATCH/vite.pid
```

Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/books` prints 200,
and confirm it is Foxing: `curl -s http://localhost:5173/books | grep -o '<title>[^<]*'`
prints `Browse the library | Foxing`. The very first run after `npm ci` optimizes
dependencies and reloads; if the first request hangs or fails, request again once
the log shows `optimized dependencies changed. reloading` and settles. A 500 whose log
says "Failed query" means the migrations were not applied; "Invalid base URL" means
`.dev.vars` is wrong. In dev, the browser console shows one React hydration warning
about `nonce=""` on a `<link>`; it comes from Vite's dev server, not the change.
Anything else in the console errors line is a finding.

Then the signed-in account: e2e signs in through the visible form with the seeded
`e2e@foxing.app`, whose passkey sits in Chromium's virtual authenticator. For the
local D1 make your own key; never run `scripts/seed-e2e-passkeys.mjs`, which writes the
repo's real `E2E_PASSKEY_PRIVATE_KEY` Actions secret through `gh`. The seed signs in
once to onboard the account, so the server must be running:

```sh
node -e 'const {generateKeyPairSync:g}=require("crypto");process.stdout.write(g("ec",{namedCurve:"P-256"}).privateKey.export({format:"der",type:"pkcs8"}).toString("base64"))' > $SCRATCH/key
E2E_PASSKEY_PRIVATE_KEY=$(cat $SCRATCH/key) E2E_EMAIL=e2e@foxing.app E2E_D1_LOCAL=true \
  E2E_SEED_BASE_URL=http://localhost:5173 node ./scripts/seed-e2e-user.mjs
```

## 3. Drive the changed flow

Write a short script in the scratchpad, never in the repo. Name each step the way a
reader would say it, act through roles and labels, and assert what the reader should
see afterward (e2e/README.md: only what a person can see and click; never an API call
or a forged session). Collect console and page errors, and keep a screenshot of the end
state. The script reuses the repo's own sign-in (`e2e/passkey.ts`). Replace the steps after
sign-in with the changed flow.

```js
// $SCRATCH/drive.mjs: cd $SCRATCH/out && REPO=<repo> E2E_EMAIL=e2e@foxing.app E2E_PASSKEY_PRIVATE_KEY=$(cat $SCRATCH/key) node $SCRATCH/drive.mjs http://localhost:5173
import { createRequire } from "node:module";
const repo = process.env.REPO;
const { chromium, expect } = createRequire(`${repo}/apps/web/package.json`)("@playwright/test");
const { signInThroughLogin } = await import(`${repo}/apps/web/e2e/passkey.ts`);
const base = process.argv[2];
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
// errors, log and step(): the helpers in devkit docs/verify.md
try {
  await step("open the home page (this is Foxing)", async () => {
    const r = await page.goto("/");
    if (!r.ok()) throw new Error(`status ${r.status()}`);
    await expect(page.getByRole("heading", { level: 1, name: /read the classics/i })).toBeVisible();
  });
  await step("sign in through the visible login form", async () => {
    await signInThroughLogin(page, process.env.E2E_EMAIL, base);
    await expect(page.getByRole("button", { name: /your account/i })).toBeVisible();
  });
  // ...the changed flow: act through roles and labels, wait for each save, then
  // assert the visible result and that it holds after a reload.
  await page.screenshot({ path: "after.png", fullPage: true });
} finally {
  console.log(log.join("\n"));
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
}
```

For a public flow, skip the sign-in step (the seeded books are `frankenstein-seed`,
`the-time-machine-seed` and others in `apps/web/scripts/seed.sql`). Wait for each save
before the next change. Drive the whole flow (act, see the result, reload and see it
hold); repeat the end state at 390 px and dark when the change is responsive or
themed.

## 4. Run the specs that cover the area

Run the existing spec for the area you changed, not the whole suite; CI runs all of it
after the deploy. The config (`apps/web/playwright.config.ts`) starts no server and aims
at `PLAYWRIGHT_BASE_URL`, so leave step 2's server running and point it there:

```sh
cd apps/web
PLAYWRIGHT_BASE_URL=http://localhost:5173 E2E_EMAIL=e2e@foxing.app \
  E2E_PASSKEY_PRIVATE_KEY=$(cat $SCRATCH/key) E2E_BOOK_SLUG=frankenstein-seed \
  npx playwright test --project=authed --reporter=list --output=$SCRATCH/test-results e2e/authed/library.spec.ts
```

The specs are `apps/web/e2e/` (public project, no env beyond the base URL) and
`apps/web/e2e/authed/` (`--project=authed`, signed in); run the spec named for the
area. `catalog.spec.ts` and `search.spec.ts` expect a fuller catalog than the four fake
books and may fail on count or genre, which is not your change. Never run
`onboarding-flow.spec.ts` here (it writes to the remote D1). `authed-plus` and
`authed-social` need more seeded accounts and the real Plus tier; leave them to CI.

For logic below the UI, the web app's integration tests run in a few seconds each:
`cd apps/web && npx vitest run test/<name>.integration.test.ts`. Before a push, from the root:
`npm run type-check`, `npm run lint`, `npm run format:check`.

## 5. Stop what you started

```sh
kill $(cat $SCRATCH/vite.pid)
```

`wrangler.jsonc`, `.dev.vars`, `.wrangler/` and `e2e/.auth/` are gitignored; leave them
or delete them, but never commit them (CLAUDE.md, public repo rule).

## Rules and report

Follow the Rules and the report in [devkit's docs/verify.md](https://github.com/DrDustinEdwards/devkit/blob/main/docs/verify.md). For this repo:

- Never run the seed scripts or a spec that writes with `--remote`, and never print the passkey key; keep the key in the scratchpad.
- Anything the local build cannot show, named as not verified: the real catalog and
  its covers and EPUBs (R2), the Images binding, real email and sign-in (Google, Apple,
  Turnstile, a new reader's email link), Stripe billing, the Anthropic companion, the
  club live room Durable Object over a real network, the edge cache and the deploy's
  headers. The check after the merge deploys runs by itself: the `deploy` job in
  `.github/workflows/ci-cf.yml` waits for `/health` and the home page and rolls back
  on failure, then the `e2e` job runs the full suite against the live site. Read both
  on the merged commit.
