-- Foxing initial schema
-- Phase 1: profiles, books, user_books, vocabulary, reading_sessions

-- =========================================================================
-- profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever an auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- books
-- =========================================================================
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  gutenberg_id integer unique,
  title text not null,
  author text not null,
  cover_url text,
  source text not null,
  epub_url text not null,
  language text not null default 'en',
  subjects text[] not null default '{}',
  word_count integer,
  created_at timestamptz not null default now()
);

create index if not exists books_gutenberg_id_idx on public.books (gutenberg_id);
create index if not exists books_title_idx on public.books (title);

alter table public.books enable row level security;

create policy "books are viewable by everyone"
  on public.books for select
  using (true);

create policy "authenticated users can insert books"
  on public.books for insert
  to authenticated
  with check (true);

create policy "authenticated users can update books"
  on public.books for update
  to authenticated
  using (true);

-- =========================================================================
-- user_books
-- =========================================================================
create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null check (status in ('want_to_read', 'reading', 'finished', 'abandoned')),
  progress_cfi text,
  progress_percentage float not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index if not exists user_books_user_id_idx on public.user_books (user_id);
create index if not exists user_books_book_id_idx on public.user_books (book_id);
create index if not exists user_books_status_idx on public.user_books (status);
create index if not exists user_books_user_status_idx on public.user_books (user_id, status);

alter table public.user_books enable row level security;

create policy "users can view their own user_books"
  on public.user_books for select
  using (auth.uid() = user_id);

create policy "users can insert their own user_books"
  on public.user_books for insert
  with check (auth.uid() = user_id);

create policy "users can update their own user_books"
  on public.user_books for update
  using (auth.uid() = user_id);

create policy "users can delete their own user_books"
  on public.user_books for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- vocabulary
-- =========================================================================
create table if not exists public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  word text not null,
  definition text not null,
  context text not null,
  created_at timestamptz not null default now()
);

create index if not exists vocabulary_user_id_idx on public.vocabulary (user_id);
create index if not exists vocabulary_book_id_idx on public.vocabulary (book_id);
create index if not exists vocabulary_user_book_idx on public.vocabulary (user_id, book_id);

alter table public.vocabulary enable row level security;

create policy "users can view their own vocabulary"
  on public.vocabulary for select
  using (auth.uid() = user_id);

create policy "users can insert their own vocabulary"
  on public.vocabulary for insert
  with check (auth.uid() = user_id);

create policy "users can update their own vocabulary"
  on public.vocabulary for update
  using (auth.uid() = user_id);

create policy "users can delete their own vocabulary"
  on public.vocabulary for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- reading_sessions
-- =========================================================================
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  pages_read integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists reading_sessions_user_id_idx on public.reading_sessions (user_id);
create index if not exists reading_sessions_book_id_idx on public.reading_sessions (book_id);
create index if not exists reading_sessions_user_started_idx on public.reading_sessions (user_id, started_at);

alter table public.reading_sessions enable row level security;

create policy "users can view their own reading_sessions"
  on public.reading_sessions for select
  using (auth.uid() = user_id);

create policy "users can insert their own reading_sessions"
  on public.reading_sessions for insert
  with check (auth.uid() = user_id);

create policy "users can update their own reading_sessions"
  on public.reading_sessions for update
  using (auth.uid() = user_id);

create policy "users can delete their own reading_sessions"
  on public.reading_sessions for delete
  using (auth.uid() = user_id);
