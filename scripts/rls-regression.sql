-- RLS-recursion regression check (Pass 9 guard for the Pass 1 fix).
--
-- Incident: clubs_select and club_members_select referenced each other's
-- tables inside their policy quals, so every club read failed with
-- 42P17 infinite recursion. Fix (migration fix_club_rls_recursion_and_
-- write_policies): SECURITY DEFINER helpers private.is_club_member /
-- private.is_club_mod that read club_members without re-entering RLS.
--
-- This script re-runs the exact reads that used to recurse, as the
-- authenticated role, and asserts the helper shape. Any regression makes
-- the query itself error (42P17) or returns a false flag. Run via:
--   .\scripts\rls-regression.ps1
-- Read-only apart from the rolled-back SET LOCAL.

begin;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009999","role":"authenticated"}', true);

select json_build_object(
  -- the reads that 42P17'd before the fix; recursion would error this query
  'clubs_readable', (select count(*) >= 0 from public.clubs),
  'club_members_readable', (select count(*) >= 0 from public.club_members),

  -- both helpers exist, SECURITY DEFINER, pinned search_path
  'helpers_ok', (
    select count(*) = 2
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('is_club_member', 'is_club_mod')
      and p.prosecdef
      and p.proconfig @> array['search_path=public']
  ),

  -- the three policies that recursed still route through the helpers
  'clubs_select_uses_helper', (
    select qual like '%private.is_club_member%' from pg_policies
    where schemaname = 'public' and tablename = 'clubs'
      and policyname = 'clubs_select'),
  'club_members_select_uses_helper', (
    select qual like '%private.is_club_member%' from pg_policies
    where schemaname = 'public' and tablename = 'club_members'
      and policyname = 'club_members_select'),
  'clubs_update_uses_helper', (
    select qual like '%private.is_club_mod%' from pg_policies
    where schemaname = 'public' and tablename = 'clubs'
      and policyname = 'clubs_update_creator_or_mod')
) as rls_regression;

rollback;
