

export type ActionType =
  | "word_lookup"
  | "passage_analysis"
  | "chapter_summary"
  | "chat"
  | "character_map"
  | "word_wise"
  | "semantic_search"
  | "discussion_starter"
  | "recommendations"
  | "reading_personality"
  | "book_description"
  | "book_insight"
  | "similar_books"
  | "author_bio"
  | "reading_order"
  | "delete_account"
  | "chapter_feature"
  | "word_aspect"
  | "bilingual_paragraph"
  | "language_difficulty"
  | "deep_dive";

export type WordLookupPayload = {
  word: string;
  sentence: string;
  bookTitle: string;
  author: string;
  era: string;
  bookId?: string;
  currentChapter?: string;
  progress?: number;
};

export type PassageAnalysisPayload = {
  passage: string;
  analysisType:
    | "rewrite"
    | "historical"
    | "literary"
    | "thematic"
    | "motivation"
    | "passage_comparison"
    | "perspective"
    | "readability";
  bookTitle: string;
  author: string;
  era: string;
  bookId?: string;
  currentChapter?: string;
  progress?: number;
};

export type ChapterSummaryPayload = {
  chapterTitle: string;
  chapterNumber: number;
  timing: "before" | "after";
  bookTitle: string;
  author: string;
  previousChapterContent?: string;
  bookId?: string;
  progress?: number;
};

export type ChatPayload = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  bookTitle: string;
  author: string;
  currentChapter: string;
  spoilerFree: boolean;
  // Optional mode key, defaults to "normal" (the original CHAT_APPENDIX).
  // See CHAT_MODE_APPENDICES for valid keys.
  mode?: string;
  bookId?: string;
  progress?: number;
};

export type ChapterFeaturePayload = {
  // The kind of chapter feature (timeline/characters/themes/quiz/etc).
  kind: string;
  bookTitle: string;
  author: string;
  chapterTitle: string;
  bookId?: string;
  progress?: number;
};

export type WordAspectPayload = {
  word: string;
  sentence: string;
  bookTitle: string;
  author: string;
  // pronunciation / etymology / translation / synonyms / usage / modernize / grammar.
  aspect: string;
  // Required for translation; ignored otherwise.
  targetLanguage?: string;
  bookId?: string;
  currentChapter?: string;
  progress?: number;
};

export type BilingualParagraphPayload = {
  paragraphs: string[];
  targetLanguage: string;
  bookTitle: string;
  author: string;
  bookId?: string;
  currentChapter?: string;
};

export type LanguageDifficultyPayload = {
  bookTitle: string;
  author: string;
  sampleText?: string;
  bookId?: string;
};

export type DeepDivePayload = {
  // kind ∈ keys of DEEP_DIVE_APPENDICES; see appendices map for the 11.
  kind: string;
  bookTitle: string;
  author: string;
  bookId?: string;
};

export type CharacterMapPayload = {
  bookTitle: string;
  author: string;
  currentChapter: string;
  bookId?: string;
  progress?: number;
};

export type WordWisePayload = {
  pageText: string;
  bookTitle: string;
  author: string;
  currentChapter: string;
  bookId?: string;
  progress?: number;
};

export type SemanticSearchPayload = {
  query: string;
  bookTitle: string;
  author: string;
  chapterList: string[];
  bookId?: string;
  progress?: number;
};

export type DiscussionStarterPayload = {
  bookTitle: string;
  author: string;
  currentChapter?: string;
  clubName?: string;
  bookId?: string;
  progress?: number;
};

type ReadingHistoryItem = {
  title: string;
  author: string;
  rating?: number | null;
};

export type RecommendationsPayload = {
  finishedBooks: ReadingHistoryItem[]; // up to 10
  topGenres: string[]; // up to 5
  highlightSamples: string[]; // up to 10 short snippets
  friendsReading?: ReadingHistoryItem[]; // up to 10
};

export type ReadingPersonalityPayload = RecommendationsPayload;

export type BookDescriptionPayload = {
  bookTitle: string;
  author: string;
  bookId?: string;
};

type BookInsightLens = "difficulty" | "warnings" | "context" | "appeal";

export type BookInsightPayload = {
  bookTitle: string;
  author: string;
  lens: BookInsightLens;
  bookId?: string;
};

export type SimilarBooksPayload = {
  bookTitle: string;
  author: string;
  bookId?: string;
};

export type AuthorBioPayload = {
  authorName: string;
};

export type ReadingOrderPayload = {
  authorName: string;
  bookTitles: string[];
};

export type PromptContext = {
  bookTitle: string;
  author: string;
  currentChapter: string;
  progress?: number;
  providedContext: string;
};

export type LogContext = {
  type: ActionType;
  bookId?: string;
  userId?: string;
  userMessage: string;
};

// ── Account deletion ──────────────────────────────────────────────────
// Hard delete via Supabase admin. The viewer's JWT establishes who's
// asking; we only let them delete their own account. Cascading FKs on
// profiles / user_books / highlights / clubs handle the rest.
export type DeleteAccountPayload = { userId: string };
