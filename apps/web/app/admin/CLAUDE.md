# Admin Route Rules

Everything under `/admin` is gated to `profiles.is_admin = true`. The
layout double-checks even though middleware also enforces this -- keep
both. A misconfigured middleware matcher should never leak admin pages.

## Auth pattern

```ts
const userId = await getAuthedUserId()
if (!userId) redirect('/sign-in')
const admin = createAdminClient()
const { data: profile } = await admin
  .from('profiles')
  .select('is_admin')
  .eq('id', userId)
  .maybeSingle()
if (!profile?.is_admin) redirect('/home')
```

`getAuthedUserId()` from `@/lib/nav-user`.
`createAdminClient()` from `@/lib/supabase/admin`.

Never roll a custom admin check. Never trust middleware alone.

## Supabase client

Admin pages always use `createAdminClient()` -- service role, bypasses RLS.
Never instantiate the user-cookies client here; admin views read across
all users by design.

## Three book-club spaces -- do not mix

- `/admin/clubs`            -- user reading clubs (table: `clubs`)
- `/admin/celebrity-picks`  -- external curators
                              (tables: `external_book_clubs`,
                               `external_book_club_picks`)
- `/admin/book-of-month`    -- Foxing's own monthly pick
                              (table: `book_of_the_month`)

A query in the wrong admin tool against the wrong table will silently
return zero rows and look like missing data. Confirm the table before
writing the query.

## Naming Claude / Anthropic

Admin pages are internal-only -- you can name the underlying model
(Claude Sonnet 4, etc.) on debug screens like `/admin/analytics` if it
helps Dustin reason about cost. User-facing copy still says "AI".

## Audit-sensitive actions

Inline edits to celebrity picks log to `external_book_club_pick_edits`.
Don't bypass that table by writing directly to `external_book_club_picks`
in admin code -- the audit trail is the reason the table exists.

## Revalidation

After any admin mutation that affects a public page, call `revalidatePath`
for the specific route (or `revalidateTag` if the data was fetched with a
tag). Don't `revalidatePath('/')` -- it nukes the entire ISR cache.
