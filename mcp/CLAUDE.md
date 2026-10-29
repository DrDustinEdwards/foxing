# CLAUDE.md - mcp/ (Foxing Admin)

The repo's CLAUDE.md governs this folder too. The design is Capsid
`capsid/research/design-mcp-servers.md` section 5.

## What this is

Foxing Admin: the admin MCP server for foxing.app, its own Cloudflare Worker `foxing-admin-mcp`, a
wrapper over `/api/v1/admin`. Own package.json and npm lockfile (no workspace dependency).

## Security floor (rules 12 and 13)

Each guard has a test marked PLANT; a guard is trusted only after its plant was seen red.

## Commands (in mcp/)

- `npm ci`, `cp wrangler.jsonc.example wrangler.jsonc`, then `npm run typecheck`, `npm test`, `npm run build` (dry run)
- Deploy and cutover are Dustin's steps, listed in the PR. Never deploy from a session.
