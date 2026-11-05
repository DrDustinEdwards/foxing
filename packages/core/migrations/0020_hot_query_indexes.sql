-- Indexes for the three queries that read the most rows in D1's 30-day analytics (rows read count rows
-- SCANNED, developers.cloudflare.com/d1/platform/pricing/): an author's books (books_author_source_idx), a book's
-- public reviews (diary_book_visibility_idx, which had none and scanned the table) and each club's published picks
-- (external_picks_club_published_idx). Additive: three indexes, no row touched.
-- Apply with: wrangler d1 migrations apply foxing [--local|--remote]
CREATE INDEX IF NOT EXISTS books_author_source_idx ON books (author_slug, source_type, publication_year);
CREATE INDEX IF NOT EXISTS diary_book_visibility_idx ON diary_entries (book_id, visibility, log_date);
CREATE INDEX IF NOT EXISTS external_picks_club_published_idx ON external_book_club_picks (club_id, is_published);
