-- Local dev seed: a few fake catalog books. Idempotent.
INSERT OR IGNORE INTO books
  (id, title, author, author_slug, slug, source, source_type, language, is_staff_pick, rating_count, created_at, updated_at)
VALUES
  ('seed_book_1', 'The Time Machine', 'H. G. Wells', 'h-g-wells', 'the-time-machine-seed', 'gutenberg', 'catalog', 'en', 1, 0, unixepoch() * 1000, unixepoch() * 1000),
  ('seed_book_2', 'Frankenstein', 'Mary Shelley', 'mary-shelley', 'frankenstein-seed', 'gutenberg', 'catalog', 'en', 0, 0, unixepoch() * 1000, unixepoch() * 1000),
  ('seed_book_3', 'The Yellow Wallpaper', 'Charlotte Perkins Gilman', 'charlotte-perkins-gilman', 'the-yellow-wallpaper-seed', 'gutenberg', 'catalog', 'en', 0, 0, unixepoch() * 1000, unixepoch() * 1000),
  ('seed_book_4', 'Meditations', 'Marcus Aurelius', 'marcus-aurelius', 'meditations-seed', 'gutenberg', 'catalog', 'en', 1, 0, unixepoch() * 1000, unixepoch() * 1000);
