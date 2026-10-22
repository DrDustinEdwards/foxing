import Anthropic from "npm:@anthropic-ai/sdk@^0.95.2";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";
import type { ActionType, AuthorBioPayload, BilingualParagraphPayload, BookDescriptionPayload, BookInsightPayload, ChapterFeaturePayload, ChapterSummaryPayload, CharacterMapPayload, ChatPayload, DeepDivePayload, DeleteAccountPayload, DiscussionStarterPayload, LanguageDifficultyPayload, LogContext, PassageAnalysisPayload, ReadingOrderPayload, ReadingPersonalityPayload, RecommendationsPayload, SemanticSearchPayload, SimilarBooksPayload, WordAspectPayload, WordLookupPayload, WordWisePayload } from "./types.ts";
import { CHAPTER_FEATURE_APPENDICES, CHAT_APPENDIX, CHAT_MODE_APPENDICES, DEEP_DIVE_APPENDICES, MASTER_SYSTEM_PROMPT, PASSAGE_ANALYSIS_EXTRA_LENSES, WORD_ASPECT_APPENDICES, buildSystemPrompt, detectRefusal, stripThinking } from "./prompts.ts";

// Set ANTHROPIC_MODEL as a function secret to change the model without a code change.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
if (!apiKey) {
  // Logged once at cold start so it's obvious in `supabase functions logs`
  // when the secret was never set, separate from per-request errors.
  console.error("[ai-companion] ANTHROPIC_API_KEY is not set");
}

const client = new Anthropic({ apiKey });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Subscription gate (decision D11) ───────────────────────────────────
// Free = ZERO on-demand AI. Every reader-triggered AI action requires Plus
// and returns a tier gate (403 PLUS_REQUIRED), not a quota. The four cached
// catalog generators (book_description, author_bio, similar_books,
// reading_order) run once and cache to feed public book pages, so they stay
// free and are deliberately NOT in this set. Server-side enforcement; client
// checks alone can't protect API spend during a viral moment.
const PLUS_REQUIRED_ACTIONS = new Set<string>([
  "word_lookup",
  "passage_analysis",
  "chat",
  "word_aspect",
  "language_difficulty",
  "semantic_search",
  "discussion_starter",
  "word_wise",
  "character_map",
  "chapter_feature",
  "bilingual_paragraph",
  "recommendations",
  "reading_personality",
  "book_insight",
  "deep_dive",
]);

interface RateLimitOutcome {
  // When set, the server should return this Response instead of running
  // the action. Used for 429 and 403 paths.
  response?: Response;
}

// Lazy service-role client, only built when we actually need to read the
// rate-limit / subscription tables. createClient is cheap but the
// admin client should never be used by user-scoped queries elsewhere.
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getSubscriptionTier(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<"free" | "plus"> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .maybeSingle();
    const tier = (data as { subscription_tier?: string } | null)?.subscription_tier;
    if (tier === "plus") return "plus";
  } catch (e) {
    console.warn("[ai-companion] subscription lookup failed:", e);
  }
  return "free";
}

// ─── Server-side cache (task.md Section 7) ──────────────────────────────
// book_ai_cache stores deterministic per-book outputs so repeat requests
// (across users + sessions) don't re-bill Anthropic. The CLIENT also
// caches via lib/book-ai.ts; this server-side path covers the multi-user
// case where User B benefits from User A's call.

interface CacheTarget {
  key: string
  action: string
}

function getCacheTarget(action: string, payload: unknown): CacheTarget | null {
  if (!payload || typeof payload !== "object") return null
  const p = payload as Record<string, unknown>
  const bookId = typeof p.bookId === "string" ? p.bookId : null
  if (!bookId) return null
  switch (action) {
    case "book_description":
    case "similar_books":
    case "author_bio":
    case "reading_order":
      return { key: bookId, action }
    case "book_insight": {
      const lens = typeof p.lens === "string" ? p.lens : null
      return lens ? { key: bookId, action: `book_insight:${lens}` } : null
    }
    case "deep_dive": {
      // Deep dive cache MUST include the kind, otherwise all 11 long-form
      // analyses for a book collide on a single cache row.
      const kind = typeof p.kind === "string" ? p.kind : null
      return kind ? { key: bookId, action: `deep_dive:${kind}` } : null
    }
    default:
      return null
  }
}

