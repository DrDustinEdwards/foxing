export * from "./account";
export * from "./onboarding";
export * from "./text";
export * as annotationsDomain from "./annotations";
export { resolveDefaultAnnotationVisibility } from "./annotations";
export * as libraryDomain from "./library";
export { changeBookStatus } from "./library";

export * from "./errors";
export * as clubsDomain from "./clubs";
export type { LiveMessage } from "./clubs";

export * as socialDomain from "./social";
export { resolveFeed } from "./social";
export type { FeedItem, FeedPage, FeedInputs } from "./social";
export * as diaryDomain from "./diary";
export * as reactionsDomain from "./reactions";
export * as recapDomain from "./recap";
export type { Recap, RecapBook } from "./recap";

export * as recommendationsDomain from "./recommendations";
export { getRecommendations, rankCandidates, parseAiSelection } from "./recommendations";
export type {
  Recommendation,
  RecommendationSet,
  RecDeps,
  RecKv,
  RankSignals,
  RankedRec,
} from "./recommendations";

export * as syncDomain from "./sync";
export { resolveSyncOp } from "./sync";
export type { SyncDecision, SyncOpResult, SyncPull } from "./sync";

export * as pushDomain from "./push";
export { shouldDeliverPush } from "./push";
export type { NotificationPrefs, PushDecision, PushCategory } from "./push";
export * as membership from "./membership";
export * as pollResult from "./poll-result";
export {
  computeIrv,
  computePlurality,
  computePollResult,
  firstPreferenceTallies,
} from "./poll-result";
