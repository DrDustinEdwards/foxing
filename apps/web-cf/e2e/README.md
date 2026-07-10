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

## Signed-in specs

E2E runs against a deployed target and cannot forge a verified Better Auth
session in CI. Signed-in specs (e.g. `library-write.spec.ts`) are gated on
`E2E_SESSION_TOKEN` and skip when it is absent. To run them, mint a session and
pass its token:

```
E2E_SESSION_TOKEN="<better-auth session token>" \
E2E_BOOK_SLUG="said-the-fisherman-pickthall" \
npx playwright test library-write.spec.ts
```
