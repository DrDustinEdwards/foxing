// The /api/v1 wire shapes: what each GET returns, as JSON. Core's view functions
// (packages/core/src/views) are typed against these, the web loaders hand the same
// objects to the page, and @foxing/client's hooks type their caches with them, so
// web and mobile read one contract. Timestamps are epoch milliseconds; nothing here
// is a Date. Dependency-free on purpose: mobile and web both type-check it. The one
// runtime export is the club socket's keepalive pair (end of file).

// --- Shared building blocks -------------------------------------------------

export type ShelfStatus = "want" | "reading" | "finished" | "paused" | "abandoned";
export type Visibility = "private" | "friends" | "public";
export type ReactionTarget =
  | "annotation"
  | "club_post"
  | "club_thread"
  | "diary_entry"
  | "reading_list"
  | "journal_post";
export type AnnotationType = "highlight" | "note" | "bookmark" | "comment" | "commonplace";

export interface ProfileSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface BookCard {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  readable: boolean;
}

/** The smallest book reference a list row carries. */
export interface BookRef {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

// --- Me ---------------------------------------------------------------------

export interface MyProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  backdropUrl: string | null;
  bio: string | null;
  favoriteGenres: string[];
  subscriptionTier: "free" | "plus";
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: number | null;
  isAdmin: boolean;
  timezone: string | null;
  visibility: {
    profile?: "public" | "private";
    progress?: "public" | "private";
    defaultAnnotation?: Visibility;
  };
  notificationPrefs: {
    categories?: Record<string, boolean>;
    quietHours?: { start: string; end: string };
  };
  createdAt: number;
}

/** GET /me/onboarding: what the first-run flow offers before the profile exists. */
export interface OnboardingPage {
  /** Award-winning catalog books with covers, readable ones first. */
  starters: BookCard[];
  genres: GenreFacet[];
}

/** A club the reader created, who may take it over, and the default pick: what the
 *  delete-account flow asks before the account goes. */
export interface ClubHandover {
  clubId: string;
  name: string;
  candidates: { userId: string; name: string; role: string }[];
  suggested: string | null;
}

export interface Me {
  user: { id: string; email: string };
  /** Null until onboarding has created the profile. */
  profile: MyProfile | null;
}

// --- Library ----------------------------------------------------------------

export interface LibraryEntry {
  bookId: string;
  status: ShelfStatus;
  progressPct: number;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  updatedAt: number;
  /** When it was last finished, for a finished book. */
  finishedAt: number | null;
}

export interface Shelf {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

export interface ShelfDetail {
  shelf: Shelf;
  books: BookRef[];
}

export interface Goal {
  id: string;
  type: string;
  target: number;
  periodType: "year" | "month" | "week";
  year: number;
  month: number | null;
  week: number | null;
}

export interface GoalWithProgress {
  goal: Goal;
  progress: number;
}

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  totalBooksFinished: number;
  totalHighlights: number;
  totalPagesRead: number;
  totalWordsLookedUp: number;
  lastReadDate: number | null;
}

export interface VocabularyWord {
  id: string;
  bookId: string | null;
  word: string;
  definition: string;
  contextSentence: string | null;
  mastered: boolean;
  lookedUpAt: number;
}

export interface RecapBook {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  ratingHalf: number | null;
}

/** GET /recap/:year (the reader's own) and /u/:username/recap/:year: Year in Reading. */
export interface RecapPage {
  recap: {
    year: number;
    booksFinished: number;
    totalWords: number;
    distinctAuthors: number;
    /** In stars (0 to 5), over the year's rated finishes. */
    averageRating: number | null;
    /** The highest-rated finishes, up to five. */
    topBooks: RecapBook[];
    /** Every finish, oldest first. */
    finished: RecapBook[];
  };
  displayName: string;
  username: string;
  /** Books finished in each month, January first. */
  monthly: number[];
  /** The year's most-read subjects, most first. */
  genres: { name: string; value: number }[];
}

/** GET /stats: the reader's year in numbers, and the last week of reading sessions. */
export interface ReadingStats {
  year: number;
  finishedThisYear: number;
  /** Books finished in each month of the year, January first. */
  monthly: number[];
  /** The most-read subjects among this year's finishes, most first. */
  genres: { name: string; value: number }[];
  booksYearGoalTarget: number | null;
  streak: Streak;
  /** The last 7 days, oldest first; day is the UTC midnight it starts on. */
  week: { day: number; minutes: number; pages: number }[];
}

/** One book's place in the reader's library: status, shelves it is on, progress. */
export interface MyBookState {
  status: ShelfStatus | null;
  progressPct: number;
  progress: Record<string, unknown> | null;
  shelfIds: string[];
  startedAt: number | null;
  finishedAt: number | null;
}

// --- Notifications ----------------------------------------------------------

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: number;
}

export interface NotificationsPage {
  notifications: NotificationItem[];
  unread: number;
}

// --- Clubs ------------------------------------------------------------------

export type ClubRole = "owner" | "moderator" | "member";
export type ClubMemberStatus =
  | "active"
  | "invited"
  | "requested"
  | "waitlisted"
  | "banned"
  | "left";
