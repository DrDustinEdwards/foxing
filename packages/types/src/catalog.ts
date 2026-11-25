import type { BookCard, ProfileSummary } from "./common";
import type { ClubCard } from "./clubs";
import type { PopularHighlight } from "./reader";

export interface SearchSuggest {
  books: { id: string; slug: string; title: string; author: string; coverUrl: string | null }[];
  authors: { slug: string | null; name: string; bookCount: number }[];
  people: { username: string; displayName: string }[];
  clubs: { id: string; slug: string | null; name: string }[];
}

export interface GenreFacet {
  subject: string;
  label: string;
  count: number;
}

export interface BrowsePage {
  books: BookCard[];
  total: number;
  page: number;
  pageCount: number;
  genres: GenreFacet[];
}

export interface SearchPage extends BrowsePage {
  q: string;
  fuzzy: boolean;
  authors: { slug: string; name: string; bookCount: number }[];
}

export interface DiscoverPage {
  todaysPick: {
    source: "botm" | "staff";
    book: {
      slug: string;
      title: string;
      author: string;
      coverUrl: string | null;
      description: string | null;
      publicationYear: number | null;
    };
    note: string | null;
  } | null;
  staffPicks: BookCard[];
  awardWinners: BookCard[];
  trending: BookCard[];
  newest: BookCard[];
  clubs: ClubCard[];
  genres: GenreFacet[];
  eras: { slug: string; label: string }[];
  lengths: { slug: string; label: string }[];
}

export interface AuthorPage {
  slug: string;
  name: string;
  bookCount: number;
  yearRange: { first: number; last: number } | null;
  bio: string | null;
  books: BookCard[];
}

export interface BookDetail extends BookCard {
  description: string | null;
  language: string;
  wordCount: number | null;
  subjects: string[];
  moodTags: string[];
  contentWarnings: string[];
  pacing: string | null;
  seriesName: string | null;
  seriesOrder: number | null;
  isbn13: string | null;
  publisher: string | null;
  /** Mean rating out of 5, from readers' latest diary entries. */
  rating: number | null;
  ratingCount: number;
  /** Community books have a page but are not in the catalog and cannot be read here. */
  community: boolean;
}

export interface BookReview {
  id: string;
  author: ProfileSummary | null;
  ratingHalf: number | null;
  review: string;
  containsSpoilers: boolean;
  logDate: number | null;
}

export interface BuyLink {
  retailer: "bookshop" | "amazon" | "library";
  label: string;
  url: string;
  sponsored: boolean;
}

/** GET /books/:idOrSlug: everything the book page shows that is the same for every
 *  reader. The reader's own shelf state is GET /library/:bookId. */
export interface BookPage {
  book: BookDetail;
  buys: BuyLink[];
  awards: { awardSlug: string; awardName: string; year: number | null; distinction: string }[];
  related: BookCard[];
  moreByAuthor: BookCard[];
  nextInSeries: BookCard | null;
  /** Generated once per catalog book; null until it has been. */
  ai: {
    description: string | null;
    authorBio: string | null;
    similarBooks: string | null;
    readingOrder: string | null;
  };
  reviews: BookReview[];
  clubs: ClubCard[];
  popular: PopularHighlight[];
  readerCount: number;
}

export interface Recommendation {
  bookId: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  publicationYear: number | null;
  reason: string;
}

export interface Recommendations {
  recommendations: Recommendation[];
  aiPersonalized: boolean;
  isPlus: boolean;
}
