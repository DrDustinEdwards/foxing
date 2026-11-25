// Next-book recommendations. Tiers 1+2 (taste, behavior) are pure data (rankCandidates). Tier 3 (AI, Plus + ANTHROPIC_API_KEY)
// re-ranks the top candidates as structured output, cached in KV for 7 days; any failure falls back to the data ranking silently.
// Caller and KV are injected, so tests need no network or binding.
import { logEvent } from "@dustinedwards/site-runtime/log";
import { UNTRUSTED_DATA_RULE, untrusted } from "@dustinedwards/site-runtime/anthropic";
import { checkProse } from "@dustinedwards/site-runtime/prose";
import { MODELS, estimateCostCents, reserveCents, type StructuredCaller } from "../companion";
import type { Db } from "../db";
import { catalogRepo, companionRepo, diaryRepo, libraryRepo, profilesRepo } from "../repositories";
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

export interface RecKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RecDeps {
  caller: StructuredCaller | null;
  kv: RecKv | null;
  refresh?: boolean;
  now?: Date;
}

export interface RankSignals {
  favoriteGenres: string[];
  behaviorGenres: string[];
  favoriteAuthors: string[];
  exampleByAuthor: Record<string, { title: string; rated: boolean }>;
}

export interface RankedRec {
  candidate: RecCandidate;
  reason: string;
  score: number;
}

// The AI cache stays here in KV rather than in AI Gateway's response cache: the gateway
// caches only byte-identical requests (or one custom key) and is volatile, while this
// cache is per reader, survives the candidate list changing, is re-resolved against the
// current pool on every read, and costs nothing against the daily quota on a hit.
const AI_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
const REFRESH_THROTTLE = 30; // seconds between honored refreshes
const RATED_HIGH = 7; // rating_half >= 7 (3.5 stars) counts as "liked"
const TARGET = 16;
const AI_CANDIDATES = 40;

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

function proseFlagged(text: string): boolean {
  return checkProse(text).some((i) => i.severity === "high" || i.severity === "critical");
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

/** The model's structured selection, checked again: only ids in `allowedIds` survive, and a reason with a high or critical prose finding (checkProse) is null, so the reader sees the data ranking's reason. Null when nothing usable. */
function selectAiPicks(
  value: unknown,
  allowedIds: Set<string>,
): Array<{ bookId: string; reason: string | null }> | null {
  const picks = (value as { picks?: unknown } | null)?.picks;
  if (!Array.isArray(picks)) return null;
  const out: Array<{ bookId: string; reason: string | null }> = [];
  const seen = new Set<string>();
  for (const item of picks) {
    const rec = item as { book_id?: unknown; reason?: unknown };
    const id = rec.book_id;
    if (typeof id !== "string" || !allowedIds.has(id) || seen.has(id)) continue;
    const reason =
      typeof rec.reason === "string" ? rec.reason.replace(/\s+/g, " ").trim().slice(0, 140) : "";
    out.push({
      bookId: id,
      reason: reason ? (proseFlagged(reason) ? null : reason) : "Picked for you",
    });
    seen.add(id);
    if (out.length >= TARGET) break;
  }
  return out.length ? out : null;
}

function buildSignals(
  favoriteGenres: string[],
  finished: Array<{ title: string; author: string; subjects: string[] | null }>,
  rated: Array<{
    title: string;
    author: string;
    subjects: string[] | null;
    ratingHalf: number | null;
  }>,
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

function buildProfilePrompt(
  favoriteGenres: string[],
  finished: Array<{ title: string; author: string }>,
  rated: Array<{ title: string; author: string; ratingHalf: number | null }>,
  signals: RankSignals,
): string {
  const lines: string[] = [];
  lines.push(
    `Favorite genres: ${favoriteGenres.length ? favoriteGenres.join(", ") : "(none set)"}`,
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

function picksSchema(ids: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: { book_id: { type: "string", enum: ids }, reason: { type: "string" } },
          required: ["book_id", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["picks"],
    additionalProperties: false,
  };
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

  let refresh = deps.refresh ?? false;
  if (refresh) {
    const tkey = `recs-refresh:${userId}`;
    if (await kv.get(tkey)) refresh = false;
    else await kv.put(tkey, "1", { expirationTtl: REFRESH_THROTTLE });
  }

  const recsCacheKey = `recs:${userId}`;
  const byId = new Map(dataRanked.map((r) => [r.candidate.id, r]));

  if (!refresh) {
    const cached = await kv.get(recsCacheKey);
    if (cached) {
      const resolved = resolveCached(cached, byId);
      if (resolved) return resolved;
    }
  }

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
    `matches for one reader from a fixed candidate list. ${UNTRUSTED_DATA_RULE}`;
  const user =
    `Reader profile:\n${untrusted("reader-profile", profilePrompt)}\n\n` +
    `Candidates (book_id | title | author | genre):\n${untrusted("candidates", candidateLines)}\n\n` +
    `From the candidates ONLY, choose up to ${TARGET} best for THIS reader, best first, each ` +
    "with a specific, warm one-line reason (max 12 words) for this reader.";

  // Quota guard: the companion's daily counter, reserved before the call and settled to its real cost after
  // (companionRepo.companionQuota). Over quota -> data ranking, no call. A call that throws keeps its reservation.
  const maxTokens = 1024;
  const run = await companionRepo.companionQuota<Awaited<ReturnType<typeof caller>>["value"]>(
    db,
    userId,
    now,
  )(reserveCents("fast", system.length + user.length, maxTokens), async () => {
    const { value, usage } = await caller(
      {
        model: MODELS.fast,
        system,
        messages: [{ role: "user", content: user }],
        maxTokens,
        feature: "recommendations",
      },
      picksSchema([...allowed]),
    );
    return { value, actual: estimateCostCents("fast", usage) };
  });
  if (!run.ok) return null;
  const { value } = run;

  const selection = selectAiPicks(value, allowed);
  if (!selection || selection.length < 6) return null;

  const recs = padTo(
    selection
      .map(({ bookId, reason }) => {
        const r = byId.get(bookId);
        return r ? { ...toRec(r), reason: reason ?? r.reason } : null;
      })
      .filter((r): r is Recommendation => r !== null),
    dataRanked,
  );
  await kv.put(
    recsCacheKey,
    JSON.stringify(recs.map((r) => ({ bookId: r.bookId, reason: r.reason }))),
    { expirationTtl: AI_CACHE_TTL },
  );
  return recs;
}

function resolveCached(cached: string, byId: Map<string, RankedRec>): Recommendation[] | null {
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

/** favourite_genres as a clean string[]: NULL or a non-array value collapses to no genres, so the starter-set fallback runs instead of throwing. */
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

  if (isPlus && deps.caller) {
    try {
      const profilePrompt = buildProfilePrompt(favoriteGenres, finished, rated, signals);
      const ai = await aiOverlay(db, userId, deps, dataRanked, profilePrompt);
      if (ai && ai.length) return { recommendations: ai, aiPersonalized: true, isPlus };
    } catch (err) {
      logEvent("recommendations_ai_failed", { error: err }, { level: "error" }); // falls back to the data ranking
    }
  }

  return { recommendations: dataTop, aiPersonalized: false, isPlus };
}
