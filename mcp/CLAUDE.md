# CLAUDE.md - mcp/ (Foxing Admin)

The repo's CLAUDE.md and `capsid/conventions.md` govern this folder too. The ruling is Capsid
`capsid/rulings/mcp-2026-10-10.md`; the design is `capsid/research/design-mcp-servers.md` section 5.

## What this is

Foxing Admin: the admin MCP server for foxing.app, its own Cloudflare Worker `foxing-admin-mcp`,
replacing the Vercel `foxing-admin-mcp` at cutover. Own package.json and npm lockfile (no workspace
dependency, and its SDK and OAuth versions are its own).

## Security floor (rules 12 and 13)

Each guard has a test marked PLANT; a guard is trusted only after its plant was seen red.

## Commands (in mcp/)

- `npm ci`, then `cp wrangler.jsonc.example wrangler.jsonc` for local work
- `npm run typecheck`, `npm test`, `npm run build` (dry run; typecheck is not a build)
- Deploy and cutover are Dustin's steps, listed in the PR. Never deploy from a session.
