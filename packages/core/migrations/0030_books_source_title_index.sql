-- The catalog list read (books of one source_type ordered by title, with a limit) read every book of that type and
-- sorted them: 14M rows read in 7 days for 11 rows returned per call (Dustin, 2026-11-27, D1 index review).
-- With this index it stops after the limit. Additive: one index, no row touched.
CREATE INDEX IF NOT EXISTS books_source_title_idx ON books (source_type, title COLLATE NOCASE);
