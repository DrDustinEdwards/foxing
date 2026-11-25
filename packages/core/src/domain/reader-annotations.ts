// The ONE server-side resolver of the reader's social layers (web loader and mobile API). Invariants, proven by the resolution matrix:
//   1. Others' PRIVATE annotations never appear: MINE is the only branch without a visibility filter and is scoped to user_id = viewer;
//      the gate only hides content the viewer is already entitled to see.
//   2. The gate applies to OTHERS' items only, never the viewer's own.
import type { Db } from "../db";
import * as annotationsRepo from "../repositories/annotations";
import * as libraryRepo from "../repositories/library";
import * as reactionsRepo from "../repositories/reactions";
import * as readerSocial from "../repositories/reader-social";
import type { SocialAnnotationRow } from "../repositories/reader-social";
import type {
  Gate,
  Locator,
  OtherLayer,
  PopularHighlight,
  ReaderAnnotations as ReaderAnnotationsResult,
  ReaderMine,
  ResolvedComment,
  ResolvedOther,
} from "@foxing/types";

export type {
  Gate,
  OtherLayer,
  PopularHighlight,
  ReaderAnnotations as ReaderAnnotationsResult,
  ReaderMine,
  ResolvedComment,
  ResolvedOther,
} from "@foxing/types";

// A whole page is ~0.5% of a book; the annotation must be that far ahead before the gate fires, so the same page never collapses.
const AHEAD_EPSILON = 0.5;

// Closer relationships win when an id somehow appears in more than one branch.
const LAYER_RANK: Record<OtherLayer, number> = { club: 0, friend: 1, public: 2 };

export function annotationPct(locator: Locator | null | undefined): number | null {
  const locations = (locator?.locations ?? null) as { totalProgression?: unknown } | null;
  const tp = locations?.totalProgression;
  if (typeof tp !== "number") return null;
  return Math.round(Math.min(1, Math.max(0, tp)) * 1000) / 10;
}

/** The gate for ONE others' item: `spoiler` (author flag) or `ahead` (progress gate on and item past the viewer). Without a position `ahead` stays false. */
export function computeGate(input: {
  containsSpoilers: boolean;
  annPct: number | null;
  viewerPct: number | null;
  progressGate: boolean;
}): Gate {
  const spoiler = input.containsSpoilers === true;
  const ahead =
    input.progressGate === true &&
    input.annPct != null &&
    input.viewerPct != null &&
    input.annPct > input.viewerPct + AHEAD_EPSILON;
  return { spoiler, ahead };
}

export type LoadReaderAnnotationsOptions = {
  /** Automatic progress gate (default on); the manual spoiler flag is never disabled. */
  progressGate?: boolean;
};

