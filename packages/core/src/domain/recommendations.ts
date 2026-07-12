// Find next book: a tiered recommendation engine.
//   Tier 1 (taste)    - favourite_genres -> award winners + most-loved in those genres.
//                       Empty genres fall back to a cross-genre curated starter set.
//   Tier 2 (behaviour)- finished/rated books -> favourite authors + top genres boost.
//   Tier 3 (AI)       - Plus + ANTHROPIC_API_KEY only: the companion re-ranks the top
//                       data candidates with a personalised reason each. Cached in KV
//                       (7 days); any parse/API/quota failure falls back to the data
//                       ranking silently. Free users, or no key, get the full data page.
//
// Tiers 1+2 are pure data (rankCandidates); tier 3 is an overlay. The composition reads
// in-process via the repos; the caller/KV are injected so this stays testable with a
// stubbed model and a fake KV, no network and no binding.
import {
  type CompanionCaller,
  EMPTY_QUOTA_STATE,
  MODELS,
  type QuotaState,
  addUsage,
  estimateCostCents,
  isOverQuota,
  quotaKey,
  quotaResetsAt,
} from "../companion";
import type { Db } from "../db";
import { catalogRepo, diaryRepo, libraryRepo, profilesRepo } from "../repositories";
import type { RecCandidate } from "../repositories";

export interface Recommendation {
  bookId: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  publicationYear: number | null;
  reason: string;
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  aiPersonalized: boolean;
  isPlus: boolean;
}

/** The minimal KV surface the AI cache + quota need (a subset of Cloudflare KVNamespace),
 *  so core takes no binding type. */
export interface RecKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RecDeps {
  /** Real caller when ANTHROPIC_API_KEY is set, else null (tier 3 skipped). */
  caller: CompanionCaller | null;
  /** KV for the AI cache + quota, or null (tier 3 recomputes / is skipped). */
  kv: RecKv | null;
  /** A refresh busts the AI cache (rate-limited); ignored for the data tiers. */
  refresh?: boolean;
  now?: Date;
}

export interface RankSignals {
  favoriteGenres: string[];
  behaviorGenres: string[];
  favoriteAuthors: string[];
  /** Lowercased author -> an example liked title, preferring a highly-rated one. */
  exampleByAuthor: Record<string, { title: string; rated: boolean }>;
}

export interface RankedRec {
  candidate: RecCandidate;
  reason: string;
  score: number;
}

const AI_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
const REFRESH_THROTTLE = 30; // seconds between honoured refreshes
const RATED_HIGH = 7; // rating_half >= 7 (3.5 stars) counts as "liked"
const TARGET = 16;
const AI_CANDIDATES = 40;

/**
 * Pure ranker for tiers 1 + 2. Scores each candidate by rating quality, awards, staff
 * pick, taste-genre match, behaviour-genre match, and author match, and derives a reason
 * from the strongest signal. Deterministic order for stable pages.
 */
export function rankCandidates(
  candidates: RecCandidate[],
  signals: RankSignals,
  awardIds: Set<string>,
): RankedRec[] {
  const favGen = new Set(signals.favoriteGenres.map((g) => g.toLowerCase()));
  const behGen = new Set(signals.behaviorGenres.map((g) => g.toLowerCase()));
  const favAuth = new Set(signals.favoriteAuthors.map((a) => a.toLowerCase()));

  const ranked = candidates.map((c) => {
    let score = 0;
    let reason = "Loved by readers";
    let pri = 0;
    const bump = (p: number, r: string) => {
      if (p > pri) {
        pri = p;
        reason = r;
      }
    };

    const subs = c.subjects ?? [];
    const isAward = awardIds.has(c.id);

    // Rating quality: up to +2, damped by how many ratings back it.
    const rating = c.weightedRating ?? 0;
    const rc = c.ratingCount ?? 0;
    score += Math.min(2, (rating / 5) * 2) * Math.min(1, Math.log10(rc + 1) / 2);

    if (isAward) {
      score += 2;
      bump(2.5, "Award winner");
    }
    if (c.isStaffPick) {
      score += 1;
      bump(2, "A Foxing staff pick");
    }

    const tasteSub = subs.find((s) => favGen.has(s.toLowerCase()));
    if (tasteSub) {
      score += 2;
      bump(isAward ? 5 : 3, isAward ? `Award winner in ${tasteSub}` : `Popular in ${tasteSub}`);
    }

    const behSub = subs.find((s) => behGen.has(s.toLowerCase()));
    if (behSub) {
      score += 3;
      bump(4, `More ${behSub}, which you read`);
    }

    if (favAuth.has(c.author.toLowerCase())) {
      score += 6;
      const ex = signals.exampleByAuthor[c.author.toLowerCase()];
      if (ex?.rated) bump(7, `Because you rated ${ex.title} highly`);
      else bump(6, `More from ${c.author}`);
    }

    return { candidate: c, reason, score };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.candidate.weightedRating ?? 0) - (a.candidate.weightedRating ?? 0) ||
      b.candidate.ratingCount - a.candidate.ratingCount ||
      a.candidate.title.localeCompare(b.candidate.title),
  );
  return ranked;
}

