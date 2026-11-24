-- contract: a club's current book is clubs.current_book_id alone, so club_books.is_current goes. books_fts_au fired on every
-- update of a book (each rating recompute, staff-pick toggle) and rewrote the trigram row; it now fires only when
-- title, author, subjects or source_type change. Hand-run after the code that stops using is_current was live:
-- npx wrangler d1 migrations apply foxing --remote
ALTER TABLE `club_books` DROP COLUMN `is_current`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `books_fts_au`;--> statement-breakpoint
CREATE TRIGGER books_fts_au AFTER UPDATE OF title, author, subjects, source_type ON books BEGIN
  DELETE FROM books_fts WHERE rowid = old.rowid;
  INSERT INTO books_fts(rowid, title, author, subjects_flat, book_id, source_type)
  VALUES (new.rowid, new.title, new.author, (SELECT coalesce(group_concat(je.value, ' '), '') FROM json_each(coalesce(new.subjects, '[]')) je), new.id, new.source_type);
END;