export async function loadReaderAnnotations(
  db: Db,
  viewerId: string | null,
  bookId: string,
  opts: LoadReaderAnnotationsOptions = {},
): Promise<ReaderAnnotationsResult> {
  const progressGate = opts.progressGate ?? true;

  let viewerPct: number | null = null;
  let mine: ReaderMine[] = [];
  let clubIds: string[] = [];
  let coReaders: string[] = [];
  let closeFriends: string[] = [];

  if (viewerId) {
    const [userBook, mineRows, v] = await Promise.all([
      libraryRepo.getUserBook(db, viewerId, bookId),
      annotationsRepo.listForReader(db, viewerId, bookId),
      readerSocial.viewerClubIdsReadingBook(db, viewerId, bookId),
    ]);
    // A signed-in viewer with no shelf row is treated as at 0%: everything ahead is a
    // courtesy-collapsed spoiler, which is the safe default the gate is meant to give.
    viewerPct = userBook?.progressPct ?? 0;
    mine = mineRows.map((a) => ({
      id: a.id,
      type: a.type,
      locator: (a.locator as Locator | null) ?? null,
      selectedText: a.selectedText,
      body: a.body,
      color: a.color,
      chapter: a.chapter,
    }));
    clubIds = v;
    [coReaders, closeFriends] = await Promise.all([
      readerSocial.coReadingAuthorIds(db, clubIds, viewerId),
      readerSocial.closeFriendAuthorIds(db, viewerId),
    ]);
  }

  const [clubRows, friendRows, publicRows, commentRows, popularRows] = await Promise.all([
    readerSocial.clubOthers(db, bookId, coReaders),
    readerSocial.friendOthers(db, bookId, closeFriends),
    readerSocial.publicOthers(db, bookId, viewerId),
    clubIds.length > 0 ? readerSocial.commentsInClubs(db, bookId, clubIds) : Promise.resolve([]),
    readerSocial.popularHighlights(db, bookId),
  ]);

  // Dedup by id defensively, preferring the closer relationship (club > friend > public).
  const byId = new Map<string, { row: SocialAnnotationRow; layer: OtherLayer }>();
  const consider = (rows: SocialAnnotationRow[], layer: OtherLayer) => {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (!existing || LAYER_RANK[layer] < LAYER_RANK[existing.layer]) {
        byId.set(row.id, { row, layer });
      }
    }
  };
  consider(clubRows, "club");
  consider(friendRows, "friend");
  consider(publicRows, "public");

  const pctById = new Map<string, number | null>();
  for (const { row } of byId.values()) pctById.set(row.id, annotationPct(row.locator));
  for (const m of mine) pctById.set(m.id, annotationPct(m.locator));

  // Reply counts come from the club comment set (parent_id); like counts from one grouped reactions read, so the popover needs no per-annotation query.
  const replyCounts = new Map<string, number>();
  for (const row of commentRows) {
    if (row.parentId) replyCounts.set(row.parentId, (replyCounts.get(row.parentId) ?? 0) + 1);
  }
  const otherIds = [...byId.keys()];
  const likes = await reactionsRepo.likeSummary(db, "annotation", otherIds, viewerId);

  const others: ResolvedOther[] = [];
  for (const { row, layer } of byId.values()) {
    const like = likes.get(row.id);
    others.push({
      id: row.id,
      type: row.type,
      locator: row.locator,
      selectedText: row.selectedText,
      body: row.body,
      color: row.color,
      chapter: row.chapter,
      layer,
      isPinned: row.isPinned,
      containsSpoilers: row.containsSpoilers,
      gate: computeGate({
        containsSpoilers: row.containsSpoilers,
        annPct: annotationPct(row.locator),
        viewerPct,
        progressGate,
      }),
      author: row.author,
      likeCount: like?.likeCount ?? 0,
      likedByMe: like?.likedByMe ?? false,
      replyCount: replyCounts.get(row.id) ?? 0,
    });
  }

  const comments: ResolvedComment[] = commentRows.map((row) => {
    const ownPct = annotationPct(row.locator);
    const annPct = ownPct ?? (row.parentId ? (pctById.get(row.parentId) ?? null) : null);
    // The viewer's own comments are never gated (the gate is a courtesy to the reader,
    // and you are never spoiled by your own words).
    const isOwn = viewerId != null && row.userId === viewerId;
    return {
      id: row.id,
      clubId: row.clubId,
      parentId: row.parentId,
      locator: row.locator,
      body: row.body,
      chapter: row.chapter,
      isPinned: row.isPinned,
      containsSpoilers: row.containsSpoilers,
      gate: isOwn
        ? { spoiler: false, ahead: false }
        : computeGate({
            containsSpoilers: row.containsSpoilers,
            annPct,
            viewerPct,
            progressGate,
          }),
      author: row.author,
      createdAt: row.createdAt.getTime(),
    };
  });

  const popular: PopularHighlight[] = popularRows.map((p) => ({
    normalizedText: p.normalizedText,
    count: p.count,
    locator: p.locator,
  }));

  return { viewerProgressPct: viewerPct, mine, others, comments, popular };
}