function toRec(r: RankedRec): Recommendation {
  return {
    bookId: r.candidate.id,
    slug: r.candidate.slug,
    title: r.candidate.title,
    author: r.candidate.author,
    coverUrl: r.candidate.coverUrl,
    publicationYear: r.candidate.publicationYear,
    reason: r.reason,
  };
}

/**
 * Parse the model's strict-JSON selection. Returns null on any malformed output so the
 * caller falls back to the data ranking. Only ids in `allowedIds` survive; duplicates
 * and non-strings are dropped; reasons are cleaned to one line.
 */
export function parseAiSelection(
  text: string,
  allowedIds: Set<string>,
): Array<{ bookId: string; reason: string }> | null {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    const out: Array<{ bookId: string; reason: string }> = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const rec = item as { book_id?: unknown; bookId?: unknown; reason?: unknown };
      const id = typeof rec.book_id === "string" ? rec.book_id : rec.bookId;
      if (typeof id !== "string" || !allowedIds.has(id) || seen.has(id)) continue;
      const reason =
        typeof rec.reason === "string" ? rec.reason.replace(/\s+/g, " ").trim().slice(0, 140) : "";
      out.push({ bookId: id, reason: reason || "Picked for you" });
      seen.add(id);
      if (out.length >= TARGET) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// -- Signals ----------------------------------------------------------------

function buildSignals(
  favoriteGenres: string[],
  finished: Array<{ title: string; author: string; subjects: string[] | null }>,
  rated: Array<{ title: string; author: string; subjects: string[] | null; ratingHalf: number | null }>,
): RankSignals {
  const authors = new Set<string>();
  const behaviorGenres = new Map<string, string>(); // lower -> display
  const exampleByAuthor: Record<string, { title: string; rated: boolean }> = {};

  const note = (author: string, title: string, subjects: string[] | null, rated: boolean) => {
    const lc = author.toLowerCase();
    authors.add(lc);
    const ex = exampleByAuthor[lc];
    if (!ex || (rated && !ex.rated)) exampleByAuthor[lc] = { title, rated };
    for (const s of subjects ?? []) {
      const sl = s.toLowerCase();
      if (!behaviorGenres.has(sl)) behaviorGenres.set(sl, s);
    }
  };

  for (const f of finished) note(f.author, f.title, f.subjects, false);
  for (const r of rated) {
    if ((r.ratingHalf ?? 0) >= RATED_HIGH) note(r.author, r.title, r.subjects, true);
  }

  return {
    favoriteGenres,
    behaviorGenres: [...behaviorGenres.values()],
    favoriteAuthors: [...authors],
    exampleByAuthor,
  };
}

// -- AI overlay -------------------------------------------------------------

async function collect(
  caller: CompanionCaller,
  args: Parameters<CompanionCaller>[0],
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const ev of caller(args)) {
    if (ev.type === "text") text += ev.delta;
    else if (ev.type === "done") {
      inputTokens = ev.inputTokens;
      outputTokens = ev.outputTokens;
    }
  }
  return { text, inputTokens, outputTokens };
}

