


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."is_club_member"("p_club" "uuid", "p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from club_members cm where cm.club_id = p_club and cm.user_id = p_user and coalesce(cm.status, 'active') = 'active') $$;


ALTER FUNCTION "private"."is_club_member"("p_club" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_club_mod"("p_club" "uuid", "p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from club_members cm where cm.club_id = p_club and cm.user_id = p_user and cm.role in ('admin','moderator') and coalesce(cm.status, 'active') = 'active') $$;


ALTER FUNCTION "private"."is_club_mod"("p_club" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."author_last_name"("author_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  parts TEXT[];
BEGIN
  -- Handle "Last, First" format (contains comma)
  IF author_name LIKE '%,%' THEN
    RETURN trim(split_part(author_name, ',', 1));
  END IF;
  -- Handle "First Last" format — take last word
  parts := regexp_split_to_array(trim(author_name), '\s+');
  RETURN parts[array_length(parts, 1)];
END;
$$;


ALTER FUNCTION "public"."author_last_name"("author_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_badge_if_not_exists"("p_user_id" "uuid", "p_badge_slug" "text", "p_xp" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  SELECT id INTO v_badge_id FROM public.badges WHERE slug = p_badge_slug;
  IF v_badge_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_badges (user_id, badge_id, earned_at)
  VALUES (p_user_id, v_badge_id, now())
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  IF FOUND AND p_xp > 0 THEN
    PERFORM public.increment_xp(p_user_id, p_xp);
  END IF;
END;
$$;


ALTER FUNCTION "public"."award_badge_if_not_exists"("p_user_id" "uuid", "p_badge_slug" "text", "p_xp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_club_founder_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.creator_id IS NOT NULL THEN
    PERFORM public.award_badge_if_not_exists(NEW.creator_id, 'club_founder', 50);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_club_founder_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_club_join_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.club_members WHERE user_id = NEW.user_id AND status = 'active';
    IF v_count = 1 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'first_club', 25);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_club_join_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_first_discussion_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.club_posts WHERE author_id = NEW.author_id;
  IF v_count = 1 THEN
    PERFORM public.award_badge_if_not_exists(NEW.author_id, 'first_discussion', 25);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_first_discussion_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_helpful_commenter_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_post_author_id uuid;
  v_agree_count integer;
BEGIN
  IF NEW.reaction = 'agree' THEN
    SELECT author_id INTO v_post_author_id FROM public.discussion_posts WHERE id = NEW.post_id;
    IF v_post_author_id IS NULL THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_agree_count
    FROM public.post_reactions pr
    JOIN public.discussion_posts dp ON dp.id = pr.post_id
    WHERE dp.author_id = v_post_author_id AND pr.reaction = 'agree';
    IF v_agree_count >= 10 THEN
      PERFORM public.award_badge_if_not_exists(v_post_author_id, 'helpful_commenter', 100);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_helpful_commenter_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_highlight_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_count FROM public.highlights WHERE user_id = NEW.user_id;
    IF v_count = 1 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'first_highlight', 25);
    END IF;
    IF v_count = 100 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'hundred_highlights', 100);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_highlight_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_reading_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_finished_count integer;
  v_distinct_themes integer;
BEGIN
  IF NEW.status = 'finished' AND (TG_OP = 'INSERT' OR OLD.status != 'finished') THEN
    SELECT COUNT(*) INTO v_finished_count
    FROM public.user_books WHERE user_id = NEW.user_id AND status = 'finished';
    IF v_finished_count = 1 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'first_book', 50);
    END IF;
    IF v_finished_count = 10 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'ten_books', 100);
    END IF;
    IF v_finished_count = 100 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'hundred_books', 500);
    END IF;
    SELECT COUNT(DISTINCT theme) INTO v_distinct_themes
    FROM public.user_books ub
    JOIN public.books b ON b.id = ub.book_id,
    unnest(b.themes) AS theme
    WHERE ub.user_id = NEW.user_id AND ub.status = 'finished';
    IF v_distinct_themes >= 5 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'genre_explorer', 100);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_reading_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_session_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_night_count integer;
BEGIN
  IF NEW.avg_wpm IS NOT NULL AND NEW.avg_wpm > 300 THEN
    PERFORM public.award_badge_if_not_exists(NEW.user_id, 'speed_reader', 75);
  END IF;
  IF EXTRACT(HOUR FROM NEW.started_at AT TIME ZONE 'UTC') < 4 THEN
    SELECT COUNT(*) INTO v_night_count
    FROM public.reading_sessions
    WHERE user_id = NEW.user_id
      AND EXTRACT(HOUR FROM started_at AT TIME ZONE 'UTC') < 4;
    IF v_night_count >= 5 THEN
      PERFORM public.award_badge_if_not_exists(NEW.user_id, 'night_owl', 75);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_session_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_streak_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.current_streak >= 7 THEN
    PERFORM public.award_badge_if_not_exists(NEW.user_id, 'week_streak', 50);
  END IF;
  IF NEW.current_streak >= 30 THEN
    PERFORM public.award_badge_if_not_exists(NEW.user_id, 'month_streak', 150);
  END IF;
  IF NEW.current_streak >= 365 THEN
    PERFORM public.award_badge_if_not_exists(NEW.user_id, 'year_streak', 1000);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_streak_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_duplicate_slugs"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(count(*), 0)::bigint
  from (
    select slug from public.books
    where slug is not null
    group by slug
    having count(*) > 1
  ) d;
$$;


