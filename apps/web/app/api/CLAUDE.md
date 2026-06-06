# API Route Rules

Every route file here is a server endpoint. No client-side imports.

## Supabase client selection

Pick the right client -- never inline `createClient(URL, KEY, ...)`.

- Authed user routes (resolve the calling user from cookies):
  `createServerClient()` from `@/lib/supabase/server`
- Admin / service-role routes (read or write across users, bypass RLS):
  `createAdminClient()` from `@/lib/supabase/admin`
- Public routes that don't need a user (catalog reads, search):
  `createServerClient()` is fine; RLS will gate.

Never expose `createAdminClient()` to the browser. The service role key
is server-only.

## generateStaticParams

Always uses `createAdminClient()` -- never cookies. Static param generation
runs at build time with no request context.

## Cron routes (`app/api/cron/*`)

Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron-triggered
requests. First operation in every cron route:

```ts
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Always set `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.

## File uploads

All uploads go through `uploadToR2(bucket, key, buffer, contentType)` from
`@/lib/r2`. Bucket keys: `covers`, `epubs`, `avatars`, `journalImages`.
Never write directly to Supabase Storage in new code.

## Response headers

Per-user responses must include `Cache-Control: private, no-store`. The
default CDN cache will otherwise leak one user's data to the next.

## Journal helpers

Server routes import from `@/lib/journal` (server-only Supabase queries).
Never import `@/lib/journal` from a client component -- use
`@/lib/journal-shared` for code that crosses the boundary.

## Rate limiting

Public mutation routes (sign-up, log-404, AI calls) are rate-limited at
the firewall level (Vercel WAF). Don't roll a custom in-route limiter.