function buildProfilePrompt(
  favoriteGenres: string[],
  finished: Array<{ title: string; author: string }>,
  rated: Array<{ title: string; author: string; ratingHalf: number | null }>,
  signals: RankSignals,
): string {
  const lines: string[] = [];
  lines.push(
    `Favourite genres: ${favoriteGenres.length ? favoriteGenres.join(", ") : "(none set)"}`,
  );
  const read = [
    ...rated
      .filter((r) => (r.ratingHalf ?? 0) >= RATED_HIGH)
      .map((r) => `${r.title} by ${r.author} (${((r.ratingHalf ?? 0) / 2).toFixed(1)} stars)`),
    ...finished.map((f) => `${f.title} by ${f.author}`),
  ].slice(0, 12);
  lines.push(`Recently read: ${read.length ? read.join("; ") : "(no history yet)"}`);
  if (signals.favoriteAuthors.length) {
    lines.push(`Authors they return to: ${signals.favoriteAuthors.slice(0, 8).join(", ")}`);
  }
  return lines.join("\n");
}

async function aiOverlay(
  db: Db,
  userId: string,
  deps: RecDeps,
  dataRanked: RankedRec[],
  profilePrompt: string,
): Promise<Recommendation[] | null> {
  const { caller, kv } = deps;
  if (!caller || !kv) return null;
  const now = deps.now ?? new Date();

  // Refresh throttle: honour a refresh at most once per window; otherwise serve cache.
  let refresh = deps.refresh ?? false;
  if (refresh) {
    const tkey = `recs-refresh:${userId}`;
    if (await kv.get(tkey)) refresh = false;
    else await kv.put(tkey, "1", { expirationTtl: REFRESH_THROTTLE });
  }

  const cacheKey = `recs:${userId}`;
  const byId = new Map(dataRanked.map((r) => [r.candidate.id, r]));

  if (!refresh) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const resolved = resolveCached(cached, byId);
      if (resolved) return resolved;
    }
  }

  // Quota guard (per-user daily cost ceiling). Over quota -> data ranking, no call.
  const qkey = quotaKey(userId, now);
  let quota: QuotaState = EMPTY_QUOTA_STATE;
  const rawQuota = await kv.get(qkey);
  if (rawQuota) {
    try {
      quota = JSON.parse(rawQuota) as QuotaState;
    } catch {
      quota = EMPTY_QUOTA_STATE;
    }
  }
  if (isOverQuota(quota)) return null;

  const top = dataRanked.slice(0, AI_CANDIDATES);
  const allowed = new Set(top.map((r) => r.candidate.id));
  const candidateLines = top
    .map((r) => {
      const c = r.candidate;
      return `${c.id} | ${c.title} | ${c.author} | ${(c.subjects ?? [])[0] ?? ""}`;
    })
    .join("\n");

  const system =
    "You recommend classic and literary books for a reading app. Pick and rank the best " +
    "matches for one reader from a fixed candidate list. Return ONLY a JSON array, no prose.";
  const user =
    `Reader profile:\n${profilePrompt}\n\n` +
    `Candidates (book_id | title | author | genre):\n${candidateLines}\n\n` +
    `From the candidates ONLY, choose up to ${TARGET} best for THIS reader, best first. ` +
    `For each return {"book_id","reason"} where reason is a specific, warm one-line ` +
    `(max 12 words) for this reader. Output a JSON array only.`;

  const { text, inputTokens, outputTokens } = await collect(caller, {
    model: MODELS.fast,
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 1024,
  });

  // Record the settled cost against the daily quota (best effort).
  const cost = estimateCostCents("fast", inputTokens, outputTokens);
  const resetTtl = Math.max(
    60,
    Math.ceil((Date.parse(quotaResetsAt(now)) - now.getTime()) / 1000),
  );
  await kv.put(qkey, JSON.stringify(addUsage(quota, cost)), { expirationTtl: resetTtl });

  const selection = parseAiSelection(text, allowed);
  if (!selection || selection.length < 6) return null;

  const recs = padTo(
    selection
      .map(({ bookId, reason }) => {
        const r = byId.get(bookId);
        return r ? { ...toRec(r), reason } : null;
      })
      .filter((r): r is Recommendation => r !== null),
    dataRanked,
  );
  await kv.put(
    cacheKey,
    JSON.stringify(recs.map((r) => ({ bookId: r.bookId, reason: r.reason }))),
    { expirationTtl: AI_CACHE_TTL },
  );
  return recs;
}

