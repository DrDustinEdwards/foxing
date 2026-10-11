# CLAUDE.md - mcp/ (Foxing Admin)

The repo's CLAUDE.md and `capsid/conventions.md` govern this folder too. The ruling is Capsid
`capsid/rulings/mcp-2026-10-10.md`; the design is `capsid/research/design-mcp-servers.md` section 5.

## What this is

Foxing Admin: the admin MCP server for foxing.app, its own Cloudflare Worker `foxing-admin-mcp`,
replacing the Vercel `foxing-admin-mcp` at cutover. Own package.json and npm lockfile (no workspace
dependency, and its SDK and OAuth versions are its own), so use `npm` here, not pnpm.

## The law

No policy, no gates, no second write path. Every tool call is authenticated HTTP to
`/api/v1/admin/*` on the `foxing` Worker over the `FOXING` service binding, with
`ADMIN_OPERATOR_TOKEN` as the bearer and `FOXING_ADMIN_ID` in `X-Foxing-Admin-Id`. The admin API
(`packages/api/src/routes/admin.ts`, `middleware/operator.ts`) owns every rule and re-checks the
acting admin on every call. Never in this folder:

- an import from `apps/` or `packages/` (`test/wrapper.test.ts` fails on one);
- a D1, R2, Stripe or any data binding, or a service binding other than `FOXING`
  (`test/wrapper.test.ts` derives the allowlist from `wrangler.jsonc.example`);
- a tool the admin API does not offer, or a rule the API already makes. Input schemas are fine.

Refusals are relayed verbatim: the API's message, code and details.

## Security floor (rules 12 and 13)

- 12.1: `authorizeCall` re-proves the grant is the administrator's on every call; `apiHandler`
  re-checks at the door. 12.2: tokens are bound to `PUBLIC_ORIGIN/mcp` and `apiHandler` checks the
  audience; no token passthrough. 12.3: `foxing.read` always, `foxing.write` only when ticked on
  the consent page. 12.4: `ToolCallLog`, append-only, written before and after each call. 12.5:
  reader-written text is marked as data. 12.6: tier changes wait for the staged route (#20).
- 13: CIMD on; DCR only for redirect URIs listed exactly in `DCR_REDIRECT_URIS`, rate limited.

Each guard has a test marked PLANT; a guard is trusted only after its plant was seen red.

## Commands (in mcp/)

- `npm ci`, then `cp wrangler.jsonc.example wrangler.jsonc` for local work
- `npm run typecheck`, `npm test`, `npm run build` (dry run; typecheck is not a build)
- Deploy and cutover are Dustin's steps, listed in the PR. Never deploy from a session.