export type RsvpStatus = "going" | "maybe" | "not_going";

export interface ClubCard {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: "public" | "private";
  isVerified: boolean;
  memberCount: number;
  currentBook: BookRef | null;
}

export interface ClubInfo extends ClubCard {
  creatorId: string;
  clubType: string;
  memberApproval: boolean;
  readingPace: string | null;
  chaptersPerWeek: number | null;
  genreTags: string[];
  /** Only moderators see the invite code. */
  joinCode: string | null;
  createdAt: number;
}

export interface ClubMembership {
  status: ClubMemberStatus;
  role: ClubRole;
}

export interface ClubThreadItem {
  id: string;
  title: string;
  type: "discussion" | "announcement";
  chapter: string | null;
  isPinned: boolean;
  isAiStarter: boolean;
  hasSpoilers: boolean;
  author: ProfileSummary | null;
  createdAt: number;
}

export interface ClubMemberItem {
  userId: string;
  profile: ProfileSummary | null;
  role: ClubRole;
  status: ClubMemberStatus;
  joinedAt: number | null;
  /** Moderators only, like the ban details below. */
  mutedUntil?: number | null;
  bannedAt?: number | null;
  banReason?: string | null;
}

export interface ClubPollItem {
  id: string;
  title: string;
  description: string | null;
  pollType: "single" | "irv";
  options: { id: string; label: string; bookId?: string }[];
  closesAt: number | null;
  isClosed: boolean;
  createdBy: string;
  /** First-preference counts by option id. */
  tallies: Record<string, number>;
  voteCount: number;
  myVote: string[] | null;
}

export interface ClubMeetingItem {
  id: string;
  title: string;
  description: string | null;
  meetingDate: number;
  endDate: number | null;
  meetingType: string;
  locationName: string | null;
  locationUrl: string | null;
  isCancelled: boolean;
  rsvps: Record<RsvpStatus, number>;
  myRsvp: RsvpStatus | null;
}

export interface ClubScheduleItem {
  id: string;
  chapterName: string;
  unlockDate: number;
}

/** Everything the club page shows. Public clubs are readable by anyone signed in;
 *  a private club is not found for anyone but its active members. */
export interface ClubPage {
  club: ClubInfo;
  membership: ClubMembership | null;
  isMember: boolean;
  isModerator: boolean;
  threads: ClubThreadItem[];
  members: ClubMemberItem[];
  polls: ClubPollItem[];
  meetings: ClubMeetingItem[];
  schedule: ClubScheduleItem[];
}

export interface ClubPostItem {
  id: string;
  parentPostId: string | null;
  content: string;
  hasSpoiler: boolean;
  isEdited: boolean;
  isPinned: boolean;
  author: ProfileSummary | null;
  createdAt: number;
}

export interface ThreadPage {
  club: { id: string; slug: string | null; name: string };
  isMember: boolean;
  thread: ClubThreadItem & { bookId: string | null };
  posts: ClubPostItem[];
}

export interface ClubsIndex {
  mine: ClubCard[];
  discover: ClubCard[];
}

// --- Social -----------------------------------------------------------------

export type FeedRow =
  | {
      kind: "activity";
      id: string;
      type: string;
      actor: ProfileSummary | null;
      book: { id: string; title: string; slug: string; coverUrl: string | null } | null;
      data: Record<string, unknown>;
      createdAt: number;
    }
  | { kind: "follower"; id: string; actorLabel: string; createdAt: number };

export interface FeedPage {
  rows: FeedRow[];
  nextCursor: number | null;
}

/** A book on a profile strip (favorites, finished, currently reading). */
export interface ProfileBook {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}

export interface DiaryEntry {
  id: string;
  bookId: string;
  book: BookRef | null;
  ratingHalf: number | null;
  review: string | null;
  containsSpoilers: boolean;
  visibility: Visibility;
  logDate: number | null;
}

export interface ListSummary {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  isPublic: boolean;
}

/** GET /lists: one of the reader's own lists, with a count and up to four covers. */
export interface MyList {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  bookCount: number;
  covers: string[];
}

export interface ActivityItem {
  id: string;
  type: string;
  bookId: string | null;
  data: Record<string, unknown>;
  visibility: Visibility;
  createdAt: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  favoriteGenres: string[];
  createdAt: number | null;
}

/** A profile page. A non-public profile is only its identity, to all but its owner. */
export type ProfilePage =
  | {
      isPrivate: true;
      profile: { username: string; displayName: string | null; avatarUrl: string | null };
    }
  | {
      isPrivate: false;
      profile: PublicProfile;
      isOwner: boolean;
      isFollowing: boolean;
      viewerHasAsCloseFriend: boolean;
      followerCount: number;
      followingCount: number;
      booksRead: number;
      highlightCount: number;
      favorites: ProfileBook[];
      publicShelves: { id: string; name: string; bookCount: number }[];
      finishedBooks: ProfileBook[];
      publicHighlights: {
        id: string;
        selectedText: string | null;
        bookTitle: string | null;
        bookSlug: string | null;
      }[];
      /** Empty when progress is private and the viewer is not the owner. */
      currentlyReading: (ProfileBook & { progressPct: number })[];
      diary: DiaryEntry[];
      lists: ListSummary[];
      activity: ActivityItem[];
    };