/** Resolve a cached [{bookId, reason}] against the current candidate pool (drops any
 *  book that is now owned/gone). Null if too little survives to fill a page. */
function resolveCached(
  cached: string,
  byId: Map<string, RankedRec>,
): Recommendation[] | null {
  try {
    const parsed = JSON.parse(cached) as Array<{ bookId: string; reason: string }>;
    if (!Array.isArray(parsed)) return null;
    const recs = parsed
      .map(({ bookId, reason }) => {
        const r = byId.get(bookId);
        return r ? { ...toRec(r), reason } : null;
      })
      .filter((r): r is Recommendation => r !== null);
    return recs.length >= 6 ? recs.slice(0, TARGET) : null;
  } catch {
    return null;
  }
}

/** Fill a partial AI list up to TARGET from the data ranking (no duplicates). */
function padTo(recs: Recommendation[], dataRanked: RankedRec[]): Recommendation[] {
  const have = new Set(recs.map((r) => r.bookId));
  const out = [...recs];
  for (const r of dataRanked) {
    if (out.length >= TARGET) break;
    if (!have.has(r.candidate.id)) {
      out.push(toRec(r));
      have.add(r.candidate.id);
    }
  }
  return out.slice(0, TARGET);
}

// -- Composition ------------------------------------------------------------

/** Coerce favourite_genres to a clean string[]. A brand-new profile stores NULL (Drizzle
 *  maps it to null); a dirty/legacy value that is not an array collapses to no genres, so
 *  the tier-1 starter-set fallback runs instead of throwing. */
function normalizeGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((g): g is string => typeof g === "string" && g.trim().length > 0);
}

export async function getRecommendations(
  db: Db,
  userId: string,
  deps: RecDeps,
): Promise<RecommendationSet> {
  const [profile, ownedIds, finished, rated] = await Promise.all([
    profilesRepo.getProfileById(db, userId),
    libraryRepo.listOwnedBookIds(db, userId),
    libraryRepo.listFinishedForSignals(db, userId),
    diaryRepo.listRatedForSignals(db, userId),
  ]);

  const favoriteGenres = normalizeGenres(profile?.favoriteGenres);
  const isPlus = profile?.subscriptionTier === "plus";
  const signals = buildSignals(favoriteGenres, finished, rated);

  // Candidate pool: base (top-rated) + author matches + genre matches, minus owned.
  const genrePool = [...new Set([...favoriteGenres, ...signals.behaviorGenres])];
  const [byRating, byAuthors, bySubjects] = await Promise.all([
    catalogRepo.listRecCandidatesByRating(db, 400),
    catalogRepo.listRecCandidatesByAuthors(db, signals.favoriteAuthors),
    catalogRepo.listRecCandidatesBySubjects(db, genrePool),
  ]);

  const owned = new Set(ownedIds);
  const pool = new Map<string, RecCandidate>();
  for (const row of [...byRating, ...byAuthors, ...bySubjects]) {
    if (!owned.has(row.id)) pool.set(row.id, row);
  }
  const candidates = [...pool.values()];
  if (candidates.length === 0) {
    return { recommendations: [], aiPersonalized: false, isPlus };
  }

  const awardIds = new Set(
    await catalogRepo.listAwardWinnerIds(
      db,
      candidates.map((c) => c.id),
    ),
  );
  const dataRanked = rankCandidates(candidates, signals, awardIds);
  const dataTop = dataRanked.slice(0, TARGET).map(toRec);

  // Tier 3: Plus + key only. Any failure inside falls back to the data ranking silently.
  if (isPlus && deps.caller) {
    try {
      const profilePrompt = buildProfilePrompt(favoriteGenres, finished, rated, signals);
      const ai = await aiOverlay(db, userId, deps, dataRanked, profilePrompt);
      if (ai && ai.length) return { recommendations: ai, aiPersonalized: true, isPlus };
    } catch {
      // fall through to the data ranking
    }
  }

  return { recommendations: dataTop, aiPersonalized: false, isPlus };
}