ALTER FUNCTION "public"."count_duplicate_slugs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      regexp_replace(
        lower(split_part(NEW.email, '@', 1)),
        '[^a-z0-9]', '', 'g'
      ) || '_' || substr(gen_random_uuid()::text, 1, 4)
    ),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_xp"("user_id" "uuid", "delta" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET xp_points = COALESCE(xp_points, 0) + delta
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."increment_xp"("user_id" "uuid", "delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_bookstore_event_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_club clubs%ROWTYPE;
  v_book books%ROWTYPE;
  post_text TEXT;
BEGIN
  IF NEW.event_date IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_club FROM clubs WHERE id = NEW.club_id;
  IF NOT FOUND OR v_club.is_verified = false THEN RETURN NEW; END IF;
  IF v_club.club_type != 'bookstore' THEN RETURN NEW; END IF;

  IF NEW.book_id IS NOT NULL THEN
    SELECT * INTO v_book FROM books WHERE id = NEW.book_id;
  END IF;

  post_text := NEW.title || E'\n';

  IF v_club.bookstore_city IS NOT NULL THEN
    post_text := post_text || v_club.name || ' · ' || v_club.bookstore_city;
    IF v_club.bookstore_state IS NOT NULL THEN
      post_text := post_text || ', ' || v_club.bookstore_state;
    END IF;
    post_text := post_text || E'\n';
  END IF;

  post_text := post_text || to_char(NEW.event_date AT TIME ZONE 'UTC', 'Mon DD · HH12:MI AM');

  IF NEW.event_location IS NOT NULL THEN
    post_text := post_text || ' · ' || NEW.event_location;
  END IF;

  IF v_book.title IS NOT NULL THEN
    post_text := post_text || E'\n' || v_book.title;
    IF v_book.author IS NOT NULL THEN
      post_text := post_text || ' by ' || v_book.author;
    END IF;
  END IF;

  IF char_length(post_text) > 280 THEN
    post_text := substr(post_text, 1, 277) || '...';
  END IF;

  INSERT INTO social_post_queue (
    content_text, platform, post_type,
    scheduled_for, related_id, related_type
  ) VALUES (
    post_text,
    ARRAY['bluesky', 'x'],
    'event',
    now(),
    NEW.id,
    'club_announcement'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_bookstore_event_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_celebrity_pick_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_club external_book_clubs%ROWTYPE;
  v_book books%ROWTYPE;
  post_text TEXT;
BEGIN
  IF NEW.is_published = false THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published = true THEN RETURN NEW; END IF;

  SELECT * INTO v_club FROM external_book_clubs WHERE id = NEW.club_id;
  SELECT * INTO v_book FROM books WHERE id = NEW.book_id;

  IF v_club.short_name IS NULL OR v_book.title IS NULL THEN
    RETURN NEW;
  END IF;

  post_text := v_club.short_name || '''s ' ||
    trim(to_char(make_date(NEW.pick_year, NEW.pick_month, 1), 'Month')) ||
    ' pick: ' || v_book.title || E'\n' ||
    'by ' || v_book.author;

  IF NEW.curator_quote IS NOT NULL THEN
    post_text := post_text || E'\n\n"' ||
      substr(NEW.curator_quote, 1, 160) || '"';
  END IF;

  IF char_length(post_text) > 280 THEN
    post_text := substr(post_text, 1, 277) || '...';
  END IF;

  INSERT INTO social_post_queue (
    content_text, platform, post_type,
    scheduled_for, related_id, related_type
  ) VALUES (
    post_text, ARRAY['bluesky', 'x'], 'celebrity_pick',
    now(), NEW.id, 'celebrity_pick'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_celebrity_pick_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."score_botm_candidates"() RETURNS TABLE("id" "uuid", "title" "text", "author" "text", "cover_url" "text", "finished_count" bigint, "highlight_count" bigint, "total_score" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    b.id, b.title, b.author, b.cover_url,
    COUNT(DISTINCT CASE WHEN ub.status = 'finished'
      AND ub.updated_at > NOW() - INTERVAL '30 days' THEN ub.id END) as finished_count,
    COUNT(DISTINCT CASE WHEN h.created_at > NOW() - INTERVAL '30 days' THEN h.id END) as highlight_count,
    (
      COUNT(DISTINCT CASE WHEN ub.status = 'finished'
        AND ub.updated_at > NOW() - INTERVAL '30 days' THEN ub.id END) * 3.0
      + COUNT(DISTINCT CASE WHEN h.created_at > NOW() - INTERVAL '30 days' THEN h.id END) * 2.0
    ) as total_score
  FROM books b
  LEFT JOIN user_books ub ON ub.book_id = b.id
  LEFT JOIN highlights h ON h.book_id = b.id
  WHERE b.id NOT IN (
    SELECT book_id FROM book_of_the_month
    WHERE created_at > NOW() - INTERVAL '365 days'
  )
  AND b.cover_url IS NOT NULL
  GROUP BY b.id, b.title, b.author, b.cover_url
  ORDER BY total_score DESC
  LIMIT 5;
$$;


ALTER FUNCTION "public"."score_botm_candidates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_announcement_expiry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    IF NEW.event_date IS NOT NULL THEN
      NEW.expires_at := NEW.event_date + INTERVAL '24 hours';
    ELSE
      NEW.expires_at := NEW.created_at + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_announcement_expiry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_club_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.slugify(NEW.name) || '-' || left(NEW.id::text, 4);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_club_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_diary_entry_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  book_slug_val TEXT;
  base_slug TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    SELECT slug INTO book_slug_val FROM public.books WHERE id = NEW.book_id;
    base_slug := COALESCE(book_slug_val, 'entry') || '-' || to_char(NEW.log_date, 'YYYY-MM-DD');
    candidate := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.diary_entries
      WHERE slug = candidate AND user_id = NEW.user_id AND id IS DISTINCT FROM NEW.id
    ) LOOP
      candidate := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_diary_entry_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reading_list_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.slugify(NEW.title) || '-' || left(NEW.id::text, 4);
    NEW.slug := left(base_slug, 100);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_reading_list_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("val" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(public.unaccent('public.unaccent'::regdictionary, trim(val))),
        '[^a-z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  );
END;
$$;


ALTER FUNCTION "public"."slugify"("val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_books_series_position"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.series_order IS DISTINCT FROM OLD.series_order THEN
    NEW.series_position := NEW.series_order;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_books_series_position"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_books_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    NEW.date_started := NEW.started_at;
  END IF;
  IF NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
    NEW.date_finished := NEW.finished_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_books_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_club_backfill"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'app_supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'app_service_role_key'
  LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/backfill-club-picks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('club_slug', NEW.slug)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_club_backfill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_book_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE v_book_id UUID;
BEGIN
  v_book_id := COALESCE(NEW.book_id, OLD.book_id);
  UPDATE books SET
    weighted_rating = (
      SELECT ROUND(AVG(rating_half::numeric / 2), 2)
      FROM user_books WHERE book_id = v_book_id AND rating_half IS NOT NULL
    ),
    rating_count = (
      SELECT COUNT(*) FROM user_books
      WHERE book_id = v_book_id AND rating_half IS NOT NULL
    )
  WHERE id = v_book_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_book_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_club_member_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_club_member_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_highlight_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE highlights SET like_count = like_count + 1 WHERE id = NEW.highlight_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE highlights SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.highlight_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_highlight_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_book_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE uid UUID;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  UPDATE profiles SET
    total_books_read = (
      SELECT COUNT(*) FROM user_books WHERE user_id = uid AND status = 'finished'
    )
  WHERE id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_profile_book_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_highlight_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE uid UUID;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  UPDATE profiles SET
    total_highlights = (SELECT COUNT(*) FROM highlights WHERE user_id = uid)
  WHERE id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_profile_highlight_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reading_list_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reading_lists SET like_count = like_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reading_lists SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_reading_list_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reading_streaks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_reading_streaks_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_action_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "params" "jsonb",
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor" "text",
    "source_ip" "text"
);


ALTER TABLE "public"."admin_action_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_value" "text",
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_by" "uuid"
);


ALTER TABLE "public"."admin_notification_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "count" integer DEFAULT 0
);


ALTER TABLE "public"."ai_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."author_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "website_url" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "verification_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text"),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "notes" "text",
    CONSTRAINT "author_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."author_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."author_question_upvotes" (
    "question_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."author_question_upvotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."author_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_profile_id" "uuid" NOT NULL,
    "asker_id" "uuid",
    "question" "text" NOT NULL,
    "answer" "text",
    "is_answered" boolean DEFAULT false NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "upvotes" integer DEFAULT 0 NOT NULL,
    "asked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "answered_at" timestamp with time zone,
    CONSTRAINT "author_questions_answer_check" CHECK (("char_length"("answer") <= 2000)),
    CONSTRAINT "author_questions_question_check" CHECK ((("char_length"("question") >= 10) AND ("char_length"("question") <= 500)))
);


ALTER TABLE "public"."author_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "category" "text",
    CONSTRAINT "badges_category_check" CHECK (("category" = ANY (ARRAY['reading'::"text", 'social'::"text", 'streak'::"text", 'club'::"text", 'milestone'::"text"])))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_ai_cache" (
    "book_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."book_ai_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_discussion_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model" "text" DEFAULT 'claude-sonnet-4-20250514'::"text" NOT NULL
);


ALTER TABLE "public"."book_discussion_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_of_the_month" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid",
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "category" "text" DEFAULT 'fiction'::"text",
    "curator_note" "text",
    "amazon_url" "text",
    "bookshop_url" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "book_of_the_month_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."book_of_the_month" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "cfi" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gutenberg_id" integer,
    "title" "text" NOT NULL,
    "author" "text" NOT NULL,
    "cover_url" "text",
    "source" "text" DEFAULT 'gutenberg'::"text" NOT NULL,
    "epub_url" "text",
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "subjects" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "word_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "series_name" "text",
    "series_order" integer,
    "country" "text",
    "themes" "text"[],
    "description" "text",
    "reading_difficulty" numeric,
    "source_type" "text" DEFAULT 'catalog'::"text",
    "isbn" "text",
    "isbn13" "text",
    "publication_year" integer,
    "publisher" "text",
    "external_url" "text",
    "amazon_url" "text",
    "bookshop_url" "text",
    "added_by" "uuid",
    "series_position" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text" NOT NULL,
    "author_slug" "text",
    "mood_tags" "text"[] DEFAULT '{}'::"text"[],
    "pacing" "text",
    "content_warnings" "text"[] DEFAULT '{}'::"text"[],
    "is_staff_pick" boolean DEFAULT false,
    "staff_pick_note" "text",
    "weighted_rating" numeric(3,2),
    "rating_count" integer DEFAULT 0,
    CONSTRAINT "books_source_type_check" CHECK (("source_type" = ANY (ARRAY['catalog'::"text", 'community'::"text"])))
);


ALTER TABLE "public"."books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_read_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buddy_read_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "page_number" integer,
    "chapter" "text",
    "has_spoiler" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buddy_read_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid",
    "user1_id" "uuid",
    "user2_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."buddy_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text",
    "target" integer NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "is_community" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "challenges_type_check" CHECK (("type" = ANY (ARRAY['books'::"text", 'pages'::"text", 'minutes'::"text", 'genres'::"text", 'streak'::"text"])))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapter_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "chapter_name" "text",
    "emoji" "text" NOT NULL,
    "note" "text",
    "privacy" "text" DEFAULT 'public'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chapter_reactions_privacy_check" CHECK (("privacy" = ANY (ARRAY['public'::"text", 'close_friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."chapter_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."close_friends" (
    "user_id" "uuid" NOT NULL,
    "friend_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."close_friends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "event_date" timestamp with time zone,
    "event_end_date" timestamp with time zone,
    "event_location" "text",
    "event_address" "text",
    "event_city" "text",
    "event_state" "text",
    "event_zip" "text",
    "book_id" "uuid",
    "author_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "is_removed" boolean DEFAULT false,
    "removed_by" "uuid",
    "removed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "club_announcements_body_check" CHECK (("char_length"("body") <= 2000)),
    CONSTRAINT "club_announcements_title_check" CHECK (("char_length"("title") <= 120))
);


ALTER TABLE "public"."club_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "book_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone,
    "is_current" boolean DEFAULT true
);


ALTER TABLE "public"."club_books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invited_user_id" "uuid",
    "invite_code" "text" DEFAULT "substr"("md5"(("random"())::"text"), 1, 8),
    "email" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "club_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."club_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_meeting_rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'going'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_meeting_rsvps_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'maybe'::"text", 'not_going'::"text"])))
);


ALTER TABLE "public"."club_meeting_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "book_id" "uuid",
    "meeting_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "location_name" "text",
    "location_address" "text",
    "location_url" "text",
    "meeting_type" "text" DEFAULT 'in_person'::"text" NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_rule" "text",
    "rsvp_limit" integer,
    "is_cancelled" boolean DEFAULT false NOT NULL,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_meetings_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['in_person'::"text", 'virtual'::"text", 'hybrid'::"text"])))
);


ALTER TABLE "public"."club_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "banned_at" timestamp with time zone,
    "banned_by" "uuid",
    "ban_reason" "text",
    "muted_until" timestamp with time zone,
    "muted_by" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "club_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'banned'::"text", 'muted'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_poll_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "book_id" "uuid",
    "label" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_poll_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rank" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."club_poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "poll_type" "text" DEFAULT 'single'::"text" NOT NULL,
    "closes_at" timestamp with time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_polls_poll_type_check" CHECK (("poll_type" = ANY (ARRAY['single'::"text", 'ranked'::"text"])))
);


ALTER TABLE "public"."club_polls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_post_reactions" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "parent_post_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "has_spoiler" boolean DEFAULT false,
    "is_edited" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_removed" boolean DEFAULT false,
    "removed_at" timestamp with time zone,
    "removed_by" "uuid",
    "removed_reason" "text",
    "is_pinned" boolean DEFAULT false,
    "like_count" integer DEFAULT 0
);


ALTER TABLE "public"."club_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "chapter_name" "text" NOT NULL,
    "unlock_date" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "book_id" "uuid",
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "chapter" "text",
    "is_pinned" boolean DEFAULT false,
    "is_ai_starter" boolean DEFAULT false,
    "has_spoilers" boolean DEFAULT false,
    "post_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_waitlist" (
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cover_url" "text",
    "creator_id" "uuid",
    "current_book_id" "uuid",
    "visibility" "text" DEFAULT 'public'::"text",
    "member_approval" boolean DEFAULT false,
    "max_members" integer,
    "reading_pace" "text",
    "chapters_per_week" integer,
    "genre_tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "member_count" integer DEFAULT 1,
    "slug" "text",
    "club_type" "text" DEFAULT 'reading'::"text",
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "bookstore_address" "text",
    "bookstore_city" "text",
    "bookstore_state" "text",
    "bookstore_zip" "text",
    "bookstore_website" "text",
    "bookstore_phone" "text",
    "bookstore_hours" "jsonb",
    "discord_webhook_url" "text",
    CONSTRAINT "clubs_club_type_check" CHECK (("club_type" = ANY (ARRAY['reading'::"text", 'bookstore'::"text"]))),
    CONSTRAINT "clubs_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'secret'::"text"])))
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commonplace_book" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "passage_text" "text" NOT NULL,
    "book_id" "uuid",
    "book_title" "text",
    "cfi" "text",
    "note" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."commonplace_book" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commonplace_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid",
    "passage_text" "text" NOT NULL,
    "cfi" "text",
    "note" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commonplace_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_shelf_books" (
    "shelf_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."custom_shelf_books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_shelves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_shelves_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 50)))
);


ALTER TABLE "public"."custom_shelves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diary_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "rating_half" integer,
    "review" "text",
    "privacy" "text" DEFAULT 'private'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    CONSTRAINT "diary_entries_privacy_check" CHECK (("privacy" = ANY (ARRAY['private'::"text", 'public'::"text", 'friends'::"text"])))
);


ALTER TABLE "public"."diary_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discord_sprint_participants" (
    "sprint_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pages_read" integer,
    "logged_at" timestamp with time zone
);


ALTER TABLE "public"."discord_sprint_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discord_sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "discord_channel_id" "text",
    "started_by" "uuid",
    "duration_minutes" integer DEFAULT 20 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."discord_sprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussion_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid",
    "parent_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "has_spoiler" boolean DEFAULT false,
    "is_edited" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."discussion_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "book_id" "uuid",
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'general'::"text",
    "chapter_gate" "text",
    "is_pinned" boolean DEFAULT false,
    "spoiler_tagged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "discussions_type_check" CHECK (("type" = ANY (ARRAY['general'::"text", 'chapter'::"text", 'prediction'::"text", 'first_impressions'::"text", 'deep_dive'::"text", 'hot_take'::"text", 'quote'::"text", 'character'::"text", 'theme'::"text", 'questions'::"text", 'wrap_up'::"text"])))
);


ALTER TABLE "public"."discussions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_book_club_pick_edits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pick_id" "uuid",
    "edited_by" "uuid",
    "edited_at" timestamp with time zone DEFAULT "now"(),
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text"
);


ALTER TABLE "public"."external_book_club_pick_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_book_club_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "book_id" "uuid",
    "picked_at" "date" NOT NULL,
    "pick_month" integer,
    "pick_year" integer,
    "category" "text",
    "official_url" "text",
    "notes" "text",
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "curator_quote" "text",
    "official_announcement_url" "text",
    "auto_source" "text",
    "auto_confidence" "text",
    "is_auto_discovered" boolean DEFAULT false,
    "last_edited_at" timestamp with time zone,
    "last_edited_by" "uuid",
    "era_label" "text",
    "era_start_year" integer,
    "era_end_year" integer
);


ALTER TABLE "public"."external_book_club_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_book_clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text" NOT NULL,
    "description" "text",
    "curator" "text",
    "website_url" "text",
    "logo_url" "text",
    "cadence" "text" DEFAULT 'monthly'::"text",
    "focus" "text",
    "sort_order" integer DEFAULT 99,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "eras" "jsonb"
);


ALTER TABLE "public"."external_book_clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."giveaway_entries" (
    "giveaway_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_winner" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."giveaway_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."giveaways" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "book_id" "uuid",
    "book_title" "text" NOT NULL,
    "book_author" "text" NOT NULL,
    "cover_url" "text",
    "description" "text",
    "copies" integer DEFAULT 1 NOT NULL,
    "entry_type" "text" DEFAULT 'digital'::"text" NOT NULL,
    "shipping_countries" "text"[] DEFAULT '{US}'::"text"[],
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "winner_count" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_verified_author_only" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "giveaways_copies_check" CHECK ((("copies" >= 1) AND ("copies" <= 10))),
    CONSTRAINT "giveaways_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['digital'::"text", 'physical'::"text"]))),
    CONSTRAINT "giveaways_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'ended'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."giveaways" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."highlight_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "highlight_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."highlight_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "cfi" "text" NOT NULL,
    "text" "text" NOT NULL,
    "color" "text" DEFAULT 'amber'::"text",
    "note" "text",
    "chapter" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_public" boolean DEFAULT false,
    "like_count" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."highlights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_post_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journal_post_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_post_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "saved_by" "text"
);


ALTER TABLE "public"."journal_post_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "cover_image_url" "text",
    "author_id" "uuid",
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "featured" boolean DEFAULT false NOT NULL,
    "og_title" "text",
    "og_description" "text",
    "canonical_url" "text",
    "reading_time_minutes" integer,
    "cover_image_alt" "text",
    "show_published_at" boolean DEFAULT true NOT NULL,
    "show_updated_at" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."journal_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_clients" (
    "client_id" "text" NOT NULL,
    "redirect_uris" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oauth_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_codes" (
    "code_hash" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "redirect_uri" "text" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "code_challenge_method" "text" DEFAULT 'S256'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oauth_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_tokens" (
    "token_hash" "text" NOT NULL,
    "token_type" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oauth_tokens_token_type_check" CHECK (("token_type" = ANY (ARRAY['access'::"text", 'refresh'::"text"])))
);


ALTER TABLE "public"."oauth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_404s" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path" "text" NOT NULL,
    "referrer" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."page_404s" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passage_comment_reactions" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passage_comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passage_comment_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid",
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passage_comment_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passage_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid",
    "book_id" "uuid",
    "author_id" "uuid",
    "cfi" "text" NOT NULL,
    "passage_text" "text" NOT NULL,
    "comment" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "visibility" "text" DEFAULT 'club'::"text",
    "spoiler_tagged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "passage_comments_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'club'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."passage_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passage_reactions" (
    "passage_comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passage_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "post_reactions_reaction_check" CHECK (("reaction" = ANY (ARRAY['agree'::"text", 'insightful'::"text", 'funny'::"text", 'moving'::"text", 'sad'::"text"])))
);


ALTER TABLE "public"."post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "reporter_id" "uuid",
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "post_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "post_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'dismissed'::"text", 'actioned'::"text"])))
);


ALTER TABLE "public"."post_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "favorite_genres" "text"[],
    "reading_personality" "text",
    "is_public" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "language_preference" "text" DEFAULT 'en'::"text",
    "custom_url" "text",
    "is_verified_author" boolean DEFAULT false,
    "is_verified_educator" boolean DEFAULT false,
    "reading_level" "text" DEFAULT 'bookworm'::"text",
    "xp_points" integer DEFAULT 0,
    "progress_is_public" boolean DEFAULT true,
    "is_admin" boolean DEFAULT false,
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "backdrop_url" "text",
    "is_suspended" boolean DEFAULT false,
    "total_books_read" integer DEFAULT 0,
    "total_highlights" integer DEFAULT 0,
    "theme_preference" "text" DEFAULT 'system'::"text",
    "discord_id" "text",
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'plus'::"text"]))),
    CONSTRAINT "profiles_theme_preference_check" CHECK (("theme_preference" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "passage_text" "text" NOT NULL,
    "template" "text" DEFAULT 'minimal'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "quote_cards_template_check" CHECK (("template" = ANY (ARRAY['minimal'::"text", 'ornate'::"text", 'dark'::"text", 'light'::"text", 'sepia'::"text"])))
);


ALTER TABLE "public"."quote_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text",
    "target" integer NOT NULL,
    "year" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "period_type" "text" DEFAULT 'annual'::"text" NOT NULL,
    "month" integer,
    "week" integer,
    CONSTRAINT "reading_goals_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "reading_goals_period_type_check" CHECK (("period_type" = ANY (ARRAY['annual'::"text", 'monthly'::"text", 'weekly'::"text"]))),
    CONSTRAINT "reading_goals_type_check" CHECK (("type" = ANY (ARRAY['books'::"text", 'pages'::"text", 'minutes'::"text", 'books_per_year'::"text", 'pages_per_day'::"text", 'minutes_per_day'::"text"]))),
    CONSTRAINT "reading_goals_week_check" CHECK ((("week" >= 1) AND ("week" <= 53)))
);


ALTER TABLE "public"."reading_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_list_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid",
    "book_id" "uuid",
    "position" integer DEFAULT 0,
    "note" "text",
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reading_list_books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_list_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reading_list_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false,
    "cover_url" "text",
    "like_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "is_featured" boolean DEFAULT false
);


ALTER TABLE "public"."reading_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "pages_read" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avg_wpm" integer,
    "last_wpm" integer
);


ALTER TABLE "public"."reading_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_streaks" (
    "user_id" "uuid" NOT NULL,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "last_read_date" "date",
    "streak_freeze_credits" integer DEFAULT 0,
    "total_books_finished" integer DEFAULT 0,
    "total_pages_read" integer DEFAULT 0,
    "total_highlights" integer DEFAULT 0,
    "total_words_looked_up" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reading_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_posts" (
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_post_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_text" "text" NOT NULL,
    "platform" "text"[] DEFAULT ARRAY['bluesky'::"text", 'x'::"text"],
    "post_type" "text" NOT NULL,
    "scheduled_for" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "related_id" "uuid",
    "related_type" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_post_queue_content_text_check" CHECK (("char_length"("content_text") <= 300)),
    CONSTRAINT "social_post_queue_post_type_check" CHECK (("post_type" = ANY (ARRAY['celebrity_pick'::"text", 'event'::"text", 'quote'::"text", 'birthday'::"text", 'otd'::"text", 'journal'::"text", 'botm'::"text", 'trivia'::"text", 'custom'::"text"]))),
    CONSTRAINT "social_post_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."social_post_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_book_tags" (
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL
);


ALTER TABLE "public"."user_book_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "progress_cfi" "text",
    "progress_percentage" double precision DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "personal_notes" "text",
    "rating" integer,
    "review" "text",
    "review_is_public" boolean DEFAULT false,
    "is_favorite" boolean DEFAULT false,
    "rating_half" integer,
    "date_started" timestamp with time zone,
    "date_finished" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mood" "text",
    "pacing" "text",
    "format" "text",
    "abandoned_at" timestamp with time zone,
    "paused_at" timestamp with time zone,
    "mood_tags" "text"[] DEFAULT '{}'::"text"[],
    "format_read" "text",
    "paused_note" "text",
    "review_likes" integer DEFAULT 0,
    CONSTRAINT "user_books_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "user_books_status_check" CHECK (("status" = ANY (ARRAY['want_to_read'::"text", 'reading'::"text", 'finished'::"text", 'abandoned'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."user_books" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_books"."rating" IS 'Deprecated whole-star rating (1-5). Use rating_half instead for display. Kept for Goodreads import compatibility.';



COMMENT ON COLUMN "public"."user_books"."rating_half" IS 'Half-star rating stored as 1-10 integer (1=0.5 stars, 10=5 stars, 7=3.5 stars). Display: value/2.';



CREATE TABLE IF NOT EXISTS "public"."user_challenges" (
    "user_id" "uuid" NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "progress" integer DEFAULT 0,
    "completed_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorites" (
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid",
    "position" integer NOT NULL,
    CONSTRAINT "user_favorites_position_check" CHECK ((("position" >= 1) AND ("position" <= 5)))
);


ALTER TABLE "public"."user_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocabulary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "word" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "context" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ai_context" "text",
    "book_title" "text",
    "context_sentence" "text",
    "mastered" boolean DEFAULT false,
    "looked_up_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vocabulary" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_action_log"
    ADD CONSTRAINT "admin_action_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notification_log"
    ADD CONSTRAINT "admin_notification_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."author_claims"
    ADD CONSTRAINT "author_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."author_claims"
    ADD CONSTRAINT "author_claims_verification_token_key" UNIQUE ("verification_token");



ALTER TABLE ONLY "public"."author_question_upvotes"
    ADD CONSTRAINT "author_question_upvotes_pkey" PRIMARY KEY ("question_id", "user_id");



ALTER TABLE ONLY "public"."author_questions"
    ADD CONSTRAINT "author_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."book_ai_cache"
    ADD CONSTRAINT "book_ai_cache_pkey" PRIMARY KEY ("book_id", "action");



ALTER TABLE ONLY "public"."book_discussion_guides"
    ADD CONSTRAINT "book_discussion_guides_book_id_key" UNIQUE ("book_id");



ALTER TABLE ONLY "public"."book_discussion_guides"
    ADD CONSTRAINT "book_discussion_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_of_the_month"
    ADD CONSTRAINT "book_of_the_month_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_of_the_month"
    ADD CONSTRAINT "book_of_the_month_year_month_category_key" UNIQUE ("year", "month", "category");



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_gutenberg_id_key" UNIQUE ("gutenberg_id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."buddy_read_posts"
    ADD CONSTRAINT "buddy_read_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_reads"
    ADD CONSTRAINT "buddy_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapter_reactions"
    ADD CONSTRAINT "chapter_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."close_friends"
    ADD CONSTRAINT "close_friends_pkey" PRIMARY KEY ("user_id", "friend_id");



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_books"
    ADD CONSTRAINT "club_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_invites"
    ADD CONSTRAINT "club_invites_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."club_invites"
    ADD CONSTRAINT "club_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_meeting_rsvps"
    ADD CONSTRAINT "club_meeting_rsvps_meeting_id_user_id_key" UNIQUE ("meeting_id", "user_id");



ALTER TABLE ONLY "public"."club_meeting_rsvps"
    ADD CONSTRAINT "club_meeting_rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_meetings"
    ADD CONSTRAINT "club_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_poll_options"
    ADD CONSTRAINT "club_poll_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_poll_votes"
    ADD CONSTRAINT "club_poll_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_poll_votes"
    ADD CONSTRAINT "club_poll_votes_poll_id_option_id_user_id_key" UNIQUE ("poll_id", "option_id", "user_id");



ALTER TABLE ONLY "public"."club_polls"
    ADD CONSTRAINT "club_polls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_post_reactions"
    ADD CONSTRAINT "club_post_reactions_pkey" PRIMARY KEY ("post_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."club_posts"
    ADD CONSTRAINT "club_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_schedule"
    ADD CONSTRAINT "club_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_threads"
    ADD CONSTRAINT "club_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_waitlist"
    ADD CONSTRAINT "club_waitlist_pkey" PRIMARY KEY ("club_id", "user_id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."commonplace_book"
    ADD CONSTRAINT "commonplace_book_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commonplace_entries"
    ADD CONSTRAINT "commonplace_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_shelf_books"
    ADD CONSTRAINT "custom_shelf_books_pkey" PRIMARY KEY ("shelf_id", "book_id");



ALTER TABLE ONLY "public"."custom_shelves"
    ADD CONSTRAINT "custom_shelves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_shelves"
    ADD CONSTRAINT "custom_shelves_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discord_sprint_participants"
    ADD CONSTRAINT "discord_sprint_participants_pkey" PRIMARY KEY ("sprint_id", "user_id");



ALTER TABLE ONLY "public"."discord_sprints"
    ADD CONSTRAINT "discord_sprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discussion_posts"
    ADD CONSTRAINT "discussion_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_book_club_pick_edits"
    ADD CONSTRAINT "external_book_club_pick_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_book_club_picks"
    ADD CONSTRAINT "external_book_club_picks_club_id_book_id_pick_year_pick_mon_key" UNIQUE ("club_id", "book_id", "pick_year", "pick_month");



ALTER TABLE ONLY "public"."external_book_club_picks"
    ADD CONSTRAINT "external_book_club_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_book_clubs"
    ADD CONSTRAINT "external_book_clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_book_clubs"
    ADD CONSTRAINT "external_book_clubs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("giveaway_id", "user_id");



ALTER TABLE ONLY "public"."giveaways"
    ADD CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."highlight_likes"
    ADD CONSTRAINT "highlight_likes_highlight_id_user_id_key" UNIQUE ("highlight_id", "user_id");



ALTER TABLE ONLY "public"."highlight_likes"
    ADD CONSTRAINT "highlight_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."highlights"
    ADD CONSTRAINT "highlights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_post_links"
    ADD CONSTRAINT "journal_post_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_post_links"
    ADD CONSTRAINT "journal_post_links_source_id_target_id_key" UNIQUE ("source_id", "target_id");



ALTER TABLE ONLY "public"."journal_post_versions"
    ADD CONSTRAINT "journal_post_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_posts"
    ADD CONSTRAINT "journal_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_posts"
    ADD CONSTRAINT "journal_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."oauth_codes"
    ADD CONSTRAINT "oauth_codes_pkey" PRIMARY KEY ("code_hash");



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("token_hash");



ALTER TABLE ONLY "public"."page_404s"
    ADD CONSTRAINT "page_404s_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passage_comment_reactions"
    ADD CONSTRAINT "passage_comment_reactions_pkey" PRIMARY KEY ("comment_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."passage_comment_replies"
    ADD CONSTRAINT "passage_comment_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passage_comments"
    ADD CONSTRAINT "passage_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passage_reactions"
    ADD CONSTRAINT "passage_reactions_pkey" PRIMARY KEY ("passage_comment_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("post_id", "user_id", "reaction");



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_custom_url_key" UNIQUE ("custom_url");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_discord_id_key" UNIQUE ("discord_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."quote_cards"
    ADD CONSTRAINT "quote_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_goals"
    ADD CONSTRAINT "reading_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_list_books"
    ADD CONSTRAINT "reading_list_books_list_id_book_id_key" UNIQUE ("list_id", "book_id");



ALTER TABLE ONLY "public"."reading_list_books"
    ADD CONSTRAINT "reading_list_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_list_likes"
    ADD CONSTRAINT "reading_list_likes_list_id_user_id_key" UNIQUE ("list_id", "user_id");



ALTER TABLE ONLY "public"."reading_list_likes"
    ADD CONSTRAINT "reading_list_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_lists"
    ADD CONSTRAINT "reading_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_sessions"
    ADD CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_streaks"
    ADD CONSTRAINT "reading_streaks_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("user_id", "post_id");



ALTER TABLE ONLY "public"."social_post_queue"
    ADD CONSTRAINT "social_post_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_book_tags"
    ADD CONSTRAINT "user_book_tags_pkey" PRIMARY KEY ("user_id", "book_id", "tag");



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_user_id_book_id_key" UNIQUE ("user_id", "book_id");



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("user_id", "challenge_id");



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("user_id", "position");



ALTER TABLE ONLY "public"."vocabulary"
    ADD CONSTRAINT "vocabulary_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_action_log_performed_at_idx" ON "public"."admin_action_log" USING "btree" ("performed_at" DESC);



CREATE INDEX "admin_notification_log_sent_by_idx" ON "public"."admin_notification_log" USING "btree" ("sent_by");



CREATE INDEX "author_claims_reviewed_by_idx" ON "public"."author_claims" USING "btree" ("reviewed_by");



CREATE INDEX "author_claims_user_id_idx" ON "public"."author_claims" USING "btree" ("user_id");



CREATE INDEX "author_question_upvotes_user_id_idx" ON "public"."author_question_upvotes" USING "btree" ("user_id");



CREATE INDEX "author_questions_asker_id_idx" ON "public"."author_questions" USING "btree" ("asker_id");



CREATE INDEX "author_questions_author_idx" ON "public"."author_questions" USING "btree" ("author_profile_id");



CREATE INDEX "author_questions_upvotes_idx" ON "public"."author_questions" USING "btree" ("upvotes" DESC);



CREATE INDEX "book_of_the_month_book_id_idx" ON "public"."book_of_the_month" USING "btree" ("book_id");



CREATE INDEX "bookmarks_book_id_idx" ON "public"."bookmarks" USING "btree" ("book_id");



CREATE INDEX "bookmarks_user_id_idx" ON "public"."bookmarks" USING "btree" ("user_id");



CREATE INDEX "books_added_by_created_idx" ON "public"."books" USING "btree" ("added_by", "created_at" DESC);



CREATE UNIQUE INDEX "books_epub_url_unique" ON "public"."books" USING "btree" ("epub_url");



CREATE INDEX "books_source_idx" ON "public"."books" USING "btree" ("source");



CREATE INDEX "books_title_idx" ON "public"."books" USING "btree" ("title");



CREATE INDEX "buddy_read_posts_author_id_idx" ON "public"."buddy_read_posts" USING "btree" ("author_id");



CREATE INDEX "challenges_creator_id_idx" ON "public"."challenges" USING "btree" ("creator_id");



CREATE INDEX "chapter_reactions_book_id_idx" ON "public"."chapter_reactions" USING "btree" ("book_id");



CREATE INDEX "chapter_reactions_user_id_idx" ON "public"."chapter_reactions" USING "btree" ("user_id");



CREATE INDEX "close_friends_friend_id_idx" ON "public"."close_friends" USING "btree" ("friend_id");



CREATE INDEX "club_announcements_author_id_idx" ON "public"."club_announcements" USING "btree" ("author_id");



CREATE INDEX "club_announcements_book_id_idx" ON "public"."club_announcements" USING "btree" ("book_id");



CREATE INDEX "club_announcements_created_by_idx" ON "public"."club_announcements" USING "btree" ("created_by");



CREATE INDEX "club_announcements_removed_by_idx" ON "public"."club_announcements" USING "btree" ("removed_by");



CREATE INDEX "club_books_book_id_idx" ON "public"."club_books" USING "btree" ("book_id");



CREATE INDEX "club_books_club_id_idx" ON "public"."club_books" USING "btree" ("club_id");



CREATE INDEX "club_invites_club_id_idx" ON "public"."club_invites" USING "btree" ("club_id");



CREATE INDEX "club_invites_invited_by_idx" ON "public"."club_invites" USING "btree" ("invited_by");



CREATE INDEX "club_invites_invited_user_id_idx" ON "public"."club_invites" USING "btree" ("invited_user_id");



CREATE INDEX "club_meetings_created_by_idx" ON "public"."club_meetings" USING "btree" ("created_by");



CREATE INDEX "club_members_banned_by_idx" ON "public"."club_members" USING "btree" ("banned_by");



CREATE INDEX "club_members_muted_by_idx" ON "public"."club_members" USING "btree" ("muted_by");



CREATE INDEX "club_members_user_id_idx" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "club_poll_options_book_id_idx" ON "public"."club_poll_options" USING "btree" ("book_id");



CREATE INDEX "club_polls_created_by_idx" ON "public"."club_polls" USING "btree" ("created_by");



CREATE INDEX "club_post_reactions_user_id_idx" ON "public"."club_post_reactions" USING "btree" ("user_id");



CREATE INDEX "club_posts_author_id_idx" ON "public"."club_posts" USING "btree" ("author_id");



CREATE INDEX "club_posts_parent_post_id_idx" ON "public"."club_posts" USING "btree" ("parent_post_id");



CREATE INDEX "club_posts_removed_by_idx" ON "public"."club_posts" USING "btree" ("removed_by");



CREATE INDEX "club_posts_thread_id_idx" ON "public"."club_posts" USING "btree" ("thread_id");



CREATE INDEX "club_schedule_club_id_idx" ON "public"."club_schedule" USING "btree" ("club_id");



CREATE INDEX "club_threads_author_id_idx" ON "public"."club_threads" USING "btree" ("author_id");



CREATE INDEX "club_threads_book_id_idx" ON "public"."club_threads" USING "btree" ("book_id");



CREATE INDEX "club_threads_club_id_idx" ON "public"."club_threads" USING "btree" ("club_id");



CREATE INDEX "club_waitlist_user_id_idx" ON "public"."club_waitlist" USING "btree" ("user_id");



CREATE INDEX "clubs_creator_id_idx" ON "public"."clubs" USING "btree" ("creator_id");



CREATE INDEX "clubs_current_book_id_idx" ON "public"."clubs" USING "btree" ("current_book_id");



CREATE INDEX "clubs_verified_by_idx" ON "public"."clubs" USING "btree" ("verified_by");



CREATE INDEX "commonplace_book_book_id_idx" ON "public"."commonplace_book" USING "btree" ("book_id");



CREATE INDEX "commonplace_book_user_id_idx" ON "public"."commonplace_book" USING "btree" ("user_id");



CREATE INDEX "commonplace_entries_book_id_idx" ON "public"."commonplace_entries" USING "btree" ("book_id");



CREATE INDEX "commonplace_entries_user_id_idx" ON "public"."commonplace_entries" USING "btree" ("user_id");



CREATE INDEX "custom_shelf_books_book_id_idx" ON "public"."custom_shelf_books" USING "btree" ("book_id");



CREATE INDEX "custom_shelves_position_idx" ON "public"."custom_shelves" USING "btree" ("user_id", "position");



CREATE INDEX "custom_shelves_user_id_idx" ON "public"."custom_shelves" USING "btree" ("user_id");



CREATE INDEX "diary_entries_book_id_idx" ON "public"."diary_entries" USING "btree" ("book_id");



CREATE INDEX "discord_sprint_participants_user_id_idx" ON "public"."discord_sprint_participants" USING "btree" ("user_id");



CREATE INDEX "discord_sprints_club_id_idx" ON "public"."discord_sprints" USING "btree" ("club_id");



CREATE INDEX "discord_sprints_started_by_idx" ON "public"."discord_sprints" USING "btree" ("started_by");



CREATE INDEX "discussion_posts_author_id_idx" ON "public"."discussion_posts" USING "btree" ("author_id");



CREATE INDEX "discussions_author_id_idx" ON "public"."discussions" USING "btree" ("author_id");



CREATE INDEX "discussions_club_id_idx" ON "public"."discussions" USING "btree" ("club_id");



CREATE INDEX "external_book_club_pick_edits_edited_by_idx" ON "public"."external_book_club_pick_edits" USING "btree" ("edited_by");



CREATE INDEX "external_book_club_pick_edits_pick_id_idx" ON "public"."external_book_club_pick_edits" USING "btree" ("pick_id");



CREATE INDEX "external_book_club_picks_book_id_idx" ON "public"."external_book_club_picks" USING "btree" ("book_id");



CREATE INDEX "external_book_club_picks_last_edited_by_idx" ON "public"."external_book_club_picks" USING "btree" ("last_edited_by");



CREATE INDEX "follows_following_id_idx" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "giveaway_entries_giveaway_idx" ON "public"."giveaway_entries" USING "btree" ("giveaway_id");



CREATE INDEX "giveaway_entries_user_id_idx" ON "public"."giveaway_entries" USING "btree" ("user_id");



CREATE INDEX "giveaways_book_id_idx" ON "public"."giveaways" USING "btree" ("book_id");



CREATE INDEX "giveaways_created_by_idx" ON "public"."giveaways" USING "btree" ("created_by");



CREATE INDEX "giveaways_status_idx" ON "public"."giveaways" USING "btree" ("status", "ends_at");



CREATE INDEX "highlight_likes_user_id_idx" ON "public"."highlight_likes" USING "btree" ("user_id");



CREATE INDEX "highlights_book_id_idx" ON "public"."highlights" USING "btree" ("book_id");



CREATE INDEX "highlights_user_book" ON "public"."highlights" USING "btree" ("user_id", "book_id");



CREATE INDEX "idx_announcements_city_state" ON "public"."club_announcements" USING "btree" ("event_state", "event_city");



CREATE INDEX "idx_announcements_club" ON "public"."club_announcements" USING "btree" ("club_id");



CREATE INDEX "idx_announcements_event_date" ON "public"."club_announcements" USING "btree" ("event_date");



CREATE INDEX "idx_announcements_expiry" ON "public"."club_announcements" USING "btree" ("expires_at");



CREATE INDEX "idx_books_author_slug" ON "public"."books" USING "btree" ("author_slug");



CREATE INDEX "idx_buddy_read_posts_read" ON "public"."buddy_read_posts" USING "btree" ("buddy_read_id", "created_at");



CREATE INDEX "idx_buddy_reads_book" ON "public"."buddy_reads" USING "btree" ("book_id");



CREATE INDEX "idx_buddy_reads_user1" ON "public"."buddy_reads" USING "btree" ("user1_id");



CREATE INDEX "idx_buddy_reads_user2" ON "public"."buddy_reads" USING "btree" ("user2_id");



CREATE INDEX "idx_club_meetings_book" ON "public"."club_meetings" USING "btree" ("book_id") WHERE ("book_id" IS NOT NULL);



CREATE INDEX "idx_club_meetings_club_date" ON "public"."club_meetings" USING "btree" ("club_id", "meeting_date");



CREATE INDEX "idx_club_meetings_upcoming" ON "public"."club_meetings" USING "btree" ("meeting_date") WHERE ("is_cancelled" = false);



CREATE INDEX "idx_club_polls_club" ON "public"."club_polls" USING "btree" ("club_id", "created_at" DESC);



CREATE INDEX "idx_clubs_bookstore" ON "public"."clubs" USING "btree" ("club_type", "is_verified", "bookstore_state", "bookstore_city");



CREATE INDEX "idx_diary_entries_slug" ON "public"."diary_entries" USING "btree" ("user_id", "slug");



CREATE INDEX "idx_diary_entries_user_public" ON "public"."diary_entries" USING "btree" ("user_id", "privacy", "log_date" DESC);



CREATE INDEX "idx_discussion_posts_discussion" ON "public"."discussion_posts" USING "btree" ("discussion_id", "created_at");



CREATE INDEX "idx_discussion_posts_parent" ON "public"."discussion_posts" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_discussions_book" ON "public"."discussions" USING "btree" ("book_id", "created_at" DESC);



CREATE INDEX "idx_discussions_type" ON "public"."discussions" USING "btree" ("book_id", "type");



CREATE INDEX "idx_meeting_rsvps_meeting" ON "public"."club_meeting_rsvps" USING "btree" ("meeting_id");



CREATE INDEX "idx_meeting_rsvps_user" ON "public"."club_meeting_rsvps" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_poll_options_poll" ON "public"."club_poll_options" USING "btree" ("poll_id", "position");



CREATE INDEX "idx_poll_votes_option" ON "public"."club_poll_votes" USING "btree" ("option_id");



CREATE INDEX "idx_poll_votes_poll" ON "public"."club_poll_votes" USING "btree" ("poll_id");



CREATE INDEX "idx_poll_votes_user" ON "public"."club_poll_votes" USING "btree" ("user_id");



CREATE INDEX "idx_reading_goals_user_year" ON "public"."reading_goals" USING "btree" ("user_id", "year");



CREATE INDEX "idx_reading_lists_slug" ON "public"."reading_lists" USING "btree" ("slug");



CREATE INDEX "idx_reading_sessions_active" ON "public"."reading_sessions" USING "btree" ("user_id", "book_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_user_badges_user" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_books_finished_user" ON "public"."user_books" USING "btree" ("user_id", "finished_at" DESC) WHERE ("status" = 'finished'::"text");



CREATE INDEX "idx_user_books_started_user" ON "public"."user_books" USING "btree" ("user_id", "started_at") WHERE ("status" = ANY (ARRAY['reading'::"text", 'finished'::"text"]));



CREATE INDEX "journal_post_links_source_idx" ON "public"."journal_post_links" USING "btree" ("source_id", "position");



CREATE INDEX "journal_post_links_target_id_idx" ON "public"."journal_post_links" USING "btree" ("target_id");



CREATE INDEX "journal_post_versions_post_idx" ON "public"."journal_post_versions" USING "btree" ("post_id", "saved_at" DESC);



CREATE INDEX "journal_posts_author_id_idx" ON "public"."journal_posts" USING "btree" ("author_id");



CREATE INDEX "journal_posts_scheduled_idx" ON "public"."journal_posts" USING "btree" ("published_at") WHERE (("is_published" = false) AND ("published_at" IS NOT NULL));



CREATE INDEX "oauth_codes_client_id_idx" ON "public"."oauth_codes" USING "btree" ("client_id");



CREATE INDEX "oauth_codes_expires_idx" ON "public"."oauth_codes" USING "btree" ("expires_at");



CREATE INDEX "oauth_tokens_client_id_idx" ON "public"."oauth_tokens" USING "btree" ("client_id");



CREATE INDEX "oauth_tokens_expires_idx" ON "public"."oauth_tokens" USING "btree" ("expires_at");



CREATE INDEX "passage_comment_reactions_user_id_idx" ON "public"."passage_comment_reactions" USING "btree" ("user_id");



CREATE INDEX "passage_comment_replies_author_id_idx" ON "public"."passage_comment_replies" USING "btree" ("author_id");



CREATE INDEX "passage_comment_replies_comment_id_idx" ON "public"."passage_comment_replies" USING "btree" ("comment_id");



CREATE INDEX "passage_comments_author_id_idx" ON "public"."passage_comments" USING "btree" ("author_id");



CREATE INDEX "passage_comments_book_id_idx" ON "public"."passage_comments" USING "btree" ("book_id");



CREATE INDEX "passage_comments_club_id_idx" ON "public"."passage_comments" USING "btree" ("club_id");



CREATE INDEX "passage_reactions_user_id_idx" ON "public"."passage_reactions" USING "btree" ("user_id");



CREATE INDEX "post_reactions_user_id_idx" ON "public"."post_reactions" USING "btree" ("user_id");



CREATE INDEX "post_reports_post_id_idx" ON "public"."post_reports" USING "btree" ("post_id");



CREATE INDEX "post_reports_reporter_id_idx" ON "public"."post_reports" USING "btree" ("reporter_id");



CREATE INDEX "post_reports_reviewed_by_idx" ON "public"."post_reports" USING "btree" ("reviewed_by");



CREATE INDEX "post_reports_status_created_idx" ON "public"."post_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "quote_cards_book_id_idx" ON "public"."quote_cards" USING "btree" ("book_id");



CREATE INDEX "quote_cards_user_id_idx" ON "public"."quote_cards" USING "btree" ("user_id");



CREATE UNIQUE INDEX "reading_goals_annual_unique" ON "public"."reading_goals" USING "btree" ("user_id", "year") WHERE ("period_type" = 'annual'::"text");



CREATE UNIQUE INDEX "reading_goals_monthly_unique" ON "public"."reading_goals" USING "btree" ("user_id", "year", "month") WHERE ("period_type" = 'monthly'::"text");



CREATE UNIQUE INDEX "reading_goals_weekly_unique" ON "public"."reading_goals" USING "btree" ("user_id", "year", "week") WHERE ("period_type" = 'weekly'::"text");



CREATE INDEX "reading_list_books_book_id_idx" ON "public"."reading_list_books" USING "btree" ("book_id");



CREATE INDEX "reading_list_likes_user_id_idx" ON "public"."reading_list_likes" USING "btree" ("user_id");



CREATE INDEX "reading_lists_user_id_idx" ON "public"."reading_lists" USING "btree" ("user_id");



CREATE INDEX "reading_sessions_book_id_idx" ON "public"."reading_sessions" USING "btree" ("book_id");



CREATE INDEX "reading_sessions_user_id_idx" ON "public"."reading_sessions" USING "btree" ("user_id");



CREATE INDEX "reading_sessions_user_started_idx" ON "public"."reading_sessions" USING "btree" ("user_id", "started_at");



CREATE INDEX "saved_posts_post_id_idx" ON "public"."saved_posts" USING "btree" ("post_id");



CREATE INDEX "user_badges_badge_id_idx" ON "public"."user_badges" USING "btree" ("badge_id");



CREATE INDEX "user_book_tags_book_id_idx" ON "public"."user_book_tags" USING "btree" ("book_id");



CREATE INDEX "user_books_book_id_idx" ON "public"."user_books" USING "btree" ("book_id");



CREATE INDEX "user_books_status_idx" ON "public"."user_books" USING "btree" ("status");



CREATE INDEX "user_books_user_id_idx" ON "public"."user_books" USING "btree" ("user_id");



CREATE INDEX "user_books_user_status_idx" ON "public"."user_books" USING "btree" ("user_id", "status");



CREATE INDEX "user_challenges_challenge_id_idx" ON "public"."user_challenges" USING "btree" ("challenge_id");



CREATE INDEX "user_favorites_book_id_idx" ON "public"."user_favorites" USING "btree" ("book_id");



CREATE INDEX "vocabulary_book_id_idx" ON "public"."vocabulary" USING "btree" ("book_id");



CREATE INDEX "vocabulary_user" ON "public"."vocabulary" USING "btree" ("user_id");



CREATE INDEX "vocabulary_user_book_idx" ON "public"."vocabulary" USING "btree" ("user_id", "book_id");



CREATE OR REPLACE TRIGGER "announcement_expiry" BEFORE INSERT ON "public"."club_announcements" FOR EACH ROW EXECUTE FUNCTION "public"."set_announcement_expiry"();



CREATE OR REPLACE TRIGGER "club_member_count_trigger" AFTER INSERT OR DELETE ON "public"."club_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_club_member_count"();



CREATE OR REPLACE TRIGGER "on_bookstore_event_created" AFTER INSERT ON "public"."club_announcements" FOR EACH ROW EXECUTE FUNCTION "public"."queue_bookstore_event_post"();



CREATE OR REPLACE TRIGGER "on_celebrity_pick_published" AFTER INSERT OR UPDATE ON "public"."external_book_club_picks" FOR EACH ROW EXECUTE FUNCTION "public"."queue_celebrity_pick_post"();



CREATE OR REPLACE TRIGGER "on_club_inserted" AFTER INSERT ON "public"."external_book_clubs" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_club_backfill"();



CREATE OR REPLACE TRIGGER "reading_streaks_updated_at" BEFORE UPDATE ON "public"."reading_streaks" FOR EACH ROW EXECUTE FUNCTION "public"."update_reading_streaks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_check_club_founder_badge" AFTER INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."check_club_founder_badge"();



CREATE OR REPLACE TRIGGER "trg_check_club_join_badge" AFTER INSERT ON "public"."club_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_club_join_badge"();



CREATE OR REPLACE TRIGGER "trg_check_first_discussion_badge" AFTER INSERT ON "public"."club_posts" FOR EACH ROW EXECUTE FUNCTION "public"."check_first_discussion_badge"();



CREATE OR REPLACE TRIGGER "trg_check_helpful_commenter_badge" AFTER INSERT ON "public"."post_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."check_helpful_commenter_badge"();



CREATE OR REPLACE TRIGGER "trg_check_highlight_badges" AFTER INSERT ON "public"."highlights" FOR EACH ROW EXECUTE FUNCTION "public"."check_highlight_badges"();



CREATE OR REPLACE TRIGGER "trg_check_reading_badges" AFTER INSERT OR UPDATE ON "public"."user_books" FOR EACH ROW EXECUTE FUNCTION "public"."check_reading_badges"();



CREATE OR REPLACE TRIGGER "trg_check_session_badges" AFTER INSERT ON "public"."reading_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."check_session_badges"();



CREATE OR REPLACE TRIGGER "trg_check_streak_badges" AFTER INSERT OR UPDATE ON "public"."reading_streaks" FOR EACH ROW EXECUTE FUNCTION "public"."check_streak_badges"();



CREATE OR REPLACE TRIGGER "trg_highlight_like_count" AFTER INSERT OR DELETE ON "public"."highlight_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_highlight_like_count"();



CREATE OR REPLACE TRIGGER "trg_reading_list_like_count" AFTER INSERT OR DELETE ON "public"."reading_list_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_reading_list_like_count"();



CREATE OR REPLACE TRIGGER "trg_set_club_slug" BEFORE INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."set_club_slug"();



CREATE OR REPLACE TRIGGER "trg_set_diary_entry_slug" BEFORE INSERT ON "public"."diary_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_diary_entry_slug"();



CREATE OR REPLACE TRIGGER "trg_set_reading_list_slug" BEFORE INSERT ON "public"."reading_lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_reading_list_slug"();



CREATE OR REPLACE TRIGGER "trg_sync_books_series" BEFORE UPDATE ON "public"."books" FOR EACH ROW EXECUTE FUNCTION "public"."sync_books_series_position"();



CREATE OR REPLACE TRIGGER "trg_sync_user_books_dates" BEFORE UPDATE ON "public"."user_books" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_books_dates"();



CREATE OR REPLACE TRIGGER "trg_update_book_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_book_rating"();



CREATE OR REPLACE TRIGGER "trg_update_highlight_count" AFTER INSERT OR DELETE ON "public"."highlights" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_highlight_count"();



CREATE OR REPLACE TRIGGER "trg_update_profile_book_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_book_count"();



ALTER TABLE ONLY "public"."admin_notification_log"
    ADD CONSTRAINT "admin_notification_log_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_claims"
    ADD CONSTRAINT "author_claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."author_claims"
    ADD CONSTRAINT "author_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_question_upvotes"
    ADD CONSTRAINT "author_question_upvotes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."author_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_question_upvotes"
    ADD CONSTRAINT "author_question_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."author_questions"
    ADD CONSTRAINT "author_questions_asker_id_fkey" FOREIGN KEY ("asker_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."author_questions"
    ADD CONSTRAINT "author_questions_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_ai_cache"
    ADD CONSTRAINT "book_ai_cache_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_discussion_guides"
    ADD CONSTRAINT "book_discussion_guides_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_of_the_month"
    ADD CONSTRAINT "book_of_the_month_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_read_posts"
    ADD CONSTRAINT "buddy_read_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_read_posts"
    ADD CONSTRAINT "buddy_read_posts_buddy_read_id_fkey" FOREIGN KEY ("buddy_read_id") REFERENCES "public"."buddy_reads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reads"
    ADD CONSTRAINT "buddy_reads_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reads"
    ADD CONSTRAINT "buddy_reads_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_reads"
    ADD CONSTRAINT "buddy_reads_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chapter_reactions"
    ADD CONSTRAINT "chapter_reactions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapter_reactions"
    ADD CONSTRAINT "chapter_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."close_friends"
    ADD CONSTRAINT "close_friends_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."close_friends"
    ADD CONSTRAINT "close_friends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_announcements"
    ADD CONSTRAINT "club_announcements_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_books"
    ADD CONSTRAINT "club_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_books"
    ADD CONSTRAINT "club_books_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invites"
    ADD CONSTRAINT "club_invites_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invites"
    ADD CONSTRAINT "club_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_invites"
    ADD CONSTRAINT "club_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_meeting_rsvps"
    ADD CONSTRAINT "club_meeting_rsvps_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."club_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_meeting_rsvps"
    ADD CONSTRAINT "club_meeting_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_meetings"
    ADD CONSTRAINT "club_meetings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_meetings"
    ADD CONSTRAINT "club_meetings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_meetings"
    ADD CONSTRAINT "club_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_muted_by_fkey" FOREIGN KEY ("muted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_poll_options"
    ADD CONSTRAINT "club_poll_options_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_poll_options"
    ADD CONSTRAINT "club_poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."club_polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_poll_votes"
    ADD CONSTRAINT "club_poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."club_poll_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_poll_votes"
    ADD CONSTRAINT "club_poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."club_polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_poll_votes"
    ADD CONSTRAINT "club_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_polls"
    ADD CONSTRAINT "club_polls_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_polls"
    ADD CONSTRAINT "club_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_post_reactions"
    ADD CONSTRAINT "club_post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."club_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_post_reactions"
    ADD CONSTRAINT "club_post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_posts"
    ADD CONSTRAINT "club_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_posts"
    ADD CONSTRAINT "club_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "public"."club_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_posts"
    ADD CONSTRAINT "club_posts_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_posts"
    ADD CONSTRAINT "club_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."club_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_schedule"
    ADD CONSTRAINT "club_schedule_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_threads"
    ADD CONSTRAINT "club_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_threads"
    ADD CONSTRAINT "club_threads_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_threads"
    ADD CONSTRAINT "club_threads_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_waitlist"
    ADD CONSTRAINT "club_waitlist_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_waitlist"
    ADD CONSTRAINT "club_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_current_book_id_fkey" FOREIGN KEY ("current_book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commonplace_book"
    ADD CONSTRAINT "commonplace_book_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commonplace_book"
    ADD CONSTRAINT "commonplace_book_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commonplace_entries"
    ADD CONSTRAINT "commonplace_entries_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commonplace_entries"
    ADD CONSTRAINT "commonplace_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_shelf_books"
    ADD CONSTRAINT "custom_shelf_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_shelf_books"
    ADD CONSTRAINT "custom_shelf_books_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "public"."custom_shelves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_shelves"
    ADD CONSTRAINT "custom_shelves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discord_sprint_participants"
    ADD CONSTRAINT "discord_sprint_participants_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."discord_sprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discord_sprint_participants"
    ADD CONSTRAINT "discord_sprint_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discord_sprints"
    ADD CONSTRAINT "discord_sprints_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discord_sprints"
    ADD CONSTRAINT "discord_sprints_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussion_posts"
    ADD CONSTRAINT "discussion_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussion_posts"
    ADD CONSTRAINT "discussion_posts_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discussion_posts"
    ADD CONSTRAINT "discussion_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."discussion_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_book_club_pick_edits"
    ADD CONSTRAINT "external_book_club_pick_edits_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."external_book_club_pick_edits"
    ADD CONSTRAINT "external_book_club_pick_edits_pick_id_fkey" FOREIGN KEY ("pick_id") REFERENCES "public"."external_book_club_picks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_book_club_picks"
    ADD CONSTRAINT "external_book_club_picks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_book_club_picks"
    ADD CONSTRAINT "external_book_club_picks_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."external_book_clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_book_club_picks"
    ADD CONSTRAINT "external_book_club_picks_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."giveaways"
    ADD CONSTRAINT "giveaways_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id");



ALTER TABLE ONLY "public"."giveaways"
    ADD CONSTRAINT "giveaways_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."highlight_likes"
    ADD CONSTRAINT "highlight_likes_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "public"."highlights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."highlight_likes"
    ADD CONSTRAINT "highlight_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."highlights"
    ADD CONSTRAINT "highlights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."highlights"
    ADD CONSTRAINT "highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_post_links"
    ADD CONSTRAINT "journal_post_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."journal_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_post_links"
    ADD CONSTRAINT "journal_post_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."journal_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_post_versions"
    ADD CONSTRAINT "journal_post_versions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."journal_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_posts"
    ADD CONSTRAINT "journal_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_codes"
    ADD CONSTRAINT "oauth_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_comment_reactions"
    ADD CONSTRAINT "passage_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."passage_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_comment_reactions"
    ADD CONSTRAINT "passage_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_comment_replies"
    ADD CONSTRAINT "passage_comment_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passage_comment_replies"
    ADD CONSTRAINT "passage_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."passage_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_comments"
    ADD CONSTRAINT "passage_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passage_comments"
    ADD CONSTRAINT "passage_comments_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_comments"
    ADD CONSTRAINT "passage_comments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_reactions"
    ADD CONSTRAINT "passage_reactions_passage_comment_id_fkey" FOREIGN KEY ("passage_comment_id") REFERENCES "public"."passage_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passage_reactions"
    ADD CONSTRAINT "passage_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."discussion_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."club_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reports"
    ADD CONSTRAINT "post_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_cards"
    ADD CONSTRAINT "quote_cards_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_cards"
    ADD CONSTRAINT "quote_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_goals"
    ADD CONSTRAINT "reading_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_list_books"
    ADD CONSTRAINT "reading_list_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_list_books"
    ADD CONSTRAINT "reading_list_books_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."reading_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_list_likes"
    ADD CONSTRAINT "reading_list_likes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."reading_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_list_likes"
    ADD CONSTRAINT "reading_list_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_lists"
    ADD CONSTRAINT "reading_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_sessions"
    ADD CONSTRAINT "reading_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_sessions"
    ADD CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_streaks"
    ADD CONSTRAINT "reading_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."club_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_book_tags"
    ADD CONSTRAINT "user_book_tags_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_book_tags"
    ADD CONSTRAINT "user_book_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_challenges"
    ADD CONSTRAINT "user_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocabulary"
    ADD CONSTRAINT "vocabulary_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocabulary"
    ADD CONSTRAINT "vocabulary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Active giveaways visible to all" ON "public"."giveaways" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Admin write clubs" ON "public"."external_book_clubs" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admin write picks" ON "public"."external_book_club_picks" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admins can view edit log" ON "public"."external_book_club_pick_edits" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admins manage all claims" ON "public"."author_claims" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage all giveaways" ON "public"."giveaways" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage journal" ON "public"."journal_posts" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admins manage picks" ON "public"."book_of_the_month" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admins manage social queue" ON "public"."social_post_queue" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Admins view all reports" ON "public"."post_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



CREATE POLICY "Anyone can see list likes" ON "public"."reading_list_likes" FOR SELECT USING (true);



CREATE POLICY "Askers see own questions" ON "public"."author_questions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "asker_id"));



CREATE POLICY "Authenticated users can ask" ON "public"."author_questions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "asker_id"));



CREATE POLICY "Authenticated users read passage comment replies" ON "public"."passage_comment_replies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authors answer own questions" ON "public"."author_questions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_profile_id"));



CREATE POLICY "Authors own passage comment replies" ON "public"."passage_comment_replies" TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Authors own passage comments" ON "public"."passage_comments" TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Badges readable by all" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "Book AI cache insertable" ON "public"."book_ai_cache" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Book AI cache readable by all" ON "public"."book_ai_cache" FOR SELECT USING (true);



CREATE POLICY "Books on public shelves visible to all" ON "public"."custom_shelf_books" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."custom_shelves"
  WHERE (("custom_shelves"."id" = "custom_shelf_books"."shelf_id") AND ("custom_shelves"."is_public" = true)))));



CREATE POLICY "Challenges readable by all" ON "public"."challenges" FOR SELECT USING (true);



CREATE POLICY "Chapter reactions viewable" ON "public"."chapter_reactions" FOR SELECT USING ((("privacy" = 'public'::"text") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Club members read comment reactions" ON "public"."passage_comment_reactions" FOR SELECT USING (true);



CREATE POLICY "Club members read reactions" ON "public"."club_post_reactions" FOR SELECT USING (true);



CREATE POLICY "Creators manage own giveaways" ON "public"."giveaways" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Discussion guides readable by all" ON "public"."book_discussion_guides" FOR SELECT USING (true);



CREATE POLICY "Entry counts visible to all" ON "public"."giveaway_entries" FOR SELECT USING (true);



CREATE POLICY "Favorites public viewable" ON "public"."user_favorites" FOR SELECT USING (true);



CREATE POLICY "Follows visible to all" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "List books inherit list visibility" ON "public"."reading_list_books" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."reading_lists"
  WHERE (("reading_lists"."id" = "reading_list_books"."list_id") AND (("reading_lists"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "reading_lists"."user_id"))))));



CREATE POLICY "List owners manage books" ON "public"."reading_list_books" USING ((EXISTS ( SELECT 1
   FROM "public"."reading_lists"
  WHERE (("reading_lists"."id" = "reading_list_books"."list_id") AND ("reading_lists"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Passage reactions readable by all" ON "public"."passage_reactions" FOR SELECT USING (true);



CREATE POLICY "Post reactions readable by authenticated" ON "public"."post_reactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public answered questions visible to all" ON "public"."author_questions" FOR SELECT USING ((("is_public" = true) AND ("is_answered" = true)));



CREATE POLICY "Public can see highlight likes" ON "public"."highlight_likes" FOR SELECT USING (true);



CREATE POLICY "Public can view published picks" ON "public"."book_of_the_month" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Public club meetings readable" ON "public"."club_meetings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_meetings"."club_id") AND ("c"."visibility" = 'public'::"text")))));



CREATE POLICY "Public clubs books readable by all" ON "public"."club_books" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_books"."club_id") AND ("c"."visibility" = 'public'::"text")))));



CREATE POLICY "Public commonplace readable" ON "public"."commonplace_book" FOR SELECT USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Public diary entries viewable" ON "public"."diary_entries" FOR SELECT USING ((("privacy" = 'public'::"text") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Public entries readable" ON "public"."commonplace_entries" FOR SELECT USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Public lists are viewable" ON "public"."reading_lists" FOR SELECT USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Public passage comments readable" ON "public"."passage_comments" FOR SELECT USING (("visibility" = 'public'::"text"));



CREATE POLICY "Public read active announcements from public clubs" ON "public"."club_announcements" FOR SELECT USING ((("expires_at" > "now"()) AND ("is_removed" = false) AND ("club_id" IN ( SELECT "clubs"."id"
   FROM "public"."clubs"
  WHERE ("clubs"."visibility" = 'public'::"text")))));



CREATE POLICY "Public read clubs" ON "public"."external_book_clubs" FOR SELECT USING (true);



CREATE POLICY "Public read picks" ON "public"."external_book_club_picks" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Public shelves visible to all" ON "public"."custom_shelves" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Public view favorites" ON "public"."user_favorites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "user_favorites"."user_id") AND ("profiles"."is_public" = true)))));



CREATE POLICY "Published posts public" ON "public"."journal_posts" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Service role manages discussion guides" ON "public"."book_discussion_guides" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages rate limits" ON "public"."ai_rate_limits" USING (false);



CREATE POLICY "Sprint participants manage own rows" ON "public"."discord_sprint_participants" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Upvotes visible to all" ON "public"."author_question_upvotes" FOR SELECT USING (true);



CREATE POLICY "Users can delete own follows" ON "public"."follows" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users can insert own follows" ON "public"."follows" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users can like highlights" ON "public"."highlight_likes" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage books on own shelves" ON "public"."custom_shelf_books" USING ((EXISTS ( SELECT 1
   FROM "public"."custom_shelves"
  WHERE (("custom_shelves"."id" = "custom_shelf_books"."shelf_id") AND ("custom_shelves"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."custom_shelves"
  WHERE (("custom_shelves"."id" = "custom_shelf_books"."shelf_id") AND ("custom_shelves"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can manage own shelves" ON "public"."custom_shelves" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage own sprints" ON "public"."discord_sprints" USING ((( SELECT "auth"."uid"() AS "uid") = "started_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "started_by"));



CREATE POLICY "Users can report posts" ON "public"."post_reports" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



CREATE POLICY "Users manage close friends" ON "public"."close_friends" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own RSVPs" ON "public"."club_meeting_rsvps" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own challenges" ON "public"."challenges" USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Users manage own claims" ON "public"."author_claims" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own comment reactions" ON "public"."passage_comment_reactions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own entries" ON "public"."giveaway_entries" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own follows" ON "public"."follows" USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Users manage own passage reactions" ON "public"."passage_reactions" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own post reactions" ON "public"."post_reactions" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own reactions" ON "public"."club_post_reactions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own streaks" ON "public"."reading_streaks" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own upvotes" ON "public"."author_question_upvotes" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own votes" ON "public"."club_poll_votes" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage their own diary" ON "public"."diary_entries" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage their own likes" ON "public"."reading_list_likes" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage their own lists" ON "public"."reading_lists" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own book tags" ON "public"."user_book_tags" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own bookmarks" ON "public"."bookmarks" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own chapter reactions" ON "public"."chapter_reactions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own commonplace" ON "public"."commonplace_book" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own commonplace entries" ON "public"."commonplace_entries" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own favorites" ON "public"."user_favorites" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own quote cards" ON "public"."quote_cards" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own reports" ON "public"."post_reports" USING ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



CREATE POLICY "Users own saved posts" ON "public"."saved_posts" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own user_challenges" ON "public"."user_challenges" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own waitlist entries" ON "public"."club_waitlist" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users see their own invites" ON "public"."club_invites" FOR SELECT TO "authenticated" USING (("invited_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Verified authors create giveaways" ON "public"."giveaways" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_verified_author" = true)))));



ALTER TABLE "public"."admin_action_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_notification_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins can insert books" ON "public"."books" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "admins can update books" ON "public"."books" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "admins read notification log" ON "public"."admin_notification_log" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."is_admin" = true))));



ALTER TABLE "public"."ai_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_insert_notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."author_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."author_question_upvotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."author_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_ai_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_discussion_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_of_the_month" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "books are viewable by everyone" ON "public"."books" FOR SELECT USING (true);



ALTER TABLE "public"."buddy_read_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_read_posts_delete_own" ON "public"."buddy_read_posts" FOR DELETE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "buddy_read_posts_insert" ON "public"."buddy_read_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."buddy_reads" "br"
  WHERE (("br"."id" = "buddy_read_posts"."buddy_read_id") AND (("br"."user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("br"."user2_id" = ( SELECT "auth"."uid"() AS "uid"))) AND ("br"."is_active" = true))))));



CREATE POLICY "buddy_read_posts_select" ON "public"."buddy_read_posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."buddy_reads" "br"
  WHERE (("br"."id" = "buddy_read_posts"."buddy_read_id") AND (("br"."user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("br"."user2_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."buddy_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_reads_insert" ON "public"."buddy_reads" FOR INSERT TO "authenticated" WITH CHECK (("user1_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "buddy_reads_select" ON "public"."buddy_reads" FOR SELECT TO "authenticated" USING ((("user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user2_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "buddy_reads_update" ON "public"."buddy_reads" FOR UPDATE TO "authenticated" USING ((("user1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user2_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapter_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."close_friends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_announcements_mod_insert" ON "public"."club_announcements" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "club_announcements_mod_update" ON "public"."club_announcements" FOR UPDATE TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_announcements_select_member" ON "public"."club_announcements" FOR SELECT USING ((("is_removed" = false) AND "private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."club_books" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_books_mod_all" ON "public"."club_books" TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_books_select_member" ON "public"."club_books" FOR SELECT TO "authenticated" USING ("private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."club_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_invites_mod_all" ON "public"."club_invites" TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."club_meeting_rsvps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_meeting_rsvps_select_member" ON "public"."club_meeting_rsvps" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_meetings" "m"
  WHERE (("m"."id" = "club_meeting_rsvps"."meeting_id") AND "private"."is_club_member"("m"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."club_meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_meetings_mod_all" ON "public"."club_meetings" TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_meetings_select_member" ON "public"."club_meetings" FOR SELECT TO "authenticated" USING ("private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."club_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_members_delete_self" ON "public"."club_members" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_members_insert_self" ON "public"."club_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_members_select" ON "public"."club_members" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."club_poll_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_poll_options_mod_all" ON "public"."club_poll_options" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_polls" "p"
  WHERE (("p"."id" = "club_poll_options"."poll_id") AND "private"."is_club_mod"("p"."club_id", ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."club_polls" "p"
  WHERE (("p"."id" = "club_poll_options"."poll_id") AND "private"."is_club_mod"("p"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "club_poll_options_select_member" ON "public"."club_poll_options" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_polls" "p"
  WHERE (("p"."id" = "club_poll_options"."poll_id") AND "private"."is_club_member"("p"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."club_poll_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_poll_votes_select_member" ON "public"."club_poll_votes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_polls" "p"
  WHERE (("p"."id" = "club_poll_votes"."poll_id") AND "private"."is_club_member"("p"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."club_polls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_polls_mod_delete" ON "public"."club_polls" FOR DELETE TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_polls_mod_insert" ON "public"."club_polls" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_polls_mod_update" ON "public"."club_polls" FOR UPDATE TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_polls_select_member" ON "public"."club_polls" FOR SELECT TO "authenticated" USING ("private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."club_post_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_posts_author_delete" ON "public"."club_posts" FOR DELETE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_posts_author_update" ON "public"."club_posts" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_posts_insert_member" ON "public"."club_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."club_threads" "t"
  WHERE (("t"."id" = "club_posts"."thread_id") AND "private"."is_club_member"("t"."club_id", ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "club_posts_select_member" ON "public"."club_posts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."club_threads" "t"
  WHERE (("t"."id" = "club_posts"."thread_id") AND "private"."is_club_member"("t"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."club_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_schedule_mod_delete" ON "public"."club_schedule" FOR DELETE TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_schedule_mod_insert" ON "public"."club_schedule" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_schedule_mod_update" ON "public"."club_schedule" FOR UPDATE TO "authenticated" USING ("private"."is_club_mod"("club_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_schedule_select_member" ON "public"."club_schedule" FOR SELECT USING ("private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."club_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "club_threads_author_delete" ON "public"."club_threads" FOR DELETE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_threads_author_update" ON "public"."club_threads" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "club_threads_insert_member" ON "public"."club_threads" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "club_threads_select" ON "public"."club_threads" FOR SELECT USING (("private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."clubs" "c"
  WHERE (("c"."id" = "club_threads"."club_id") AND ("c"."visibility" = 'public'::"text"))))));



ALTER TABLE "public"."club_waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubs_delete_creator" ON "public"."clubs" FOR DELETE TO "authenticated" USING (("creator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "clubs_insert_creator" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("creator_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "clubs_select" ON "public"."clubs" FOR SELECT USING ((("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])) OR "private"."is_club_member"("id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "clubs_update_creator_or_mod" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."is_club_mod"("id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."commonplace_book" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commonplace_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_shelf_books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_shelves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diary_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discord_sprint_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "discord_sprint_participants_select_member" ON "public"."discord_sprint_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."discord_sprints" "ds"
  WHERE (("ds"."id" = "discord_sprint_participants"."sprint_id") AND "private"."is_club_member"("ds"."club_id", ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."discord_sprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussion_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "discussion_posts_delete_own" ON "public"."discussion_posts" FOR DELETE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "discussion_posts_insert" ON "public"."discussion_posts" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "discussion_posts_select" ON "public"."discussion_posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "discussion_posts_select_anon" ON "public"."discussion_posts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "discussion_posts_update_own" ON "public"."discussion_posts" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."discussions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "discussions_insert" ON "public"."discussions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "discussions_select" ON "public"."discussions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "discussions_select_anon" ON "public"."discussions" FOR SELECT TO "anon" USING (true);



CREATE POLICY "discussions_update_own" ON "public"."discussions" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."external_book_club_pick_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_book_club_picks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_book_clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."giveaway_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."giveaways" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."highlight_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."highlights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "highlights_delete_own" ON "public"."highlights" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "highlights_insert_own" ON "public"."highlights" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "highlights_select" ON "public"."highlights" FOR SELECT USING ((("is_public" = true) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."follows" "f"
  WHERE (("f"."follower_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("f"."following_id" = "highlights"."user_id")))))));



CREATE POLICY "highlights_update_own" ON "public"."highlights" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."journal_post_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_post_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_post_versions_service_role" ON "public"."journal_post_versions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."journal_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."oauth_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_404s" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passage_comment_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passage_comment_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passage_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "passage_comments_select_club_member" ON "public"."passage_comments" FOR SELECT TO "authenticated" USING ((("visibility" = 'club'::"text") AND "private"."is_club_member"("club_id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."passage_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."quote_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reading_goals_delete" ON "public"."reading_goals" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_goals_insert" ON "public"."reading_goals" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_goals_select" ON "public"."reading_goals" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_goals_update" ON "public"."reading_goals" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."reading_list_books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_list_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reading_sessions_delete_own" ON "public"."reading_sessions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_sessions_insert_own" ON "public"."reading_sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_sessions_select_own" ON "public"."reading_sessions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reading_sessions_update_own" ON "public"."reading_sessions" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."reading_streaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_insert_notifications" ON "public"."notifications" FOR INSERT TO "service_role" WITH CHECK (true);



ALTER TABLE "public"."social_post_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_badges_insert" ON "public"."user_badges" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_badges_select" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "user_badges_service_insert" ON "public"."user_badges" FOR INSERT TO "service_role" WITH CHECK (true);



ALTER TABLE "public"."user_book_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_books" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_books_delete_own" ON "public"."user_books" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_books_insert_own" ON "public"."user_books" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_books_select" ON "public"."user_books" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."follows" "f"
  WHERE (("f"."follower_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("f"."following_id" = "user_books"."user_id"))))));



CREATE POLICY "user_books_update_own" ON "public"."user_books" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vocabulary" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocabulary_delete_own" ON "public"."vocabulary" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "vocabulary_insert_own" ON "public"."vocabulary" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "vocabulary_select" ON "public"."vocabulary" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."follows" "f"
  WHERE (("f"."follower_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("f"."following_id" = "vocabulary"."user_id"))))));



CREATE POLICY "vocabulary_update_own" ON "public"."vocabulary" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chapter_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."club_post_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."club_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."follows";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."highlights";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."passage_comment_replies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."passage_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_books";






GRANT USAGE ON SCHEMA "private" TO "anon";
GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "private"."is_club_member"("p_club" "uuid", "p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "private"."is_club_member"("p_club" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_club_member"("p_club" "uuid", "p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "private"."is_club_mod"("p_club" "uuid", "p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "private"."is_club_mod"("p_club" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_club_mod"("p_club" "uuid", "p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_duplicate_slugs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."increment_xp"("user_id" "uuid", "delta" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_xp"("user_id" "uuid", "delta" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."queue_bookstore_event_post"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."queue_celebrity_pick_post"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."score_botm_candidates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."score_botm_candidates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_club_backfill"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";


















GRANT SELECT,MAINTAIN ON TABLE "public"."admin_action_log" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."admin_action_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_action_log" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."admin_notification_log" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."admin_notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notification_log" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."ai_rate_limits" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."ai_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."author_claims" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."author_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."author_claims" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."author_question_upvotes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."author_question_upvotes" TO "authenticated";
GRANT ALL ON TABLE "public"."author_question_upvotes" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."author_questions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."author_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."author_questions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."badges" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."book_ai_cache" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."book_ai_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."book_ai_cache" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."book_discussion_guides" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."book_discussion_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."book_discussion_guides" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."book_of_the_month" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."book_of_the_month" TO "authenticated";
GRANT ALL ON TABLE "public"."book_of_the_month" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."bookmarks" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."bookmarks" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."books" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."books" TO "authenticated";
GRANT ALL ON TABLE "public"."books" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."buddy_read_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."buddy_read_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_read_posts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."buddy_reads" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."buddy_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_reads" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."challenges" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chapter_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."chapter_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."chapter_reactions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."close_friends" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."close_friends" TO "authenticated";
GRANT ALL ON TABLE "public"."close_friends" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_announcements" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."club_announcements" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_books" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_books" TO "authenticated";
GRANT ALL ON TABLE "public"."club_books" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_invites" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."club_invites" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_meeting_rsvps" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_meeting_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."club_meeting_rsvps" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_meetings" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."club_meetings" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_members" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_poll_options" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_poll_options" TO "authenticated";
GRANT ALL ON TABLE "public"."club_poll_options" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_poll_votes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."club_poll_votes" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_polls" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_polls" TO "authenticated";
GRANT ALL ON TABLE "public"."club_polls" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_post_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."club_post_reactions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."club_posts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_schedule" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."club_schedule" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_threads" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."club_threads" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."club_waitlist" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."club_waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."club_waitlist" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."clubs" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."commonplace_book" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."commonplace_book" TO "authenticated";
GRANT ALL ON TABLE "public"."commonplace_book" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."commonplace_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."commonplace_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."commonplace_entries" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."custom_shelf_books" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."custom_shelf_books" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_shelf_books" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."custom_shelves" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."custom_shelves" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_shelves" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."diary_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."diary_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."diary_entries" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."discord_sprint_participants" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discord_sprint_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."discord_sprint_participants" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."discord_sprints" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discord_sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."discord_sprints" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."discussion_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discussion_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."discussion_posts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."discussions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discussions" TO "authenticated";
GRANT ALL ON TABLE "public"."discussions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."external_book_club_pick_edits" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."external_book_club_pick_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."external_book_club_pick_edits" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."external_book_club_picks" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."external_book_club_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."external_book_club_picks" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."external_book_clubs" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."external_book_clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."external_book_clubs" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."follows" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."giveaway_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."giveaway_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."giveaway_entries" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."giveaways" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."giveaways" TO "authenticated";
GRANT ALL ON TABLE "public"."giveaways" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."highlight_likes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."highlight_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."highlight_likes" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."highlights" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."highlights" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."journal_post_links" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."journal_post_links" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_post_links" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."journal_post_versions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."journal_post_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_post_versions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."journal_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."journal_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_posts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."oauth_clients" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."oauth_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_clients" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."oauth_codes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."oauth_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_codes" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."oauth_tokens" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."oauth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_tokens" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."page_404s" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."page_404s" TO "authenticated";
GRANT ALL ON TABLE "public"."page_404s" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."passage_comment_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."passage_comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."passage_comment_reactions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."passage_comment_replies" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."passage_comment_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."passage_comment_replies" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."passage_comments" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."passage_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."passage_comments" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."passage_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."passage_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."passage_reactions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."post_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reactions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."post_reports" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."post_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reports" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."quote_cards" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."quote_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_cards" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_goals" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_goals" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_list_books" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_list_books" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_list_books" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_list_likes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_list_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_list_likes" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_lists" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_lists" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_sessions" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_sessions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."reading_streaks" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reading_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_streaks" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."saved_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."saved_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_posts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."social_post_queue" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."social_post_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."social_post_queue" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."user_badges" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."user_book_tags" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_book_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_book_tags" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."user_books" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_books" TO "authenticated";
GRANT ALL ON TABLE "public"."user_books" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."user_challenges" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_challenges" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."user_favorites" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorites" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."vocabulary" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."vocabulary" TO "authenticated";
GRANT ALL ON TABLE "public"."vocabulary" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































