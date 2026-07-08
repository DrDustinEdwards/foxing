export * as profilesRepo from "./profiles";
export * from "./profiles";

// Catalog reads are namespaced (catalogRepo.getBookBySlug, ...) to keep the many
// function names from colliding across resources as the read layer grows. Types are
// re-exported flat for ergonomic loader typing (import type { BookCard }).
export * as catalogRepo from "./catalog";
export type * from "./catalog";
