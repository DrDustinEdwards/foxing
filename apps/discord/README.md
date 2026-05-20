# Foxing Discord Activity

A Vite + React SPA that runs as a Discord Activity inside voice and text channels. Members of a channel launch Foxing together to track a club's reading, post chapter reactions, vote on polls, and run shared reading sprints.

## Local development

```
pnpm install
pnpm --filter @foxing/discord-activity dev
```

Dev server runs on `:5174`. API calls are proxied to `FOXING_API_URL` (defaults to `https://foxing.app`). Override with a local `.env` if you need to hit a dev API.

## Build

```
pnpm --filter @foxing/discord-activity build
```

Output is in `apps/discord/dist`.

## Deployment

Deploy this package to a **separate Vercel project** with:

- Root directory: `apps/discord`
- Build command: `pnpm build`
- Output directory: `dist`
- Framework preset: Vite

Once deployed, copy the deployment URL for the Developer Portal step below.

## Discord Developer Portal setup

Manual one-time steps required before this Activity can run:

1. Open <https://discord.com/developers/applications> and create a new application named `Foxing`.
2. In **Settings > Activities**, enable **Activities** for the application.
3. In **Activities > URL Mappings**, add a single root mapping:
   - Prefix: `/`
   - Target: the Vercel deployment URL from above
4. In **OAuth2 > Redirects**, add the same URL (some flows require this).
5. Copy the **Application ID** (also called the Client ID).
6. Set the following environment variables in the Vercel project for `apps/discord`:
   - `VITE_DISCORD_CLIENT_ID`: the Application ID from step 5
   - `FOXING_API_URL`: `https://foxing.app` (or your preview origin)
7. In the Vercel project for `apps/web`, add:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_SESSION_SECRET` (32+ random bytes; used to sign Activity session tokens)

   These are required to exchange the OAuth code for an access token in `/api/discord/auth` and to verify subsequent Activity requests.

## Architecture

- `src/lib/discord-sdk.ts`: initializes the Embedded App SDK, requests `identify` scope, and exchanges the code with `/api/discord/auth`.
- `src/lib/foxing-api.ts`: typed wrapper for the Foxing-side endpoints under `/api/discord/*`.
- `src/screens/ClubSelector.tsx`: lists the user's clubs.
- `src/screens/ClubDashboard.tsx`: four tabs (who's reading, discuss, vote, sprint).
- `src/screens/SprintTimer.tsx`: shared countdown computed client-side from server `starts_at`/`ends_at`; pages logged after the timer ends.

The Activity is intentionally read-mostly. Heavier flows (creating polls, scheduling meetings) live on `foxing.app` and link out via the footer.

## Foxing-side endpoints

Defined in `apps/web/app/api/discord/`:

- `POST /api/discord/auth`: exchange OAuth code, link Discord ID to a Foxing profile, return a session token.
- `GET /api/discord/clubs`: clubs the authenticated user belongs to.
- `GET /api/discord/club/[clubId]/dashboard`: current book, questions, reactions, active poll, member progress.
- `POST /api/discord/club/[clubId]/react`: insert a `chapter_reactions` row.
- `POST /api/discord/club/[clubId]/vote`: cast or change a vote on the active poll.
- `POST /api/discord/sprint/start`: start a new sprint.
- `GET /api/discord/sprint/[sprintId]`: poll sprint status.
- `POST /api/discord/sprint/[sprintId]/log`: log the caller's pages_read.

## Account linking

Activity users must have a Foxing account with `profiles.discord_id` set to their Discord user ID. Linking happens via the existing Foxing settings page (the Activity surfaces a "Connect Foxing account" deeplink when the lookup misses). The OAuth `code` flow only requests the `identify` scope.