async function readCache(target: CacheTarget): Promise<string | null> {
  const admin = getAdminClient()
  if (!admin) return null
  try {
    const { data } = await admin
      .from("book_ai_cache")
      .select("content")
      .eq("cache_key", target.key)
      .eq("action", target.action)
      .maybeSingle()
    const content = (data as { content?: string } | null)?.content
    return typeof content === "string" && content.length > 0 ? content : null
  } catch (e) {
    console.warn("[ai-companion] cache read failed:", e)
    return null
  }
}

async function writeCache(target: CacheTarget, content: string): Promise<void> {
  const admin = getAdminClient()
  if (!admin || !content) return
  try {
    await admin
      .from("book_ai_cache")
      .upsert(
        { cache_key: target.key, action: target.action, content },
        { onConflict: "cache_key,action" },
      )
  } catch (e) {
    console.warn("[ai-companion] cache write failed:", e)
  }
}

async function enforceLimitsAndGate(
  userId: string | undefined,
  action: string,
): Promise<RateLimitOutcome> {
  // Free actions: the four cached catalog generators, delete_account, and
  // anything non-AI. No gate.
  if (!PLUS_REQUIRED_ACTIONS.has(action)) return {};

  // Every on-demand AI action requires an authenticated Plus user.
  if (!userId) {
    return {
      response: new Response(
        JSON.stringify({
          error: "UNAUTHENTICATED",
          message: "Sign in to use AI features.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const admin = getAdminClient();
  if (!admin) {
    // Can't verify tier without the service role key. Fail closed so free
    // users can't slip through; the migrations REQUIRE this key in prod.
    console.error("[ai-companion] service role key missing, cannot verify tier");
    return {
      response: new Response(
        JSON.stringify({
          error: "UNAVAILABLE",
          message: "Subscription check is unavailable. Please try again shortly.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const tier = await getSubscriptionTier(admin, userId);
  if (tier !== "plus") {
    return {
      response: new Response(
        JSON.stringify({
          error: "PLUS_REQUIRED",
          message: "This AI feature requires Foxing Plus.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  return {};
}

// =====================================================================
// MASTER SYSTEM PROMPT, applied to every request, with one of the
// function-specific appendices appended below it. Dynamic per-request
// context (book, chapter, progress, action-specific content) is appended
// last by buildSystemPrompt(). Source of truth is duplicated to
// foxing-vault/ai-companion-safety.md, keep both in sync.
// =====================================================================

// =====================================================================
// Refusal logging, used by ops to spot prompt injection attempts and
// crisis content. Pattern matches reflect canonical phrases from the
// master prompt's redirect / hard-refusal / crisis blocks.
// =====================================================================

// =====================================================================
// Types
// =====================================================================

// =====================================================================
// Prompt assembly + JWT user lookup
// =====================================================================

// The caller's Supabase user id, from a token Supabase Auth itself confirms. Decoding
// the payload alone trusted a gateway `verify_jwt` flag no config in this repo pins
// (Grok audit 2026-10-21, FX-5). No admin client or a refused token is no user.
async function getUserIdFromAuth(req: Request): Promise<string | undefined> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return undefined;
  const token = auth.replace(/^Bearer\s+/i, "");
  const admin = getAdminClient();
  if (!admin) return undefined;
  try {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? undefined : data.user.id;
  } catch {
    return undefined;
  }
}

function logCompanionResponse(opts: LogContext, response: string): void {
  const refusalDetected = detectRefusal(response);
  const entry: Record<string, unknown> = {
    type: opts.type,
    bookId: opts.bookId,
    userId: opts.userId,
    refusalDetected,
    responseLength: response.length,
  };
  if (refusalDetected) {
    entry.messageSnippet = opts.userMessage.slice(0, 100);
  }
  console.log("[ai-companion] COMPANION_RESPONSE", entry);
}

// =====================================================================
// Action handlers
// =====================================================================

async function wordLookup(
  p: WordLookupPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `The reader has tapped on the word "${p.word}". It appears in this sentence: "${p.sentence}".`;
  const system = buildSystemPrompt("word_lookup", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: p.progress,
    providedContext,
  });
  const userMessage = `Define "${p.word}" as it's used here.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text"
    ? message.content[0].text
    : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function passageAnalysis(
  p: PassageAnalysisPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const lensLabel: Record<PassageAnalysisPayload["analysisType"], string> = {
    rewrite: "Rewrite this passage in plain modern English while keeping its tone.",
    historical: "Explain the historical context a contemporary reader would have known.",
    literary: "Identify the literary devices at work and what they accomplish.",
    thematic: "Explain why this moment matters to the book's larger themes.",
    motivation: "Explain what this moment reveals about the characters' motivations.",
    passage_comparison: PASSAGE_ANALYSIS_EXTRA_LENSES.passage_comparison,
    perspective: PASSAGE_ANALYSIS_EXTRA_LENSES.perspective,
    readability: PASSAGE_ANALYSIS_EXTRA_LENSES.readability,
  };
  const providedContext = `Highlighted passage: "${p.passage}"`;
  const system = buildSystemPrompt("passage_analysis", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: p.progress,
    providedContext,
  });
  const userMessage = lensLabel[p.analysisType];
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text"
    ? message.content[0].text
    : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function chapterSummary(
  p: ChapterSummaryPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = p.previousChapterContent
    ? `Chapter ${p.chapterNumber}: "${p.chapterTitle}". Recent chapter content (excerpt): ${p.previousChapterContent}`
    : `Chapter ${p.chapterNumber}: "${p.chapterTitle}".`;
  const system = buildSystemPrompt("chapter_summary", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.chapterTitle,
    progress: p.progress,
    providedContext,
  });
  const userMessage = p.timing === "before"
    ? `Catch me up on what's happened so far before I start "${p.chapterTitle}".`
    : `Recap what just happened in "${p.chapterTitle}".`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text"
    ? message.content[0].text
    : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

// JSON-shaped actions don't go through stripThinking, instead they go
// through stripJsonFences to peel off any markdown fence Claude wraps the
// response in. The host-side parser tolerates fenced output too, but
// stripping here keeps the wire format clean and the bytes count smaller.
function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

async function characterMap(
  p: CharacterMapPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `The reader is requesting a character roster as of their current position. Show only what they would know at this point.`;
  const system = buildSystemPrompt("character_map", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: p.progress,
    providedContext,
  });
  const userMessage = `Give me a spoiler-free character map for "${p.bookTitle}" up to ${p.currentChapter || "where I am"}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function wordWise(
  p: WordWisePayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  // Cap pageText to keep token usage bounded, a typical paginated EPUB
  // page is 200-400 words; even at 600 we're under ~1k tokens of input.
  const trimmed = (p.pageText ?? "").slice(0, 4000);
  const providedContext = `Visible page text (truncated to 4000 chars): """${trimmed}"""`;
  const system = buildSystemPrompt("word_wise", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: p.progress,
    providedContext,
  });
  const userMessage = `Pick the 3-5 hardest words on this page and give a short contextual hint for each.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function semanticSearch(
  p: SemanticSearchPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  // Cap chapter list at 200 entries to keep token use bounded, modern
  // EPUBs occasionally ship hundreds of micro-sections.
  const chapters = (p.chapterList ?? []).slice(0, 200);
  const providedContext = `Chapter list (in order): ${chapters.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nReader's query: """${p.query}"""`;
  const system = buildSystemPrompt("semantic_search", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Which chapters most likely contain: "${p.query}"?`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function discussionStarter(
  p: DiscussionStarterPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const clubLine = p.clubName ? ` for the club "${p.clubName}"` : "";
  const chapterLine = p.currentChapter
    ? `The club is reading through ${p.currentChapter}.`
    : "No specific chapter is set; pitch at the work as a whole.";
  const providedContext = `Drafting a discussion thread${clubLine}. ${chapterLine}`;
  const system = buildSystemPrompt("discussion_starter", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: p.progress,
    providedContext,
  });
  const userMessage = `Write a discussion-starter thread title and opening post for ${p.bookTitle}${p.currentChapter ? `, focused on ${p.currentChapter}` : ""}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

function summarizeHistory(p: RecommendationsPayload): string {
  const lines: string[] = [];
  if (p.finishedBooks?.length) {
    lines.push(
      "Recently finished: " +
        p.finishedBooks
          .slice(0, 10)
          .map((b) =>
            typeof b.rating === "number"
              ? `${b.title} by ${b.author} (rated ${b.rating}/5)`
              : `${b.title} by ${b.author}`,
          )
          .join("; "),
    );
  }
  if (p.topGenres?.length) {
    lines.push("Top genres: " + p.topGenres.slice(0, 5).join(", "));
  }
  if (p.highlightSamples?.length) {
    lines.push(
      "Highlighted passages (samples): " +
        p.highlightSamples
          .slice(0, 10)
          .map((s) => `"${s.slice(0, 140)}"`)
          .join(" | "),
    );
  }
  if (p.friendsReading?.length) {
    lines.push(
      "Friends are reading: " +
        p.friendsReading
          .slice(0, 10)
          .map((b) => `${b.title} by ${b.author}`)
          .join("; "),
    );
  }
  return lines.length ? lines.join("\n") : "(no history yet)";
}

async function recommendations(
  p: RecommendationsPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Reader history:\n${summarizeHistory(p)}`;
  const system = buildSystemPrompt("recommendations", {
    bookTitle: "(recommendation request)",
    author: "(n/a)",
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Recommend 6 public-domain books for this reader.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function readingPersonality(
  p: ReadingPersonalityPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Reader history:\n${summarizeHistory(p)}`;
  const system = buildSystemPrompt("reading_personality", {
    bookTitle: "(personality request)",
    author: "(n/a)",
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Describe this reader's reading personality in 2-3 sentences.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function bookDescription(
  p: BookDescriptionPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Describing "${p.bookTitle}" by ${p.author} for a potential reader.`;
  const system = buildSystemPrompt("book_description", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Write a short description of "${p.bookTitle}" by ${p.author}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function bookInsight(
  p: BookInsightPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Insight request for "${p.bookTitle}" by ${p.author}.`;
  const system = buildSystemPrompt("book_insight", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Lens: ${p.lens}. Book: "${p.bookTitle}" by ${p.author}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function similarBooks(
  p: SimilarBooksPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Recommending books similar to "${p.bookTitle}" by ${p.author}.`;
  const system = buildSystemPrompt("similar_books", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Recommend 5 public-domain books readers of "${p.bookTitle}" would also love.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function authorBio(
  p: AuthorBioPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Author biography for ${p.authorName}.`;
  const system = buildSystemPrompt("author_bio", {
    bookTitle: "(author bio)",
    author: p.authorName,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Write a short biography of ${p.authorName}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function chapterFeature(
  p: ChapterFeaturePayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const appendix = CHAPTER_FEATURE_APPENDICES[p.kind] ?? CHAPTER_FEATURE_APPENDICES.timeline;
  const progressLine = typeof p.progress === "number"
    ? `${Math.round(p.progress * 100)}%`
    : "unknown";
  const providedContext = `Chapter feature request: ${p.kind} for "${p.chapterTitle}".`;
  const system = `${MASTER_SYSTEM_PROMPT}

${appendix}

Current Book: ${p.bookTitle}
Author: ${p.author}
Current Chapter: ${p.chapterTitle || "(not provided)"}
Reader Progress: ${progressLine}
Provided Context: ${providedContext}`;
  const userMessage = `For "${p.chapterTitle}" of ${p.bookTitle}: generate the ${p.kind} feature.`;
  // Quiz returns JSON, be generous with tokens. Others are short prose.
  const maxTokens = p.kind === "quiz" ? 1400 : 700;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = p.kind === "quiz" ? stripJsonFences(stripThinking(raw)) : stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, cleaned);
  return cleaned;
}

async function deepDive(
  p: DeepDivePayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const appendix = DEEP_DIVE_APPENDICES[p.kind] ?? DEEP_DIVE_APPENDICES.book_summary;
  // Deep Dive responses ignore the spoiler-free rule that applies to chat.
  // by the time the user opens these, they're explicitly asking for analysis
  // of the whole work. We pass a hint in providedContext so Claude knows.
  const providedContext = `Deep dive analysis: ${p.kind}. The user has opted in to full-book analysis, spoilers are expected and welcome in this response.`;
  const system = buildSystemPrompt("deep_dive", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  // The deep_dive case in buildSystemPrompt returns "", append the
  // appendix manually so each kind gets its own framing.
  const fullSystem = `${system}\n\n${appendix}`;
  const userMessage = `Write the ${p.kind} for "${p.bookTitle}" by ${p.author}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1400,
    system: fullSystem,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function bilingualParagraph(
  p: BilingualParagraphPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const paragraphs = (p.paragraphs ?? []).slice(0, 40);
  const providedContext = `Target language: ${p.targetLanguage}. Source paragraphs to translate (preserve order, one output per input):\n${paragraphs.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")}`;
  const system = buildSystemPrompt("bilingual_paragraph", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: p.currentChapter || "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Translate the ${paragraphs.length} paragraphs above into ${p.targetLanguage}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2400,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function languageDifficulty(
  p: LanguageDifficultyPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const sample = (p.sampleText ?? "").slice(0, 2000);
  const providedContext = sample
    ? `Sample text for grounding: """${sample}"""`
    : `No sample text supplied, rate from general knowledge of the work.`;
  const system = buildSystemPrompt("language_difficulty", {
    bookTitle: p.bookTitle,
    author: p.author,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Rate the CEFR difficulty of reading "${p.bookTitle}" by ${p.author}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function wordAspect(
  p: WordAspectPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const appendix = WORD_ASPECT_APPENDICES[p.aspect] ?? WORD_ASPECT_APPENDICES.synonyms;
  const target = p.aspect === "translation" && p.targetLanguage
    ? ` Target language: ${p.targetLanguage}.`
    : "";
  const providedContext = `Aspect: ${p.aspect}. Word: "${p.word}". Sentence: "${p.sentence}".${target}`;
  const system = `${MASTER_SYSTEM_PROMPT}

${appendix}

Current Book: ${p.bookTitle}
Author: ${p.author}
Current Chapter: ${p.currentChapter || "(not provided)"}
Reader Progress: ${typeof p.progress === "number" ? `${Math.round(p.progress * 100)}%` : "unknown"}
Provided Context: ${providedContext}`;
  const userMessage = p.aspect === "translation"
    ? `Translate "${p.word}" to ${p.targetLanguage ?? "Spanish"}.`
    : `${p.aspect.charAt(0).toUpperCase()}${p.aspect.slice(1)} for "${p.word}".`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function deleteAccount(
  p: DeleteAccountPayload,
  req: Request,
): Promise<string> {
  const viewerId = await getUserIdFromAuth(req);
  if (!viewerId) throw new Error("Not authenticated");
  if (!p?.userId || p.userId !== viewerId) {
    throw new Error("You can only delete your own account");
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server is missing service-role credentials");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(viewerId);
  if (error) throw new Error(error.message);
  console.log("[ai-companion] account deleted", { userId: viewerId });
  return JSON.stringify({ success: true });
}

async function readingOrder(
  p: ReadingOrderPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  const providedContext = `Reading order for ${p.authorName}'s works. Catalog titles: ${(p.bookTitles ?? []).slice(0, 40).join("; ")}`;
  const system = buildSystemPrompt("reading_order", {
    bookTitle: "(reading order)",
    author: p.authorName,
    currentChapter: "",
    progress: undefined,
    providedContext,
  });
  const userMessage = `Suggest a reading order across these works by ${p.authorName}.`;
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const response = stripJsonFences(stripThinking(raw));
  logCompanionResponse({ ...log, userMessage }, response);
  return response;
}

async function chat(
  p: ChatPayload,
  log: Omit<LogContext, "userMessage">,
): Promise<string> {
  // Cap at last 8 messages to keep context window predictable and avoid
  // gradual safety drift on long sessions. Trims oldest first.
  const recentHistory = (p.messages ?? []).slice(-8);
  const lastUser = [...recentHistory].reverse().find((m) => m.role === "user");
  const userMessage = lastUser?.content ?? "";

  const spoilerNote = p.spoilerFree
    ? "Spoiler-free mode is ON: do not reveal anything that happens after the reader's current chapter."
    : "Spoiler-free mode is OFF: the reader has opted in to discussing later events.";
  const providedContext = `Conversation about the book in progress. ${spoilerNote}`;

  // Mode-specific appendix overrides the default chat appendix. Unknown
  // mode → fall back to normal.
  const modeKey = p.mode || "normal";
  const modeAppendix = CHAT_MODE_APPENDICES[modeKey] ?? CHAT_APPENDIX;
  const progressLine = typeof p.progress === "number"
    ? `${Math.round(p.progress * 100)}%`
    : "unknown";
  const system = `${MASTER_SYSTEM_PROMPT}

${modeAppendix}

Current Book: ${p.bookTitle}
Author: ${p.author}
Current Chapter: ${p.currentChapter || "(not provided)"}
Reader Progress: ${progressLine}
Provided Context: ${providedContext}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: recentHistory,
  });
  const raw = response.content[0].type === "text"
    ? response.content[0].text
    : "";
  const text = stripThinking(raw);
  logCompanionResponse({ ...log, userMessage }, text);
  return text;
}

// =====================================================================
// HTTP entry
// =====================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY secret is not set on this Supabase project",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const startedAt = Date.now();
  let action: ActionType | "unknown" = "unknown";

  try {
    const body = await req.json();
    action = body.action as ActionType;
    const payload = body.payload;
    const userId = await getUserIdFromAuth(req);
    const bookId = (payload && typeof payload === "object" && "bookId" in payload)
      ? (payload as { bookId?: string }).bookId
      : undefined;

    console.log(`[ai-companion] → ${action}`);

    // Server-side cache check FIRST; a hit means we skip Anthropic entirely
    // (and the cached catalog generators aren't gated anyway).
    const cacheTarget = getCacheTarget(action, payload);
    if (cacheTarget) {
      const cached = await readCache(cacheTarget);
      if (cached) {
        const elapsedMs = Date.now() - startedAt;
        console.log(`[ai-companion] ✓ ${action} cache-hit ${elapsedMs}ms`);
        return new Response(JSON.stringify({ result: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Server-side subscription gate. Must run BEFORE any Anthropic call,
    // this is the only thing standing between a viral moment and a
    // five-figure API bill.
    const gate = await enforceLimitsAndGate(userId, action);
    if (gate.response) return gate.response;

    let result: string;
    switch (action) {
      case "word_lookup":
        result = await wordLookup(payload as WordLookupPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "passage_analysis":
        result = await passageAnalysis(payload as PassageAnalysisPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "chapter_summary":
        result = await chapterSummary(payload as ChapterSummaryPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "chat":
        result = await chat(payload as ChatPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "character_map":
        result = await characterMap(payload as CharacterMapPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "word_wise":
        result = await wordWise(payload as WordWisePayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "semantic_search":
        result = await semanticSearch(payload as SemanticSearchPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "discussion_starter":
        result = await discussionStarter(payload as DiscussionStarterPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "recommendations":
        result = await recommendations(payload as RecommendationsPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "reading_personality":
        result = await readingPersonality(payload as ReadingPersonalityPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "book_description":
        result = await bookDescription(payload as BookDescriptionPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "book_insight":
        result = await bookInsight(payload as BookInsightPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "similar_books":
        result = await similarBooks(payload as SimilarBooksPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "author_bio":
        result = await authorBio(payload as AuthorBioPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "reading_order":
        result = await readingOrder(payload as ReadingOrderPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "delete_account":
        result = await deleteAccount(payload as DeleteAccountPayload, req);
        break;
      case "chapter_feature":
        result = await chapterFeature(payload as ChapterFeaturePayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "word_aspect":
        result = await wordAspect(payload as WordAspectPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "bilingual_paragraph":
        result = await bilingualParagraph(payload as BilingualParagraphPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "language_difficulty":
        result = await languageDifficulty(payload as LanguageDifficultyPayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      case "deep_dive":
        result = await deepDive(payload as DeepDivePayload, {
          type: action,
          bookId,
          userId,
        });
        break;
      default:
        console.warn(`[ai-companion] ✕ unknown action: ${action}`);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[ai-companion] ✓ ${action} ${elapsedMs}ms ${result.length} chars`,
    );

    // Best-effort cache write so the next caller (any user) avoids the
    // Anthropic round-trip. Fire-and-forget; failures don't block the
    // response.
    if (cacheTarget && result) {
      writeCache(cacheTarget, result).catch(() => {});
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-companion] ✕ ${action} ${elapsedMs}ms, ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
