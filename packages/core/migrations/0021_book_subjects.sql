-- book_subjects: one row per (book, subject), so a subject filter reads an index instead of parsing every book's
-- subjects JSON. The five readers (browse, search, related books, recommendations, genre facets) used json_each over
-- the whole books table: about 325M rows read in 30 days (D1 counts rows scanned,
-- developers.cloudflare.com/d1/platform/pricing/). books.subjects stays the source; these triggers keep the table in
-- step on every insert and subjects update, whoever writes the row, and the foreign key removes a deleted book's rows.
-- Additive: one table, two indexes, two triggers, one backfill. No existing row is touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE TABLE IF NOT EXISTS book_subjects (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  PRIMARY KEY (book_id, subject)
);
CREATE INDEX IF NOT EXISTS book_subjects_subject_idx ON book_subjects (subject, book_id);
CREATE INDEX IF NOT EXISTS book_subjects_subject_lower_idx ON book_subjects (lower(subject), book_id);

INSERT OR IGNORE INTO book_subjects (book_id, subject)
SELECT b.id, je.value FROM books b, json_each(b.subjects) je
WHERE json_valid(b.subjects) AND je.value IS NOT NULL AND je.value != '';

CREATE TRIGGER IF NOT EXISTS book_subjects_ai AFTER INSERT ON books WHEN NEW.subjects IS NOT NULL AND json_valid(NEW.subjects) BEGIN
  INSERT OR IGNORE INTO book_subjects (book_id, subject)
  SELECT NEW.id, je.value FROM json_each(NEW.subjects) je WHERE je.value IS NOT NULL AND je.value != '';
END;

CREATE TRIGGER IF NOT EXISTS book_subjects_au AFTER UPDATE OF subjects ON books BEGIN
  DELETE FROM book_subjects WHERE book_id = NEW.id;
  INSERT OR IGNORE INTO book_subjects (book_id, subject)
  SELECT NEW.id, je.value FROM json_each(NEW.subjects) je
  WHERE NEW.subjects IS NOT NULL AND json_valid(NEW.subjects) AND je.value IS NOT NULL AND je.value != '';
END;