export interface PeoplePage {
  following: (ProfileSummary & { isClose: boolean })[];
  followers: (ProfileSummary & { isFollowing: boolean })[];
  closeFriends: ProfileSummary[];
}

export interface ListPage {
  list: { id: string; title: string; description: string | null; isPublic: boolean };
  isOwner: boolean;
  owner: ProfileSummary | null;
  likeCount: number;
  liked: boolean;
  books: { bookId: string; note: string | null; position: number; book: BookCard | null }[];
}

// --- Catalog ----------------------------------------------------------------

/** Search-as-you-type: books, authors, public profiles and public clubs. */
export interface SearchSuggest {
  books: { id: string; slug: string; title: string; author: string; coverUrl: string | null }[];
  authors: { slug: string | null; name: string; bookCount: number }[];
  people: { username: string; displayName: string }[];
  clubs: { id: string; slug: string | null; name: string }[];
}

export interface GenreFacet {
  subject: string;
  count: number;
}

/** GET /books: the browsable catalog, one page at a time. */
export interface BrowsePage {
  books: BookCard[];
  total: number;
  page: number;
  pageCount: number;
  genres: GenreFacet[];
}

/** GET /search: full search, books plus matching authors. */
export interface SearchPage extends BrowsePage {
  q: string;
  fuzzy: boolean;
  authors: { slug: string; name: string; bookCount: number }[];
}

/** GET /discover: the catalog's front shelf, the same for every reader. */
export interface DiscoverPage {
  /** The Book of the Month, or else the latest staff pick. */
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
  /** Most shelved in the last 30 days. */
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
  /** The author biography generated for their catalog books, when there is one. */
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

/** Where to buy or borrow a copy: Bookshop, then Amazon, then a library. */
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

/** GET /recommendations: what to read next, personalised by AI for Plus readers. */
export interface Recommendations {
  recommendations: Recommendation[];
  aiPersonalized: boolean;
  isPlus: boolean;
}

// --- Reader annotations -----------------------------------------------------

/** A reading position (Readium locator JSON); the server stores it as given. */
export type Locator = Record<string, unknown>;

/** Two independent, OR-combined reasons to collapse another reader's annotation:
 *  their manual spoiler flag, and it being ahead of where the viewer has read. */
export interface Gate {
  spoiler: boolean;
  ahead: boolean;
}

export type OtherLayer = "club" | "friend" | "public";

export interface AnnotationAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** One of the viewer's own highlights, notes or bookmarks in a book. */
export interface ReaderMine {
  id: string;
  type: string;
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
}

export interface ResolvedOther extends ReaderMine {
  layer: OtherLayer;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: Gate;
  author: AnnotationAuthor;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
}

export interface ResolvedComment {
  id: string;
  clubId: string | null;
  parentId: string | null;
  locator: Locator | null;
  body: string | null;
  chapter: string | null;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: Gate;
  author: AnnotationAuthor;
  createdAt: number;
}

export interface PopularHighlight {
  normalizedText: string;
  count: number;
  locator: Locator | null;
}

/** GET /books/:idOrSlug/reader: what opening a book in the reader needs. */
export interface ReaderPage {
  book: { id: string; slug: string; title: string; author: string; epubUrl: string };
  /** Where the reader left off; null when signed out or never opened. */
  initialLocator: Locator | null;
  /** The viewer's clubs reading this book, where passage comments can go. */
  shareableClubs: { id: string; name: string }[];
}

/** GET /books/:id/annotations: every layer the viewer is entitled to, resolved
 *  server-side. Anonymous readers get public and popular only. */
export interface ReaderAnnotations {
  viewerProgressPct: number | null;
  mine: ReaderMine[];
  others: ResolvedOther[];
  comments: ResolvedComment[];
  popular: PopularHighlight[];
}

/** GET /annotations?types=: the reader's own annotations across every book, newest
 *  first (the highlights, commonplace and saved-passages pages). */
export interface MyAnnotation {
  id: string;
  type: AnnotationType;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  sourceTitle: string | null;
  visibility: "private" | "friends" | "club" | "public";
  createdAt: number;
  bookId: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
}

// --- Club live socket -------------------------------------------------------

/** The keepalive frames of a club's live socket. The ClubRoom registers this exact
 *  pair with setWebSocketAutoResponse, so the runtime answers a ping without waking
 *  the object; the match is on the exact string, so both sides import these. */
export const PING_FRAME = JSON.stringify({ t: "ping" });
export const PONG_FRAME = JSON.stringify({ t: "pong" });

/** What the server sends down a club's socket. Every real write goes through
 *  /api/v1; the socket only tells open screens that something changed. */
export type ClubLiveMessage =
  | { t: "presence"; users: string[] }
  | { t: "post"; post: { id: string; threadId: string } }
  | { t: "thread"; thread: { id: string } }
  | { t: "tally"; poll_id: string; tallies: Record<string, number>; closed?: boolean }
  | { t: "notice"; kind: string; [k: string]: unknown }
  | { t: "pong" };
