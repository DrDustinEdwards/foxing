# e2e rules

Permanent rule for every spec in this directory:

**Interact only with what a human can see and click.**

- Drive the visible control: `getByRole`, `getByText`, `click`, `fill`, and
  `selectOption` on the actual on-screen element.
- Never dispatch synthetic DOM events, never set values on hidden inputs, never
  reach past the rendered UI to force a state the user cannot reach by clicking.
- Stubbing the network response (`page.route`) is allowed to make assertions
  deterministic; the interaction that triggers the request must still be a real
  click/select on the visible control.

Why: a prior "verification" of the library write flow passed by calling the API
directly with a header-injected session (`x-test-user`) and never touched the
rendered control. It reported success while a human could not commit a selection.
A test that does not click what the user clicks proves nothing about the user.

Corollary for the whole repo: D1 row checks are Fable's independent verification,
never a slice's own gate. Integration tests may call a core function or loader
directly with a user id (that is not a forged session), but no test asserts a
slice is healthy by reading rows through a forged HTTP session.

## Signed-in specs

Signed-in specs live in `e2e/authed/` and reuse a session captured by
`auth.setup.ts`, which signs in by TYPING INTO THE VISIBLE LOGIN FORM and clicking
submit, then saves the browser's own session to `e2e/.auth/user.json`. No cookie
injection, no minted tokens, no header sessions.

The session comes from a persistent, verified, onboarded e2e account seeded once in
the target D1 (`scripts/seed-e2e-user.mjs`). Its password is a secret. Provide it
via `E2E_EMAIL` / `E2E_PASSWORD`:

```
E2E_EMAIL="e2e@foxing.app" E2E_PASSWORD="..." \
E2E_BOOK_SLUG="said-the-fisherman-pickthall" \
npx playwright test --project=authed
```

If the credentials are missing, `auth.setup.ts` fails loudly. It never skips: a
skipped signed-in suite is how a broken authed flow shipped last time. In CI the
signed-in specs run with `E2E_EMAIL` / `E2E_PASSWORD` from repo secrets. To run only
the anonymous suite locally: `npx playwright test --project=public`.

## Projects

- `setup` runs `auth.setup.ts` (real form sign-in, saves the session).
- `public` runs everything in `e2e/` except `authed/` and the setup, anonymously.
- `authed` runs `e2e/authed/` with the saved session; depends on `setup`.
