-- Series seed data — apply via Supabase MCP / SQL editor.
-- Adds books.series_name and books.series_order if missing, then tags the
-- canonical public-domain series we curate.
--
-- NOTE: ILIKE matches are intentionally generous. The catalog has slight
-- title variants (e.g. "Sherlock Holmes: The Memoirs of"). Re-run after
-- ingesting more books — every WHERE clause is idempotent (UPDATE on the
-- same rows is a no-op).

alter table books add column if not exists series_name text;
alter table books add column if not exists series_order integer;

-- ── Arthur Conan Doyle — Sherlock Holmes ────────────────────────────────
update books set series_name = 'Sherlock Holmes', series_order = 1
  where author ilike '%conan doyle%' and title ilike '%adventures of sherlock holmes%';
update books set series_name = 'Sherlock Holmes', series_order = 2
  where author ilike '%conan doyle%' and title ilike '%memoirs of sherlock holmes%';
update books set series_name = 'Sherlock Holmes', series_order = 3
  where author ilike '%conan doyle%' and title ilike '%return of sherlock holmes%';
update books set series_name = 'Sherlock Holmes', series_order = 4
  where author ilike '%conan doyle%' and title ilike '%his last bow%';
update books set series_name = 'Sherlock Holmes', series_order = 5
  where author ilike '%conan doyle%' and title ilike '%case%book of sherlock holmes%';

-- ── Agatha Christie — Poirot ────────────────────────────────────────────
-- Christie's Poirot novels follow internal chronology that's hard to infer
-- from titles alone — series_order is left null so the UI just shows the
-- series badge without an ordered position.
update books set series_name = 'Hercule Poirot'
  where author ilike '%christie%'
  and (title ilike '%poirot%' or title ilike '%mysterious affair at styles%'
       or title ilike '%murder on the orient express%' or title ilike '%abc murders%');

-- ── Agatha Christie — Miss Marple ───────────────────────────────────────
update books set series_name = 'Miss Marple'
  where author ilike '%christie%' and title ilike '%miss marple%';

-- ── P.G. Wodehouse — Jeeves ─────────────────────────────────────────────
update books set series_name = 'Jeeves'
  where author ilike '%wodehouse%'
  and (title ilike '%jeeves%' or title ilike '%my man jeeves%' or title ilike '%right ho, jeeves%');

-- ── G.K. Chesterton — Father Brown ──────────────────────────────────────
update books set series_name = 'Father Brown', series_order = 1
  where author ilike '%chesterton%' and title ilike '%innocence of father brown%';
update books set series_name = 'Father Brown', series_order = 2
  where author ilike '%chesterton%' and title ilike '%wisdom of father brown%';
update books set series_name = 'Father Brown', series_order = 3
  where author ilike '%chesterton%' and title ilike '%incredulity of father brown%';
update books set series_name = 'Father Brown', series_order = 4
  where author ilike '%chesterton%' and title ilike '%secret of father brown%';
update books set series_name = 'Father Brown', series_order = 5
  where author ilike '%chesterton%' and title ilike '%scandal of father brown%';

-- ── Edgar Rice Burroughs — Tarzan ───────────────────────────────────────
update books set series_name = 'Tarzan', series_order = 1
  where author ilike '%burroughs%' and title ilike '%tarzan of the apes%';
update books set series_name = 'Tarzan', series_order = 2
  where author ilike '%burroughs%' and title ilike '%return of tarzan%';
update books set series_name = 'Tarzan'
  where author ilike '%burroughs%' and title ilike '%tarzan%';

-- ── Edgar Rice Burroughs — Barsoom (John Carter of Mars) ────────────────
update books set series_name = 'Barsoom', series_order = 1
  where author ilike '%burroughs%' and title ilike '%princess of mars%';
update books set series_name = 'Barsoom', series_order = 2
  where author ilike '%burroughs%' and title ilike '%gods of mars%';
update books set series_name = 'Barsoom', series_order = 3
  where author ilike '%burroughs%' and title ilike '%warlord of mars%';

-- ── Maurice Leblanc — Arsène Lupin ──────────────────────────────────────
update books set series_name = 'Arsène Lupin'
  where author ilike '%leblanc%' and (title ilike '%lupin%' or title ilike '%hollow needle%');
